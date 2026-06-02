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
  // ────────────────────────────────────────────────────────
  // V4 NATIVE FIELDS
  // ────────────────────────────────────────────────────────
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

  // ────────────────────────────────────────────────────────
  // BACKWARD COMPAT FIELDS (V3 UI components read these)
  // These are populated by V4 agents to bridge old UI code
  // ────────────────────────────────────────────────────────
  agentName?: string          // Legacy: alias for agentId (for DecisionDebugger, AgentGrid)
  score?: number              // Legacy: alias for confidence (for ElectricBeams visualization)
  reasons?: string[]          // Legacy: alias for reasoning (for AgentGrid)
  
  // Fraud Agent specific (fraudAgent outputs these)
  fraudScore?: number         // Score 0-1 specific to fraud detection
  signals?: string[]          // Fraud signals detected
  blockPayment?: boolean      // Quick indicator
  
  // Revenue Agent specific (revenueAgent outputs these)
  customerLTV?: number        // Customer lifetime value
  revenueAtRisk?: number      // € value at immediate risk
  discountRecommendation?: string
  revenueRecoveryProbability?: number
  priority?: "critical" | "high" | "medium" | "low"
  
  // CX Agent specific (cxAgent outputs these)
  churnRisk?: "low" | "medium" | "high"
  friction?: number           // 0-1 customer friction score
  retentionProbability?: number
  
  // Common observability fields
  latencyMs?: number          // Measured execution time
  mcpSourcesUsed?: string[]   // Which MCP tools were queried
}
