// core/orchestration/executionPlan.ts
// V4 — Plus une décision, un plan complet avec actions ordonnées, impact et rollback

import type { CommerceKnowledgeState } from "@/core/shared/commerceState"
import type { CouncilProposal }        from "@/core/councils/types"
import type { ProposedAction }         from "@/core/shared/agentTypes"
import type {
  ExecutionAction,
  ExecutionPlan,
  BusinessImpactSummary,
  RollbackPlan,
} from "./types"

// ─── DEDUPLICATION ────────────────────────────────────────────

function deduplicateActions(actions: ExecutionAction[]): ExecutionAction[] {
  const seen = new Set<string>()
  return actions.filter(a => {
    // Key = tool + eventName ou premiers 80 chars des params
    const paramsKey = (a.params.eventName as string) ??
      JSON.stringify(a.params).slice(0, 80)
    const key = `${a.tool}:${paramsKey}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── ROLLBACK PLAN ────────────────────────────────────────────

function buildRollbackPlan(immediate: ExecutionAction[]): RollbackPlan {
  const rollbackable = immediate.filter(a => a.rollbackable)
  return {
    rollbackable: rollbackable.length > 0,
    steps: rollbackable.map(a => ({
      tool:   a.tool,
      params: { ...a.params, _rollback: true },
      reason: `Undo ${a.tool} triggered by ${a.source} council`,
    })),
    ttlSeconds: 3600, // 1h rollback window
  }
}

// ─── EXECUTIVE SUMMARY ────────────────────────────────────────

function buildExecutiveSummary(
  decision: string,
  impact: BusinessImpactSummary,
  state: CommerceKnowledgeState
): string {
  const parts: string[] = [`Decision: ${decision}`]

  if (impact.fraudPrevented   > 0) parts.push(`Fraud prevented: €${impact.fraudPrevented.toFixed(0)}`)
  if (impact.revenueProtected > 0) parts.push(`Revenue protected: €${impact.revenueProtected.toFixed(0)}`)
  if (impact.revenueGained    > 0) parts.push(`Revenue recovered: €${impact.revenueGained.toFixed(0)}`)
  if (impact.retentionGain    > 0) parts.push(`Retention gain: +${(impact.retentionGain * 100).toFixed(0)}%`)
  if (impact.conversionUplift > 0) parts.push(`Conversion uplift: +${(impact.conversionUplift * 100).toFixed(0)}%`)

  parts.push(`Total ROI: €${impact.totalROI.toFixed(0)} (${impact.roiMultiple.toFixed(0)}x cost)`)
  parts.push(`Customer: ${state.customer.tier} | Risk: ${state.fraud.riskLevel}`)

  return parts.join(" | ")
}

// ─── MAIN BUILDER ─────────────────────────────────────────────

export function buildExecutionPlan(
  primaryDecision: string,
  risk:     CouncilProposal,
  revenue:  CouncilProposal,
  customer: CouncilProposal,
  state:    CommerceKnowledgeState
): ExecutionPlan {
  // Tag each action with its source council and priority tier
  const tag = (
    actions: ProposedAction[],
    source: ExecutionAction["source"],
    priority: ExecutionAction["priority"]
  ): ExecutionAction[] =>
    actions.map(a => ({ ...a, source, priority }))

  const allTagged: ExecutionAction[] = [
    ...tag(risk.proposedActions,     "risk",     1),
    ...tag(revenue.proposedActions,  "revenue",  2),
    ...tag(customer.proposedActions, "customer", 3),
  ]

  const deduplicated = deduplicateActions(allTagged)

  // Split by time horizon
  const immediateActions = deduplicated.filter(a => a.source === "risk")
  const shortTermActions  = deduplicated.filter(a => a.source === "revenue")
  const strategicActions  = deduplicated.filter(a => a.source === "customer")

  // Business impact
  const costOfDecision = 0.0001  // feed from observability envelope in production
  const totalROI =
    risk.businessImpact.fraudPrevented +
    risk.businessImpact.revenueProtected +
    revenue.businessImpact.revenueGained +
    customer.businessImpact.revenueGained

  const impact: BusinessImpactSummary = {
    fraudPrevented:   risk.businessImpact.fraudPrevented,
    revenueProtected: risk.businessImpact.revenueProtected,
    revenueGained:    revenue.businessImpact.revenueGained + customer.businessImpact.revenueGained,
    retentionGain:    Math.max(
      risk.businessImpact.retentionGain,
      customer.businessImpact.retentionGain
    ),
    conversionUplift: revenue.businessImpact.conversionUplift,
    costOfDecision,
    totalROI,
    roiMultiple: totalROI / (costOfDecision * 1000 + 0.01),
  }

  return {
    primaryDecision,
    confidence: (risk.confidence + revenue.confidence + customer.confidence) / 3,
    immediateActions,
    shortTermActions,
    strategicActions,
    businessImpact:   impact,
    rollbackPlan:     buildRollbackPlan(immediateActions),
    executiveSummary: buildExecutiveSummary(primaryDecision, impact, state),
    executedAt:       Date.now(),
  }
}
