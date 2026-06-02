import { describe, it, expect } from "vitest"
import { runOpinionMarket } from "@/core/orchestration/opinionMarket"
import type { CouncilProposal } from "@/core/councils/types"
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"

function createMockProposal(council: any, recommendation: string, confidence: number): CouncilProposal {
  return {
    council,
    recommendation,
    confidence,
    memberOpinions: [],
    consensusMethod: "weighted_avg",
    businessImpact: {
      fraudPrevented: 0,
      revenueProtected: 0,
      revenueGained: 0,
      retentionGain: 0,
      conversionUplift: 0,
      totalROI: 0,
    },
    proposedActions: [],
    influenceBreakdown: {},
  }
}

function createMockState(): CommerceKnowledgeState {
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
  }
}

describe("Opinion Market Unit Tests", () => {
  it("should trigger absolute VETO if Risk Council recommends BLOCK with >0.85 confidence", () => {
    const risk = createMockProposal("risk", "BLOCK", 0.9)
    const revenue = createMockProposal("revenue", "ALLOW", 0.95)
    const customer = createMockProposal("customer", "ALLOW", 0.8)
    const state = createMockState()

    const decision = runOpinionMarket(risk, revenue, customer, state)
    expect(decision.winningCouncil).toBe("risk")
    expect(decision.finalDecision).toBe("BLOCK")
    expect(decision.coalitionType).toBe("VETO")
    expect(decision.marketNarrative).toContain("VETO")
  })

  it("should classify UNANIMOUS alignment when all councils recommend the same action", () => {
    const risk = createMockProposal("risk", "ALLOW", 0.7)
    const revenue = createMockProposal("revenue", "ALLOW", 0.8)
    const customer = createMockProposal("customer", "ALLOW", 0.9)
    const state = createMockState()

    const decision = runOpinionMarket(risk, revenue, customer, state)
    expect(decision.finalDecision).toBe("ALLOW")
    expect(decision.coalitionType).toBe("UNANIMOUS")
  })

  it("should classify MAJORITY alignment when two councils agree", () => {
    const risk = createMockProposal("risk", "ALLOW", 0.7)
    const revenue = createMockProposal("revenue", "ALLOW", 0.8)
    const customer = createMockProposal("customer", "HOLD", 0.9)
    const state = createMockState()

    const decision = runOpinionMarket(risk, revenue, customer, state)
    expect(decision.coalitionType).toBe("MAJORITY")
  })

  it("should classify SPLIT alignment when all three recommendations differ", () => {
    const risk = createMockProposal("risk", "BLOCK", 0.6)
    const revenue = createMockProposal("revenue", "ALLOW", 0.7)
    const customer = createMockProposal("customer", "HOLD", 0.8)
    const state = createMockState()

    const decision = runOpinionMarket(risk, revenue, customer, state)
    expect(decision.coalitionType).toBe("SPLIT")
  })
})
