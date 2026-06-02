// lib/incidentReconstructor.ts
// Trace DAG → Root Cause → Narrative (E7 spec)

import { DecisionTrace, TraceEntry } from "@/core/shared/types"

// ─── TYPES ────────────────────────────────────────────────────

export type SpanNode = {
  spanId: string
  parentSpanId?: string
  name: string           // e.g. "fraud_agent_analysis", "mcp_call"
  service: string        // e.g. "fraud-agent", "mcp-client", "orchestrator"
  startTime: number
  endTime: number
  attributes: Record<string, any>
  status: "OK" | "ERROR"
  latencyMs: number
}

export type IncidentType =
  | "FRAUD_SPIKE"
  | "MCP_LATENCY"
  | "PAYPAL_FAILURE"
  | "AGENT_CONFLICT"
  | "UNKNOWN"

export interface IncidentReport {
  id: string
  type: IncidentType
  rootCause: SpanNode | null
  chain: SpanNode[]
  severity: number         // 0–100
  narrative: string
  timestamp: number
  replayAvailable: boolean
}

// ─── BRIDGE: DecisionTrace → SpanNode[] ───────────────────────

export function decisionTraceToSpans(trace: DecisionTrace): SpanNode[] {
  const baseTime = trace.timestamp - trace.timeline.reduce((a, e) => a + (e.durationMs ?? 50), 0)
  let cursor = baseTime

  const spans: SpanNode[] = trace.timeline.map((entry: TraceEntry, i: number) => {
    const latencyMs = entry.durationMs ?? 50
    const startTime = cursor
    cursor += latencyMs

    const isError =
      entry.label.includes("FAILED") ||
      entry.label.includes("ERROR") ||
      entry.label.includes("TIMEOUT")

    const service =
      entry.type === "agent"     ? "agent-core"
      : entry.type === "mcp"    ? "mcp-client"
      : entry.type === "write"  ? "bloomreach-write"
      : entry.type === "event"  ? "event-ingester"
      : "orchestrator"

    return {
      spanId: `span_${i}_${entry.label.toLowerCase().replace(/\s+/g, "_").slice(0, 24)}`,
      parentSpanId: i > 0 ? `span_${i - 1}_${trace.timeline[i - 1].label.toLowerCase().replace(/\s+/g, "_").slice(0, 24)}` : undefined,
      name: entry.label.toLowerCase().replace(/\s+/g, "_"),
      service,
      startTime,
      endTime: startTime + latencyMs,
      attributes: { originalType: entry.type, label: entry.label },
      status: isError ? "ERROR" : "OK",
      latencyMs,
    }
  })

  // Add synthetic spans for agent outputs
  const riskCouncil = trace.councils?.risk?.memberOpinions ?? []
  const revenueCouncil = trace.councils?.revenue?.memberOpinions ?? []
  const customerCouncil = trace.councils?.customer?.memberOpinions ?? []
  
  const agentLatencies = [
    { name: "fraud_agent_analysis",   service: "fraud-agent",   latencyMs: (riskCouncil.find((o: any) => o.agentId === "fraud")?.latencyMs   ?? 890) as number },
    { name: "revenue_agent_analysis", service: "revenue-agent", latencyMs: (revenueCouncil.find((o: any) => o.agentId === "revenue")?.latencyMs ?? 620) as number },
    { name: "cx_agent_analysis",      service: "cx-agent",      latencyMs: (customerCouncil.find((o: any) => o.agentId === "cx")?.latencyMs     ?? 510) as number },
  ]
  agentLatencies.forEach(({ name, service, latencyMs }) => {
    spans.push({
      spanId: `span_${name}`,
      name,
      service,
      startTime: baseTime + 100,
      endTime: baseTime + 100 + latencyMs,
      attributes: {},
      status: "OK",
      latencyMs,
    })
  })

  return spans
}

// ─── DAG BUILDER ──────────────────────────────────────────────

export function buildTraceDAG(spans: SpanNode[]): Map<string, SpanNode[]> {
  const graph = new Map<string, SpanNode[]>()
  for (const span of spans) {
    const parent = span.parentSpanId ?? "root"
    if (!graph.has(parent)) graph.set(parent, [])
    graph.get(parent)!.push(span)
  }
  return graph
}

// ─── ANOMALY DETECTION ────────────────────────────────────────

export function detectAnomalies(spans: SpanNode[]): SpanNode[] {
  return spans.filter(s =>
    s.status === "ERROR" ||
    s.latencyMs > 2000 ||
    (s.name.includes("mcp") && s.latencyMs > 8000)
  )
}

export function findRootCause(spans: SpanNode[]): SpanNode | null {
  const anomalies = detectAnomalies(spans)
  if (anomalies.length === 0) return null
  // Earliest anomaly = most likely root cause
  return anomalies.sort((a, b) => a.startTime - b.startTime)[0]
}

// ─── CAUSAL CHAIN ─────────────────────────────────────────────

export function reconstructChain(spans: SpanNode[], rootCause: SpanNode | null): SpanNode[] {
  if (!rootCause) return spans.slice(0, 5) // Return first 5 as baseline chain
  const rootIndex = spans.findIndex(s => s.spanId === rootCause.spanId)
  if (rootIndex === -1) return spans.slice(0, 5)
  // Return from root cause forward (causal propagation)
  return spans.slice(rootIndex)
}

// ─── CLASSIFICATION ───────────────────────────────────────────

export function classifyIncident(chain: SpanNode[]): IncidentType {
  if (chain.some(s => s.name.includes("fraud") && (s.status === "ERROR" || s.latencyMs > 1000))) return "FRAUD_SPIKE"
  if (chain.some(s => s.name.includes("mcp") && s.latencyMs > 8000)) return "MCP_LATENCY"
  if (chain.some(s => s.name.includes("paypal") && s.status === "ERROR")) return "PAYPAL_FAILURE"
  if (chain.some(s => s.name.includes("conflict") || s.name.includes("arena") || s.name.includes("consensus"))) return "AGENT_CONFLICT"
  return "UNKNOWN"
}

// ─── SEVERITY SCORING ─────────────────────────────────────────

export function scoreIncident(chain: SpanNode[]): number {
  if (chain.length === 0) return 0
  const errorRate = chain.filter(s => s.status === "ERROR").length / chain.length
  const totalLatency = chain.reduce((a, s) => a + s.latencyMs, 0)
  const latencyScore = Math.min(50, totalLatency / 200) // cap at 50 pts
  return Math.min(100, Math.round(errorRate * 50 + latencyScore))
}

// ─── NARRATIVE GENERATOR ──────────────────────────────────────

export function generateIncidentReport(spans: SpanNode[], traceId: string): IncidentReport {
  const rootCause = findRootCause(spans)
  const chain = reconstructChain(spans, rootCause)
  const type = classifyIncident(chain)
  const severity = scoreIncident(chain)

  const narratives: Record<IncidentType, string> = {
    FRAUD_SPIKE:
      `Fraud detection subsystem flagged anomalous signals. Root cause: ${rootCause?.name ?? "unknown"} in ${rootCause?.service ?? "unknown"} (${rootCause?.latencyMs ?? 0}ms). ` +
      `${chain.filter(s => s.status === "ERROR").length} error span(s) propagated through the chain. Orchestrator responded with elevated fraud weighting.`,
    MCP_LATENCY:
      `Bloomreach MCP context enrichment experienced critical latency (${rootCause?.latencyMs ?? 0}ms). ` +
      `This delayed the agent analysis phase. Consider enabling cache hits or reducing MCP tool count per call.`,
    PAYPAL_FAILURE:
      `PayPal transaction processing returned an error in ${rootCause?.service ?? "payment-service"}. ` +
      `The orchestrator switched to HOLD mode pending payment gateway resolution.`,
    AGENT_CONFLICT:
      `Multi-agent consensus detected a disagreement between Fraud, Revenue, and CX agents. ` +
      `Orchestrator resolved the conflict via weighted arbitration. Final decision required ${chain.length} resolution steps.`,
    UNKNOWN:
      `Anomaly detected in the decision pipeline. ${chain.filter(s => s.status === "ERROR").length} error(s) found ` +
      `across ${chain.length} spans. Total latency: ${chain.reduce((a, s) => a + s.latencyMs, 0)}ms.`,
  }

  const narrative = narratives[type]

  return {
    id: `incident_${traceId}`,
    type,
    rootCause,
    chain,
    severity,
    narrative,
    timestamp: Date.now(),
    replayAvailable: true,
  }
}

// ─── MAIN ENTRY ───────────────────────────────────────────────

export function reconstructIncidentFromTrace(trace: DecisionTrace): IncidentReport | null {
  const spans = decisionTraceToSpans(trace)
  const anomalies = detectAnomalies(spans)
  // Only generate a report if there's something notable
  if (anomalies.length === 0 && spans.every(s => s.latencyMs < 1000)) return null
  return generateIncidentReport(spans, trace.id)
}
