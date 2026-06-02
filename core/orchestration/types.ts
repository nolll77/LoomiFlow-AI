// core/orchestration/types.ts
// V4 Orchestration types — shared between opinionMarket and executionPlan

import type { ProposedAction } from "@/core/shared/agentTypes"

// ─── EXECUTION ACTION (ProposedAction + runtime source) ───────

export interface ExecutionAction extends ProposedAction {
  source:   "risk" | "revenue" | "customer"
  priority: 1 | 2 | 3   // 1=immediate, 2=shortTerm, 3=strategic
}

// ─── ROLLBACK PLAN ────────────────────────────────────────────

export interface RollbackStep {
  tool:      string
  params:    Record<string, unknown>
  reason:    string
}

export interface RollbackPlan {
  rollbackable:   boolean
  steps:          RollbackStep[]
  ttlSeconds:     number   // fenêtre de rollback
}

// ─── BUSINESS IMPACT ──────────────────────────────────────────

export interface BusinessImpactSummary {
  fraudPrevented:   number
  revenueProtected: number
  revenueGained:    number
  retentionGain:    number   // %
  conversionUplift: number   // %
  costOfDecision:   number   // $ tokens
  totalROI:         number   // € net
  roiMultiple:      number   // totalROI / costOfDecision
}

// ─── EXECUTION PLAN ───────────────────────────────────────────

export interface ExecutionPlan {
  primaryDecision:  string
  confidence:       number
  immediateActions: ExecutionAction[]
  shortTermActions: ExecutionAction[]
  strategicActions: ExecutionAction[]
  businessImpact:   BusinessImpactSummary
  rollbackPlan:     RollbackPlan
  executiveSummary: string
  executedAt:       number
}

// ─── MARKET DECISION ──────────────────────────────────────────

export interface MarketDecision {
  winningCouncil:  string
  finalDecision:   string
  utilityScores:   Record<string, number>
  confidence:      number
  executionPlan:   ExecutionPlan
  marketNarrative: string
  coalitionType:   "UNANIMOUS" | "MAJORITY" | "SPLIT" | "VETO"
}

