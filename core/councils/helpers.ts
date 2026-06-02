// core/councils/helpers.ts
// Shared builder for all councils

import type { AgentOpinion, ProposedAction } from "@/core/shared/agentTypes"
import type { CouncilProposal } from "./types"

export function buildCouncilProposal(
  council: CouncilProposal["council"],
  recommendation: string,
  opinions: AgentOpinion[],
  weights: Record<string, number>,
  method: CouncilProposal["consensusMethod"]
): CouncilProposal {
  // Consolidate business impact across all opinions
  const impact = opinions.reduce(
    (acc, op) => ({
      fraudPrevented:   acc.fraudPrevented   + (op.expectedOutcome.fraudPrevented   ?? 0),
      revenueProtected: acc.revenueProtected + (op.expectedOutcome.revenueProtected ?? 0),
      revenueGained:    acc.revenueGained    + (op.expectedOutcome.revenueGained    ?? 0),
      retentionGain:    Math.max(acc.retentionGain, op.expectedOutcome.retentionGain ?? 0),
      conversionUplift: Math.max(acc.conversionUplift, op.expectedOutcome.conversionUplift ?? 0),
    }),
    { fraudPrevented: 0, revenueProtected: 0, revenueGained: 0, retentionGain: 0, conversionUplift: 0 }
  )

  const totalROI = impact.fraudPrevented + impact.revenueProtected + impact.revenueGained

  // Deduplicate actions by tool+eventName
  const seen = new Set<string>()
  const proposedActions: ProposedAction[] = opinions
    .flatMap(op => op.requiredActions)
    .filter(action => {
      const key = `${action.tool}:${JSON.stringify(action.params).slice(0, 60)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  // Weighted confidence
  const confidence = opinions.reduce((sum, op) => {
    const w = weights[op.agentId] ?? (1 / opinions.length)
    return sum + op.confidence * w
  }, 0)

  return {
    council,
    recommendation,
    confidence,
    memberOpinions: opinions,
    consensusMethod: method,
    businessImpact: { ...impact, totalROI },
    proposedActions,
    influenceBreakdown: Object.fromEntries(
      opinions.map(op => [op.agentId, weights[op.agentId] ?? 0])
    ),
  }
}
