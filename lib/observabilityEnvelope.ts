// lib/observabilityEnvelope.ts
// Token cost tracker, latency breakdown, and SRE anomaly detection (E7 spec)

import { DecisionTrace, ObservabilityEnvelope } from "@/core/shared/types"

// ─── PRICING MODEL (gpt-4o-mini) ─────────────────────────────

const COST_PER_1M_INPUT  = 0.15  // USD
const COST_PER_1M_OUTPUT = 0.60  // USD

// ─── TOKEN ESTIMATOR (no SDK needed) ──────────────────────────

/** Rough token estimate: ~4 chars per token for English prose/JSON */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function estimateTraceTokens(trace: DecisionTrace): { input: number; output: number } {
  // Input = system prompt + event context + MCP data + 3 agent outputs
  const inputApprox =
    200 +                                           // system prompt
    50 +                                            // event summary
    trace.mcpContextSources.length * 80 +           // MCP tool results
    estimateTokens(JSON.stringify(trace.agents))     // agent outputs

  // Output = orchestrator decision JSON
  const outputApprox =
    estimateTokens(JSON.stringify(trace.orchestrator)) +
    estimateTokens(trace.reasoning.join(" "))

  return { input: inputApprox, output: outputApprox }
}

// ─── LATENCY BREAKDOWN BUILDER ────────────────────────────────

export function buildLatencyBreakdown(
  trace: DecisionTrace
): ObservabilityEnvelope["latency"]["breakdown"] {
  const grouped = { mcp: 0, llm: 0, agents: 0, decision: 0 }

  for (const entry of trace.timeline) {
    const ms = entry.durationMs ?? 0
    if (entry.type === "mcp")      grouped.mcp += ms
    else if (entry.type === "agent")    grouped.agents += ms
    else if (entry.type === "consensus") grouped.decision += ms
    else if (entry.type === "decision") grouped.decision += ms
  }

  // Synthesize LLM time from agent latencies (parallel, so max of the three)
  const riskCouncil = trace.councils?.risk?.memberOpinions ?? []
  const revenueCouncil = trace.councils?.revenue?.memberOpinions ?? []
  const customerCouncil = trace.councils?.customer?.memberOpinions ?? []
  
  const agentLatencies = [
    (riskCouncil.find((o: any) => o.agentId === "fraud")?.latencyMs   ?? 890) as number,
    (revenueCouncil.find((o: any) => o.agentId === "revenue")?.latencyMs ?? 620) as number,
    (customerCouncil.find((o: any) => o.agentId === "cx")?.latencyMs      ?? 510) as number,
  ]
  grouped.llm = Math.max(...agentLatencies)
  grouped.agents = Math.max(0, grouped.agents - grouped.llm) // avoid double count

  return grouped
}

// ─── MAIN BUILDER ─────────────────────────────────────────────

export function buildObservabilityEnvelope(trace: DecisionTrace): ObservabilityEnvelope {
  const { input, output } = estimateTraceTokens(trace)
  const total = input + output
  const costUsd = (input / 1_000_000) * COST_PER_1M_INPUT + (output / 1_000_000) * COST_PER_1M_OUTPUT

  const breakdown = buildLatencyBreakdown(trace)
  const totalMs = Object.values(breakdown).reduce((a, b) => a + b, 0)

  const bottleneck = (Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])[0][0]) as ObservabilityEnvelope["latency"]["bottleneck"]

  const mcpCallCount = trace.mcpContextSources.length
  // Estimate success rate from absence of FAILED entries in timeline
  const mcpFailed = trace.timeline.filter(e => e.type === "mcp" && e.label.includes("FAILED")).length
  const mcpSuccessRate = mcpCallCount > 0 ? (mcpCallCount - mcpFailed) / mcpCallCount : 1

  const avgMcpMs = trace.timeline
    .filter(e => e.type === "mcp")
    .reduce((a, e) => a + (e.durationMs ?? 0), 0) / Math.max(1, trace.timeline.filter(e => e.type === "mcp").length)

  const anomalies: ObservabilityEnvelope["anomalies"] = []
  if (totalMs > 5000)              anomalies.push("HIGH_LATENCY")
  if (costUsd > 0.002)             anomalies.push("HIGH_COST")
  if (mcpSuccessRate < 1)          anomalies.push("MCP_FAILURES")
  if (trace.confidence < 0.6)      anomalies.push("LOW_CONFIDENCE")

  return {
    traceId: trace.id,
    tokens: { input, output, total, costUsd },
    latency: { totalMs, breakdown, bottleneck },
    mcp: {
      toolCalls: mcpCallCount,
      successRate: mcpSuccessRate,
      avgLatencyMs: Math.round(avgMcpMs),
      toolsUsed: [...trace.mcpContextSources],
      cacheHits: trace.timeline.filter(e => e.label.includes("CACHE")).length,
    },
    anomalies,
  }
}

// ─── FORMATTER HELPERS ────────────────────────────────────────

export function formatCost(usd: number): string {
  if (usd < 0.0001) return "<$0.0001"
  return `$${usd.toFixed(4)}`
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export const ANOMALY_LABELS: Record<string, string> = {
  HIGH_LATENCY:   "⚠ High Latency",
  HIGH_COST:      "⚠ High Cost",
  MCP_FAILURES:   "⚠ MCP Failures",
  LOW_CONFIDENCE: "⚠ Low Confidence",
}
