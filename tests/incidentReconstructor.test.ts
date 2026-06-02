import { describe, it, expect } from "vitest"
import {
  decisionTraceToSpans,
  buildTraceDAG,
  detectAnomalies,
  findRootCause,
  reconstructChain,
  classifyIncident,
  scoreIncident,
  generateIncidentReport,
  reconstructIncidentFromTrace,
} from "@/lib/incidentReconstructor"
import type { DecisionTrace } from "@/core/shared/types"

describe("Incident Reconstructor Unit Tests", () => {
  const mockTrace: DecisionTrace = {
    id: "trace_123",
    transactionId: "trans_123",
    timestamp: Date.now(),
    timeline: [
      { time: "00:00:01", label: "COMMERCE_EVENT_RECEIVED", type: "event", durationMs: 40 },
      { time: "00:00:02", label: "MCP_CONTEXT_FETCH_FAILED", type: "mcp", durationMs: 2500 },
      { time: "00:00:03", label: "ALL_AGENTS_COMPLETE", type: "agent", durationMs: 800 },
      { time: "00:00:04", label: "FINAL_DECISION: BLOCK", type: "decision", durationMs: 50 },
    ],
    finalDecision: "BLOCK",
    confidence: 0.85,
    mcpContextSources: [],
    writeActions: [],
    agents: {
      fraud: { latencyMs: 900 } as any,
      revenue: { latencyMs: 600 } as any,
      cx: { latencyMs: 500 } as any,
    },
    orchestrator: { finalDecision: "BLOCK" } as any,
    consensusWeights: { fraud: 0.6, revenue: 0.25, cx: 0.15 },
    reasoning: [],
  }

  it("should convert a trace to span nodes", () => {
    const spans = decisionTraceToSpans(mockTrace)
    expect(spans.length).toBe(7) // 4 timeline + 3 synthetic agent spans
    expect(spans[0].name).toBe("commerce_event_received")
    expect(spans[1].status).toBe("ERROR") // label includes FAILED
  })

  it("should build trace DAG successfully", () => {
    const spans = decisionTraceToSpans(mockTrace)
    const dag = buildTraceDAG(spans)
    expect(dag.has("root")).toBe(true)
  })

  it("should detect anomalies when errors or high latency exist", () => {
    const spans = decisionTraceToSpans(mockTrace)
    const anomalies = detectAnomalies(spans)
    expect(anomalies.length).toBeGreaterThan(0)
    expect(anomalies[0].name).toBe("mcp_context_fetch_failed")
  })

  it("should classify incident, score it, and generate reports", () => {
    const spans = decisionTraceToSpans(mockTrace)
    const rootCause = findRootCause(spans)
    expect(rootCause).not.toBeNull()
    expect(rootCause?.name).toBe("mcp_context_fetch_failed")

    const chain = reconstructChain(spans, rootCause)
    const incidentType = classifyIncident(chain)
    expect(incidentType).toBe("UNKNOWN")

    const score = scoreIncident(chain)
    expect(score).toBeGreaterThan(0)

    const report = generateIncidentReport(spans, "trace_123")
    expect(report.id).toBe("incident_trace_123")
    expect(report.severity).toBe(score)
  })

  it("should return null for trace without anomalies and low latency", () => {
    const normalTrace: DecisionTrace = {
      ...mockTrace,
      timeline: [
        { time: "00:00:01", label: "EVENT_OK", type: "event", durationMs: 20 },
      ],
      agents: {
        fraud: { latencyMs: 10 } as any,
        revenue: { latencyMs: 10 } as any,
        cx: { latencyMs: 10 } as any,
      },
    }
    const report = reconstructIncidentFromTrace(normalTrace)
    expect(report).toBeNull()
  })

  it("should reconstruct incident from trace with anomalies", () => {
    const report = reconstructIncidentFromTrace(mockTrace)
    expect(report).not.toBeNull()
    expect(report?.type).toBeDefined()
  })
})
