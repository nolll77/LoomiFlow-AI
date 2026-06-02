// lib/scenarioSimulator.ts
// Evolution D — Predictive Scenario Simulator
// Simule les 3 décisions alternatives AVANT d'exécuter la décision réelle.
// Modèle probabiliste basé sur les scores MCP du state V4.
// Public : jurés business qui veulent comprendre POURQUOI cette décision et pas une autre.

import type { CommerceKnowledgeState } from "@/core/shared/commerceState"

// ─── TYPES ────────────────────────────────────────────────────

export interface ScenarioOutcome {
  decision:            string
  isActual:            boolean            // true = la vraie décision prise
  probability:         number             // 0-1 : proba que ce soit "le bon choix"
  expectedRevenue:     number             // € attendu
  fraudRisk:           number             // 0-1
  churnRisk:           number             // 0-1
  customerFriction:    number             // 0-1
  confidenceInterval:  [number, number]   // 90% CI sur revenue
  reasoning:           string             // phrase lisible
  verdict:             "OPTIMAL" | "RISKY" | "CONSERVATIVE" | "SUBOPTIMAL"
}

// ─── VERDICT ──────────────────────────────────────────────────

function computeVerdict(
  probability:      number,
  fraudRisk:        number,
  customerFriction: number
): ScenarioOutcome["verdict"] {
  if (probability > 0.65 && fraudRisk < 0.3)                  return "OPTIMAL"
  if (fraudRisk > 0.55)                                         return "RISKY"
  if (customerFriction > 0.6 || probability < 0.25)            return "CONSERVATIVE"
  return "SUBOPTIMAL"
}

// ─── MAIN EXPORT ──────────────────────────────────────────────

const ALL_DECISIONS = ["BLOCK", "STEP_UP_AUTH", "ALLOW", "HOLD"]

export function simulateAlternatives(
  actualDecision: string,
  state:          CommerceKnowledgeState
): ScenarioOutcome[] {
  const { fraud, revenue, customer } = state
  const fs = fraud.enrichedFraudScore

  return ALL_DECISIONS.map(decision => {
    // ── Fraud risk per decision ──────────────────────────────
    const fraudRisk =
      decision === "ALLOW"        ? fs :
      decision === "STEP_UP_AUTH" ? fs * 0.30 :
      decision === "BLOCK"        ? 0.02 :
      /* HOLD */                    fs * 0.70

    // ── Conversion probability ───────────────────────────────
    const conversionProba =
      decision === "ALLOW"        ? 0.72 :
      decision === "STEP_UP_AUTH" ? 0.55 :
      decision === "BLOCK"        ? 0.00 :
      /* HOLD */                    0.35

    // ── Expected revenue (fraud loss deducted) ───────────────
    const expectedRevenue = revenue.revenueAtRisk * conversionProba * (1 - fraudRisk * 0.8)

    // ── Churn risk ──────────────────────────────────────────
    const churnRisk =
      decision === "BLOCK" && customer.tier === "VIP"
        ? Math.min(0.95, customer.churnScore + 0.40) :
      decision === "STEP_UP_AUTH"
        ? Math.min(0.95, customer.churnScore * 1.20) :
      decision === "HOLD"
        ? Math.min(0.95, customer.churnScore * 1.50) :
      customer.churnScore

    // ── Customer friction ────────────────────────────────────
    const customerFriction =
      decision === "BLOCK"        ? 0.90 :
      decision === "STEP_UP_AUTH" ? 0.40 :
      decision === "HOLD"         ? 0.60 : 0.10

    // ── Global probability this is "the right call" ──────────
    // Naïve Bayesian: penalise fraud exposure + churn + friction
    const probability = Math.max(0.04, Math.min(0.95,
      (1 - fraudRisk)        * 0.40 +
      conversionProba        * 0.40 +
      (1 - churnRisk)        * 0.20
    ))

    // ── 90% CI (±30% variance) ──────────────────────────────
    const variance = expectedRevenue * 0.30
    const confidenceInterval: [number, number] = [
      Math.max(0, expectedRevenue - variance),
      expectedRevenue + variance,
    ]

    // ── Reasoning ────────────────────────────────────────────
    const vipWarning = customer.tier === "VIP" && decision === "BLOCK"
      ? " VIP churn risk elevated." : ""

    const reasoning =
      decision === "ALLOW"
        ? `Direct approval. Revenue: €${expectedRevenue.toFixed(0)}, but ${(fraudRisk * 100).toFixed(0)}% fraud exposure.`
        : decision === "STEP_UP_AUTH"
        ? `Auth challenge reduces fraud to ${(fraudRisk * 100).toFixed(0)}%. Revenue: €${expectedRevenue.toFixed(0)}, friction: ${(customerFriction * 100).toFixed(0)}%.`
        : decision === "BLOCK"
        ? `Full block. Zero revenue, near-zero fraud risk.${vipWarning}`
        : `Hold pending review. Revenue delayed, churn risk ${(churnRisk * 100).toFixed(0)}%.`

    return {
      decision,
      isActual:      decision === actualDecision,
      probability,
      expectedRevenue,
      fraudRisk,
      churnRisk,
      customerFriction,
      confidenceInterval,
      reasoning,
      verdict: computeVerdict(probability, fraudRisk, customerFriction),
    }
  })
  // Actual decision first, then sort alternatives by probability desc
  .sort((a, b) => {
    if (a.isActual && !b.isActual) return -1
    if (!a.isActual && b.isActual) return 1
    return b.probability - a.probability
  })
}
