// core/councils/revenueCouncil.ts
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"
import type { CouncilProposal } from "./types"
import { buildCouncilProposal } from "./helpers"
import { recoveryAgent }         from "@/core/agents/growthAgents/recoveryAgent"
import { retentionAgent }        from "@/core/agents/growthAgents/retentionAgent"
import { growthExperimentAgent } from "@/core/agents/growthAgents/growthExperimentAgent"

export async function revenueCouncil(state: CommerceKnowledgeState): Promise<CouncilProposal> {
  const [recoveryOp, retentionOp, growthOp] = await Promise.all([
    recoveryAgent(state),
    retentionAgent(state),
    growthExperimentAgent(state),
  ])

  const all = [recoveryOp, retentionOp, growthOp]

  // Candidats actifs triés par ROI attendu
  const candidates = all
    .filter(op => op.recommendation !== "NOT_APPLICABLE" && op.recommendation !== "NO_ACTION")
    .sort((a, b) => (b.expectedOutcome.revenueGained ?? 0) - (a.expectedOutcome.revenueGained ?? 0))

  if (candidates.length === 0) {
    return buildCouncilProposal(
      "revenue", "MONITOR", all,
      { recovery: 0.5, retention: 0.3, growthExperiment: 0.2 },
      "utility"
    )
  }

  // Actions : primary + secondaires si ROI > 50€
  const additionalActions = candidates
    .slice(1)
    .filter(op => (op.expectedOutcome.revenueGained ?? 0) > 50)
    .flatMap(op => op.requiredActions)

  const totalROI = candidates.reduce(
    (sum, op) => sum + (op.expectedOutcome.revenueGained ?? 0), 0
  )

  return {
    council: "revenue",
    recommendation: candidates[0].recommendation,
    confidence: candidates[0].confidence,
    memberOpinions: all,
    consensusMethod: "utility",
    businessImpact: {
      fraudPrevented:   0,
      revenueProtected: 0,
      revenueGained:    totalROI,
      retentionGain:    retentionOp.expectedOutcome.retentionGain ?? 0,
      conversionUplift: growthOp.expectedOutcome.conversionUplift ?? 0,
      totalROI,
    },
    proposedActions: [
      ...candidates[0].requiredActions,
      ...additionalActions,
    ],
    influenceBreakdown: {
      recovery:         candidates.find(c => c.agentId === "recovery")?.confidence         ?? 0,
      retention:        candidates.find(c => c.agentId === "retention")?.confidence        ?? 0,
      growthExperiment: candidates.find(c => c.agentId === "growthExperiment")?.confidence ?? 0,
    },
  }
}
