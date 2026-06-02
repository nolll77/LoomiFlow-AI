// core/shared/agentTypes.ts
// V4 — Les agents émettent des opinions, pas des décisions finales

export interface ProposedAction {
  type:
    | "bloomreach_write"
    | "campaign_trigger"
    | "search_update"
    | "segment_update"
    | "payment_action"
    | "human_escalation"
  tool: string
  params: Record<string, unknown>
  estimatedImpact: number   // € ou score
  rollbackable: boolean
}

export interface AgentOpinion {
  agentId: string
  recommendation: string
  confidence: number          // 0-1
  dataQuality: number         // 0-1 : qualité du contexte disponible
  reasoning: string[]         // chaîne causale lisible
  expectedOutcome: {
    fraudPrevented?: number
    revenueProtected?: number
    revenueGained?: number
    retentionGain?: number
    conversionUplift?: number
  }
  urgency: "immediate" | "high" | "medium" | "low"
  requiredActions: ProposedAction[]
  dataQualityFlags: string[]  // signaler les données manquantes
}
