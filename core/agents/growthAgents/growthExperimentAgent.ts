// core/agents/growthAgents/growthExperimentAgent.ts
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"
import type { AgentOpinion } from "@/core/shared/agentTypes"

export async function growthExperimentAgent(state: CommerceKnowledgeState): Promise<AgentOpinion> {
  const { campaign, catalog, revenue } = state

  const opportunity =
    campaign.untappedSegments.length > 0         ? "NEW_SEGMENT_CAMPAIGN" :
    campaign.underperformingSegments.length > 0   ? "CAMPAIGN_OPTIMIZATION" :
    catalog.rankingDrift > 0.4                    ? "AB_TEST_SEARCH_RANKING" :
    campaign.abTestsRunning < 2                   ? "LAUNCH_AB_TEST" :
                                                    "NO_ACTION"

  const expectedROI =
    opportunity === "NEW_SEGMENT_CAMPAIGN"    ? revenue.aov * 45 :
    opportunity === "CAMPAIGN_OPTIMIZATION"   ? revenue.campaignROI * 1.3 :
    opportunity === "AB_TEST_SEARCH_RANKING"  ? revenue.aov * 20 : 0

  return {
    agentId: "growthExperiment",
    recommendation: opportunity,
    confidence: 0.65,
    dataQuality: campaign.campaignPerformance != null ? 0.70 : 0.40,
    reasoning: [
      `Campaign performance: ${campaign.campaignPerformance}`,
      `Untapped segments: ${campaign.untappedSegments.join(", ") || "none"}`,
      `Underperforming segments: ${campaign.underperformingSegments.join(", ") || "none"}`,
      `A/B tests running: ${campaign.abTestsRunning}`,
      `Expected ROI: €${expectedROI.toFixed(0)}`,
    ],
    expectedOutcome: { revenueGained: expectedROI },
    urgency: "low",
    requiredActions: opportunity !== "NO_ACTION" ? [{
      type: "segment_update",
      tool: "trackCustomerEvent",
      params: {
        customerId: state.event.customerId,
        eventName: "growth_experiment_triggered",
        data: { opportunity, expectedROI },
      },
      estimatedImpact: expectedROI,
      rollbackable: true,
    }] : [],
    dataQualityFlags: [],
  }
}
