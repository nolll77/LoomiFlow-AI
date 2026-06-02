// core/agents/growthAgents/retentionAgent.ts
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"
import type { AgentOpinion } from "@/core/shared/agentTypes"

export async function retentionAgent(state: CommerceKnowledgeState): Promise<AgentOpinion> {
  const { customer, revenue } = state

  const ltvAtRisk = revenue.forecastedLTV * customer.churnScore

  const intervention =
    ltvAtRisk > 1000               ? "LOYALTY_REACTIVATION_PREMIUM" :
    ltvAtRisk > 500                 ? "PERSONALIZED_INCENTIVE" :
    customer.purchaseFrequency < 0.5 ? "RE_ENGAGEMENT_CAMPAIGN" :
                                       "STANDARD_NEWSLETTER"

  const actionWorthy = ltvAtRisk > 200

  return {
    agentId: "retention",
    recommendation: actionWorthy ? intervention : "NO_ACTION",
    confidence: 0.71,
    dataQuality: customer.churnScore != null && customer.purchaseFrequency != null ? 0.80 : 0.45,
    reasoning: [
      `LTV at risk: €${ltvAtRisk.toFixed(0)} (LTV: €${revenue.forecastedLTV} × churn: ${customer.churnScore.toFixed(2)})`,
      `Purchase frequency: ${customer.purchaseFrequency.toFixed(2)}/month`,
      `Last purchase: ${customer.lastPurchaseDaysAgo} days ago`,
      `Email open rate: ${(customer.emailOpenRate * 100).toFixed(0)}%`,
    ],
    expectedOutcome: {
      retentionGain:  actionWorthy ? 0.18 : 0,
      revenueGained:  actionWorthy ? ltvAtRisk * 0.35 : 0,
    },
    urgency: ltvAtRisk > 500 ? "high" : "medium",
    requiredActions: actionWorthy ? [{
      type: "segment_update",
      tool: "updateCustomerProperty",
      params: {
        customerId: state.event.customerId,
        props: { retention_intervention: intervention, churn_alert: true },
      },
      estimatedImpact: ltvAtRisk * 0.35,
      rollbackable: true,
    }] : [],
    dataQualityFlags: customer.churnScore == null ? ["MISSING_CHURN_SCORE"] : [],
  }
}
