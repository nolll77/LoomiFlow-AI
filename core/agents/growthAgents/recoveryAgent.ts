// core/agents/growthAgents/recoveryAgent.ts
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"
import type { AgentOpinion } from "@/core/shared/agentTypes"
import { nullOpinion } from "./helpers"

export async function recoveryAgent(state: CommerceKnowledgeState): Promise<AgentOpinion> {
  const { revenue, customer, event } = state

  if (!["payment_failed", "cart_abandonment"].includes(event.type)) {
    return nullOpinion("recovery", "NOT_APPLICABLE")
  }

  const strategy =
    customer.tier === "VIP"             ? "RETRY_WITH_PRIORITY_LINK" :
    revenue.revenueAtRisk > 300         ? "RETRY_WITH_DISCOUNT" :
    customer.emailOpenRate > 0.5        ? "EMAIL_RETRY_LINK" :
                                          "SMS_SHORT_LINK"

  const discountAmount =
    revenue.revenueAtRisk > 500 ? 15 :
    revenue.revenueAtRisk > 200 ? 10 : 5

  const estimatedRecovery = revenue.revenueAtRisk *
    (strategy === "RETRY_WITH_DISCOUNT" ? 0.58 : 0.42)

  return {
    agentId: "recovery",
    recommendation: strategy,
    confidence: 0.75,
    dataQuality: 0.85,
    reasoning: [
      `Event: ${event.type}`,
      `Strategy: ${strategy}`,
      `Discount offer: ${discountAmount}%`,
      `Estimated recovery: €${estimatedRecovery.toFixed(0)}`,
      `Email open rate: ${(customer.emailOpenRate * 100).toFixed(0)}%`,
    ],
    expectedOutcome: { revenueGained: estimatedRecovery },
    urgency: "high",
    requiredActions: [{
      type: "campaign_trigger",
      tool: "trackCustomerEvent",
      params: {
        customerId: event.customerId,
        eventName: "recovery_campaign_triggered",
        data: { strategy, discountAmount, estimatedRecovery },
      },
      estimatedImpact: estimatedRecovery,
      rollbackable: false,
    }],
    dataQualityFlags: [],
  }
}
