// core/councils/customerCouncil.ts
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"
import type { CouncilProposal } from "./types"
import { buildCouncilProposal } from "./helpers"
import { cxAgent }              from "@/core/agents/cxAgent"
import { retentionAgent }       from "@/core/agents/growthAgents/retentionAgent"
import { personalShopperAgent } from "@/core/agents/growthAgents/personalShopperAgent"

export async function customerCouncil(state: CommerceKnowledgeState): Promise<CouncilProposal> {
  const [cxOp, retentionOp, shoppingOp] = await Promise.all([
    cxAgent(state),
    retentionAgent(state),
    personalShopperAgent(state),
  ])

  // Priorité : protéger l'expérience avant de vendre
  const primaryRecommendation =
    cxOp.urgency === "immediate"                    ? cxOp.recommendation :
    retentionOp.recommendation !== "NO_ACTION"      ? retentionOp.recommendation :
    shoppingOp.recommendation !== "NO_ACTION"       ? shoppingOp.recommendation :
    "STANDARD_EXPERIENCE"

  // N'ajouter le shopper que si le client n'est pas en churn critique
  const shoppingActions = state.customer.churnScore < 0.75
    ? shoppingOp.requiredActions
    : []

  const revenueGained =
    (shoppingOp.expectedOutcome.revenueGained ?? 0) +
    (retentionOp.expectedOutcome.revenueGained ?? 0)

  const w = { cx: 0.50, retention: 0.30, personalShopper: 0.20 }

  return {
    council: "customer",
    recommendation: primaryRecommendation,
    confidence: (cxOp.confidence + retentionOp.confidence + shoppingOp.confidence) / 3,
    memberOpinions: [cxOp, retentionOp, shoppingOp],
    consensusMethod: "weighted_avg",
    businessImpact: {
      fraudPrevented:   0,
      revenueProtected: 0,
      revenueGained,
      retentionGain:    Math.max(
        cxOp.expectedOutcome.retentionGain  ?? 0,
        retentionOp.expectedOutcome.retentionGain ?? 0
      ),
      conversionUplift: 0,
      totalROI:         revenueGained,
    },
    proposedActions: [
      ...cxOp.requiredActions,
      ...retentionOp.requiredActions,
      ...shoppingActions,
    ],
    influenceBreakdown: {
      cx:              cxOp.confidence      * w.cx,
      retention:       retentionOp.confidence * w.retention,
      personalShopper: shoppingOp.confidence  * w.personalShopper,
    },
  }
}
