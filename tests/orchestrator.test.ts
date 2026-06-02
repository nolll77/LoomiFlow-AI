import { describe, it, expect, vi } from "vitest"
import {
  computeDynamicWeights,
  runMockOrchestrator,
  runOrchestrator,
  runPipelineV4,
} from "@/core/agents/orchestrator"
import type { CommerceEvent } from "@/core/shared/types"

describe("Orchestrator Unit Tests", () => {
  const mockFraud = {
    agentName: "fraud",
    score: 0.8,
    fraudScore: 0.8,
    dataQuality: 0.9,
    confidence: 0.95,
    recommendation: "BLOCK",
    signals: ["velocity_anomaly"],
    reasons: ["velocity_anomaly"],
    blockPayment: true,
    mcpSourcesUsed: [],
    latencyMs: 10,
  }

  const mockRevenue = {
    agentName: "revenue",
    score: 0.5,
    dataQuality: 0.8,
    confidence: 0.9,
    recommendation: "PRIORITY_RECOVERY",
    customerLTV: 200,
    revenueAtRisk: 350,
    discountRecommendation: "10% coupon",
    reasons: [],
    blockPayment: false,
    latencyMs: 15,
  }

  const mockCx = {
    agentName: "cx",
    score: 0.6,
    dataQuality: 0.7,
    confidence: 0.85,
    recommendation: "RETENTION_OFFER",
    churnRisk: "medium" as const,
    escalateToSupport: true,
    customerMessage: "Please check your transaction.",
    reasons: [],
    latencyMs: 8,
  }

  it("should compute dynamic weights correctly based on quality and confidence", () => {
    const weights = computeDynamicWeights(mockFraud as any, mockRevenue as any, mockCx as any)
    expect(weights.fraud).toBeGreaterThan(0)
    expect(weights.revenue).toBeGreaterThan(0)
    expect(weights.cx).toBeGreaterThan(0)
    expect(weights.fraud + weights.revenue + weights.cx).toBeCloseTo(1, 2)
  })

  it("should return base weights if total is 0", () => {
    const badFraud = { ...mockFraud, dataQuality: 0, confidence: 0 }
    const badRevenue = { ...mockRevenue, dataQuality: 0, confidence: 0 }
    const badCx = { ...mockCx, dataQuality: 0, confidence: 0 }
    const weights = computeDynamicWeights(badFraud as any, badRevenue as any, badCx as any)
    expect(weights.fraud).toBe(0.62)
    expect(weights.revenue).toBe(0.23)
  })

  it("should block for high fraud and low LTV in mock orchestrator", () => {
    const decision = runMockOrchestrator(
      { ...mockFraud, fraudScore: 0.9 } as any,
      { ...mockRevenue, customerLTV: 200 } as any,
      mockCx as any
    )
    expect(decision.finalDecision).toBe("BLOCK")
    expect(decision.tradeoffResolved).toBe("fraud_safety_over_revenue")
    expect(decision.actions).toContain("Block transaction")
  })

  it("should request step-up auth for VIP with high LTV and fraud", () => {
    const decision = runMockOrchestrator(
      { ...mockFraud, fraudScore: 0.85 } as any,
      { ...mockRevenue, customerLTV: 1500 } as any,
      mockCx as any
    )
    expect(decision.finalDecision).toBe("STEP_UP_AUTH")
    expect(decision.tradeoffResolved).toBe("revenue_cx_over_fraud_block")
  })

  it("should allow with discount recommendation for low fraud, high revenue", () => {
    const decision = runMockOrchestrator(
      { ...mockFraud, fraudScore: 0.1 } as any,
      { ...mockRevenue, revenueAtRisk: 300, discountRecommendation: "10% coupon" } as any,
      mockCx as any
    )
    expect(decision.finalDecision).toBe("ALLOW")
    expect(decision.actions).toContain("Apply 10% coupon goodwill discount")
  })

  it("should fall back to hold for mixed signals", () => {
    const decision = runMockOrchestrator(
      { ...mockFraud, fraudScore: 0.45 } as any,
      { ...mockRevenue, customerLTV: 600, revenueAtRisk: 50 } as any,
      mockCx as any
    )
    expect(decision.finalDecision).toBe("HOLD")
  })

  it("should runOrchestrator and return mock decisions", async () => {
    const decision = await runOrchestrator({} as any, null, mockFraud as any, mockRevenue as any, mockCx as any, false)
    expect(decision.finalDecision).toBeDefined()
  })

  it("should runPipelineV4 successfully", async () => {
    const event: CommerceEvent = {
      id: "evt_test",
      type: "checkout",
      timestamp: Date.now(),
      customerId: "cust_123",
      value: 150,
    }

    const trace = await runPipelineV4(event)
    expect(trace.id).toBeDefined()
    expect(trace.finalDecision).toBeDefined()
    expect(trace.councils).toBeDefined()
    expect(trace.marketDecision).toBeDefined()
  })
})
