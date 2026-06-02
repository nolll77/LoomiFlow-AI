// core/councils/types.ts
import type { AgentOpinion, ProposedAction } from "@/core/shared/agentTypes"

export interface CouncilProposal {
  council: "risk" | "revenue" | "customer" | "intelligence"
  recommendation: string
  confidence: number
  memberOpinions: AgentOpinion[]
  consensusMethod: "weighted_avg" | "veto" | "utility"

  businessImpact: {
    fraudPrevented:   number
    revenueProtected: number
    revenueGained:    number
    retentionGain:    number
    conversionUplift: number
    totalROI:         number
  }

  proposedActions: ProposedAction[]
  influenceBreakdown: Record<string, number>
}
