// core/agents/growthAgents/personalShopperAgent.ts
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"
import type { AgentOpinion } from "@/core/shared/agentTypes"

export async function personalShopperAgent(state: CommerceKnowledgeState): Promise<AgentOpinion> {
  const { customer, revenue, catalog } = state

  const recommendationType =
    customer.tier === "VIP" && revenue.aov > 200  ? "PREMIUM_BUNDLE" :
    customer.journeyState === "evaluating"         ? "COMPARISON_ASSIST" :
    customer.journeyState === "converting"         ? "UPSELL_AT_CHECKOUT" :
    catalog.trendingProducts.length > 0            ? "TRENDING_PERSONALIZED" :
                                                     "AFFINITY_BASED"

  const basketUplift =
    recommendationType === "PREMIUM_BUNDLE"         ? revenue.aov * 0.35 :
    recommendationType === "UPSELL_AT_CHECKOUT"     ? revenue.aov * 0.20 :
    recommendationType === "TRENDING_PERSONALIZED"  ? revenue.aov * 0.12 : 0

  return {
    agentId: "personalShopper",
    recommendation: basketUplift > 0 ? recommendationType : "NO_ACTION",
    confidence: customer.segments.length > 0 ? 0.76 : 0.50,
    dataQuality: customer.segments.length > 2 ? 0.85 : 0.55,
    reasoning: [
      `Customer tier: ${customer.tier}`,
      `Journey: ${customer.journeyState}`,
      `Recommendation type: ${recommendationType}`,
      `Expected basket uplift: €${basketUplift.toFixed(0)}`,
      `Segments: ${customer.segments.slice(0, 3).join(", ") || "none"}`,
    ],
    expectedOutcome: { revenueGained: basketUplift },
    urgency: customer.journeyState === "converting" ? "immediate" : "low",
    requiredActions: basketUplift > 0 ? [{
      type: "campaign_trigger",
      tool: "trackCustomerEvent",
      params: {
        customerId: state.event.customerId,
        eventName: "personal_shopper_recommendation",
        data: { type: recommendationType, expectedUplift: basketUplift },
      },
      estimatedImpact: basketUplift,
      rollbackable: false,
    }] : [],
    dataQualityFlags: customer.segments.length === 0 ? ["NO_CUSTOMER_SEGMENTS"] : [],
  }
}
