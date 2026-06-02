import { describe, it, expect } from "vitest"
import { estimateTraceTokens, buildLatencyBreakdown, buildObservabilityEnvelope, formatCost, formatLatency, ANOMALY_LABELS } from "@/lib/observabilityEnvelope"
import type { DecisionTrace } from "@/core/shared/types"

const mockTrace = {
  id: "trace_1",
  transactionId: "evt_1",
  timeline: [
    { time: "00:00:01", label: "mcp_call_1", type: "mcp", durationMs: 120 },
    { time: "00:00:02", label: "agent_eval", type: "agent", durationMs: 890 },
  ],
  finalDecision: "ALLOW",
  confidence: 0.9,
  mcpContextSources: ["get_customer_properties"],
  reasoning: ["Allow transaction"],
  orchestrator: { finalDecision: "ALLOW", confidence: 0.9, severity: "medium", reasoning: [], actions: [] },
  agents: {
    fraud: { latencyMs: 300, confidence: 0.9, score: 0.2 },
    revenue: { latencyMs: 200, confidence: 0.85, score: 0.3 },
    cx: { latencyMs: 150, confidence: 0.78, score: 0.4 },
  },
} as unknown as DecisionTrace

describe("Observability Envelope", () => {
  it("should estimate tokens based on trace fields", () => {
    const { input, output } = estimateTraceTokens(mockTrace)
    expect(input).toBeGreaterThan(0)
    expect(output).toBeGreaterThan(0)
  })

  it("should build latency breakdown", () => {
    const breakdown = buildLatencyBreakdown(mockTrace)
    expect(breakdown.mcp).toBe(120)
    expect(breakdown.llm).toBeGreaterThan(0)
  })

  it("should assemble a full observability envelope", () => {
    const env = buildObservabilityEnvelope(mockTrace)
    expect(env.traceId).toBe("trace_1")
    expect(env.tokens.costUsd).toBeGreaterThan(0)
    expect(env.mcp.toolCalls).toBe(1)
  })

  it("should format cost properly", () => {
    expect(formatCost(0.00002)).toBe("<$0.0001")
    expect(formatCost(0.0025)).toBe("$0.0025")
  })

  it("should format latency properly", () => {
    expect(formatLatency(450)).toBe("450ms")
    expect(formatLatency(1500)).toBe("1.5s")
  })

  it("should contain correct anomaly labels mapping", () => {
    expect(ANOMALY_LABELS.HIGH_COST).toContain("High Cost")
  })
})
