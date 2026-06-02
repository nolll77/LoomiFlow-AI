// lib/narrativeEngine.ts
// Commerce Narrative Engine — V4
// Génère un paragraphe en langage naturel après chaque décision.
// Public cible : jurés business, pas les développeurs.

import type { MarketDecision }       from "@/core/orchestration/types"
import type { BusinessImpactSummary } from "@/core/orchestration/types"
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"

// ─── HELPERS ──────────────────────────────────────────────────

function customerDesc(state: CommerceKnowledgeState): string {
  const tier = state.customer.tier
  if (tier === "VIP")     return "a VIP customer"
  if (tier === "PREMIUM") return "a premium customer"
  if (tier === "NEW")     return "a new customer"
  return "a customer"
}

function eventDesc(state: CommerceKnowledgeState): string {
  switch (state.event.type) {
    case "payment_failed":    return "a failed payment"
    case "cart_abandonment":  return "an abandoned cart"
    case "fraud_detected":    return "a fraud signal"
    case "vip_at_risk":       return "a VIP risk signal"
    case "checkout_initiated":return "a checkout event"
    case "conversion_anomaly":return "a conversion anomaly"
    default:                  return "a commerce event"
  }
}

function fraudDesc(state: CommerceKnowledgeState): string {
  const score = state.fraud.enrichedFraudScore ?? state.fraud.fraudScore ?? 0
  const pct   = (score * 100).toFixed(0)
  if (score > 0.70) return `a high fraud risk (${pct}%)`
  if (score > 0.40) return `a moderate fraud risk (${pct}%)`
  return `a low fraud risk (${pct}%)`
}

function outcomeDesc(
  decision: string,
  state:    CommerceKnowledgeState,
  impact:   BusinessImpactSummary
): string {
  switch (decision) {
    case "BLOCK":
      return `The system blocked the transaction to prevent €${impact.fraudPrevented.toFixed(0)} in potential losses.`

    case "STEP_UP_AUTH":
      return `The system triggered step-up authentication to protect €${state.revenue.revenueAtRisk.toFixed(0)} in revenue while preserving the customer relationship.`

    case "ALLOW":
      return impact.revenueGained > 0
        ? `The system approved the transaction and launched a recovery campaign with €${impact.revenueGained.toFixed(0)} expected recovery.`
        : `The system approved the transaction and monitored for follow-up signals.`

    case "RECOVERY_CAMPAIGN":
    case "PRIORITY_RECOVERY":
      return `The system launched a targeted recovery campaign with €${impact.revenueGained.toFixed(0)} in expected recovery value.`

    case "VIP_OUTREACH":
    case "ESCALATE_HUMAN":
      return `The system escalated to VIP outreach to prevent an estimated €${(state.customer.ltv * 0.3).toFixed(0)} in LTV erosion.`

    case "RETENTION_OFFER":
      return `The system triggered a personalized retention offer, targeting a ${(impact.retentionGain * 100).toFixed(0)}% improvement in retention probability.`

    case "HOLD":
      return `The system placed the transaction on hold pending additional context signals.`

    default:
      return `The system processed the event and issued decision: ${decision}.`
  }
}

function councilDesc(winningCouncil: string): string {
  switch (winningCouncil) {
    case "risk":     return "The Risk Council drove this decision"
    case "revenue":  return "The Revenue Council drove this decision"
    case "customer": return "The Customer Council drove this decision"
    default:         return "The orchestration system drove this decision"
  }
}

function roiDesc(impact: BusinessImpactSummary): string {
  if (impact.totalROI <= 0) return ""
  const cost = impact.costOfDecision.toFixed(4)
  const roi  = impact.roiMultiple > 9999
    ? ">9,999x"
    : `${impact.roiMultiple.toFixed(0)}x`
  return `Total value created: €${impact.totalROI.toFixed(0)} at a compute cost of $${cost} (${roi} ROI).`
}

// ─── MAIN EXPORT ──────────────────────────────────────────────

export function generateDecisionNarrative(
  market: MarketDecision,
  state:  CommerceKnowledgeState,
  impact: BusinessImpactSummary
): string {
  const decision   = market.finalDecision
  const confidence = (market.confidence * 100).toFixed(0)
  const ltv        = state.customer.ltv.toFixed(0)

  const parts = [
    `LoomiFlow detected ${eventDesc(state)} for ${customerDesc(state)} (LTV: €${ltv}) with ${fraudDesc(state)}.`,
    outcomeDesc(decision, state, impact),
    `${councilDesc(market.winningCouncil)} with ${confidence}% confidence.`,
    roiDesc(impact),
  ]

  return parts.filter(Boolean).join(" ").trim()
}
