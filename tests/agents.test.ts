import { describe, it, expect } from "vitest"
import { fraudAgent } from "@/core/agents/fraudAgent"
import { revenueAgent } from "@/core/agents/revenueAgent"
import { cxAgent } from "@/core/agents/cxAgent"
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"

function createMockState(overrides: Partial<CommerceKnowledgeState> = {}): CommerceKnowledgeState {
  return {
    customer: {
      customerId: "user_test_123",
      tier: "STANDARD",
      ltv: 150,
      churnScore: 0.2,
      engagementScore: 0.8,
      purchaseFrequency: 2,
      lastPurchaseDaysAgo: 5,
      emailOpenRate: 0.45,
      supportTicketsOpen: 0,
      segments: [],
      journeyState: "browsing",
      behavioralFingerprint: {
        avgTimeBetweenEvents: 1000,
        unusualHour: false,
        deviceChangeDetected: false,
        velocityScore: 0.1,
        journeyState: "browsing",
      },
      cookieId: "cookie_abc",
    },
    revenue: {
      revenueAtRisk: 100,
      cartValue: 100,
      recoveryPotential: 15,
      campaignROI: 1.4,
      conversionRate: 0.03,
      aov: 50,
      forecastedLTV: 180,
    },
    fraud: {
      fraudScore: 0.15,
      enrichedFraudScore: 0.2,
      velocityScore: 0.1,
      deviceChangeDetected: false,
      unusualHour: false,
      signals: [],
      riskLevel: "LOW",
    },
    catalog: {
      topUnderperformingProducts: [],
      conversionByCategory: {},
      stockAlerts: [],
      trendingProducts: [],
      searchQualityScore: 0.8,
      rankingDrift: 0.02,
    },
    campaign: {
      activeCampaigns: 1,
      campaignPerformance: "on_target",
      underperformingSegments: [],
      untappedSegments: [],
      abTestsRunning: 0,
      nextBestAction: "none",
    },
    event: {
      id: "evt_123",
      type: "product_view",
      timestamp: Date.now(),
      customerId: "user_test_123",
      value: 100,
    },
    mcpToolsUsed: [],
    contextFetchLatencyMs: 5,
    stateBuiltAt: Date.now(),
    sessionThresholds: {
      fraudBlockThreshold: 0.8,
      fraudStepThreshold: 0.5,
      allowRevenueMin: 150,
    },
    sessionLedgerStats: {
      totalDecisions: 10,
      blockRate: 0.1,
      avgFraudScore: 0.2,
      avgConfidence: 0.8,
      adaptationActive: false,
    },
    ...overrides,
  }
}

describe("Fraud Agent unit tests", () => {
  it("should recommend ALLOW for low fraud scores", async () => {
    const state = createMockState({
      fraud: {
        fraudScore: 0.1,
        enrichedFraudScore: 0.15,
        velocityScore: 0.1,
        deviceChangeDetected: false,
        unusualHour: false,
        signals: [],
        riskLevel: "LOW",
      },
    })
    const opinion = await fraudAgent(state)
    expect(opinion.agentId).toBe("fraud")
    expect(opinion.recommendation).toBe("ALLOW")
    expect(opinion.confidence).toBeGreaterThan(0)
    expect(opinion.blockPayment).toBe(false)
  })

  it("should recommend BLOCK for high fraud and low LTV", async () => {
    const state = createMockState({
      customer: {
        ...createMockState().customer,
        ltv: 200,
      },
      fraud: {
        fraudScore: 0.85,
        enrichedFraudScore: 0.9,
        velocityScore: 0.8,
        deviceChangeDetected: true,
        unusualHour: true,
        signals: ["velocity_anomaly", "device_change"],
        riskLevel: "CRITICAL",
      },
    })
    const opinion = await fraudAgent(state)
    expect(opinion.recommendation).toBe("BLOCK")
    expect(opinion.blockPayment).toBe(true)
    expect(opinion.requiredActions.length).toBeGreaterThan(0)
  })

  it("should recommend STEP_UP_AUTH for medium fraud risk", async () => {
    const state = createMockState({
      fraud: {
        fraudScore: 0.55,
        enrichedFraudScore: 0.6,
        velocityScore: 0.4,
        deviceChangeDetected: false,
        unusualHour: false,
        signals: ["suspicious_volume"],
        riskLevel: "MEDIUM",
      },
    })
    const opinion = await fraudAgent(state)
    expect(opinion.recommendation).toBe("STEP_UP_AUTH")
    expect(opinion.blockPayment).toBe(false)
  })
})

describe("Revenue Agent unit tests", () => {
  it("should recommend MONITIOR or ALLOW when no revenue at risk", async () => {
    const state = createMockState({
      revenue: {
        revenueAtRisk: 0,
        cartValue: 0,
        recoveryPotential: 0,
        campaignROI: 1.0,
        conversionRate: 0.02,
        aov: 0,
        forecastedLTV: 0,
      },
    })
    const opinion = await revenueAgent(state)
    expect(opinion.agentId).toBe("revenue")
    expect(opinion.recommendation).toBe("MONITOR")
  })

  it("should recommend RECOVERY_CAMPAIGN for medium revenue at risk", async () => {
    const state = createMockState({
      revenue: {
        revenueAtRisk: 350,
        cartValue: 350,
        recoveryPotential: 50,
        campaignROI: 1.2,
        conversionRate: 0.03,
        aov: 50,
        forecastedLTV: 400,
      },
    })
    const opinion = await revenueAgent(state)
    expect(opinion.recommendation).toBe("RECOVERY_CAMPAIGN")
    expect(opinion.requiredActions[0].type).toBe("campaign_trigger")
  })

  it("should recommend PRIORITY_RECOVERY for high value VIP", async () => {
    const state = createMockState({
      customer: {
        ...createMockState().customer,
        tier: "VIP",
      },
      revenue: {
        revenueAtRisk: 600,
        cartValue: 600,
        recoveryPotential: 150,
        campaignROI: 1.5,
        conversionRate: 0.04,
        aov: 100,
        forecastedLTV: 3000,
      },
    })
    const opinion = await revenueAgent(state)
    expect(opinion.recommendation).toBe("PRIORITY_RECOVERY")
  })
})

describe("CX Agent unit tests", () => {
  it("should recommend STANDARD for low churn score", async () => {
    const state = createMockState({
      customer: {
        ...createMockState().customer,
        churnScore: 0.1,
      },
    })
    const opinion = await cxAgent(state)
    expect(opinion.agentId).toBe("cx")
    expect(opinion.recommendation).toBe("STANDARD")
    expect(opinion.churnRisk).toBe("low")
  })

  it("should recommend ESCALATE_HUMAN for VIP with high churn score", async () => {
    const state = createMockState({
      customer: {
        ...createMockState().customer,
        tier: "VIP",
        churnScore: 0.85,
      },
    })
    const opinion = await cxAgent(state)
    expect(opinion.recommendation).toBe("ESCALATE_HUMAN")
    expect(opinion.requiredActions.length).toBeGreaterThan(0)
    expect(opinion.requiredActions[0].type).toBe("human_escalation")
  })

  it("should recommend RETENTION_OFFER for medium churn score", async () => {
    const state = createMockState({
      customer: {
        ...createMockState().customer,
        churnScore: 0.5,
      },
    })
    const opinion = await cxAgent(state)
    expect(opinion.recommendation).toBe("RETENTION_OFFER")
    expect(opinion.churnRisk).toBe("medium")
  })
})
