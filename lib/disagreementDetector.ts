// lib/disagreementDetector.ts
// Evolution C — Agent Disagreement Detector
// Détecte et quantifie les tensions entre agents V4 (AgentOpinion).
// Plus la confiance des deux agents est haute ET leurs recommandations opposées,
// plus le tensionScore est élevé.

import type { AgentOpinion } from "@/core/shared/agentTypes"

// ─── TYPES ────────────────────────────────────────────────────

export interface AgentDisagreement {
  severity:          "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  agents:            string[]
  recommendations:   string[]
  confidences:       number[]
  tensionScore:      number    // 0-1 : divergence × confiance croisée
  businessStake:     number    // € estimé en jeu
  narrativeConflict: string    // phrase lisible pour les jurés
}

// ─── OPPOSITION MAP ───────────────────────────────────────────
// Paires de recommandations considérées comme opposées.
// Le premier de chaque paire est le "dominant safety" signal.

const OPPOSITES: [string, string][] = [
  ["BLOCK",          "ALLOW"],
  ["BLOCK",          "PRIORITY_RECOVERY"],
  ["BLOCK",          "RECOVERY_CAMPAIGN"],
  ["STEP_UP_AUTH",   "ALLOW"],
  ["STEP_UP_AUTH",   "PRIORITY_RECOVERY"],
  ["ESCALATE_HUMAN", "STANDARD"],
  ["HOLD",           "ALLOW"],
]

function isOpposed(a: string, b: string): boolean {
  return OPPOSITES.some(([x, y]) =>
    (a === x && b === y) || (a === y && b === x)
  )
}

// ─── NARRATIVE TEMPLATES ──────────────────────────────────────

function buildNarrative(
  a: AgentOpinion,
  b: AgentOpinion,
  stake: number
): string {
  const key = [a.recommendation, b.recommendation].sort().join("_")

  const templates: Record<string, string> = {
    "ALLOW_BLOCK":
      `${a.agentId} wants to block (fraud signal), ${b.agentId} wants to allow (revenue recovery). €${stake.toFixed(0)} at stake.`,
    "ALLOW_STEP_UP_AUTH":
      `${a.agentId} requires step-up authentication, ${b.agentId} wants immediate approval. VIP friction risk.`,
    "ALLOW_HOLD":
      `${a.agentId} placed a hold, ${b.agentId} wants to allow immediately. Timing is critical.`,
    "BLOCK_PRIORITY_RECOVERY":
      `${a.agentId} wants to block, ${b.agentId} sees a recovery opportunity. Revenue vs safety tradeoff.`,
    "BLOCK_RECOVERY_CAMPAIGN":
      `${a.agentId} wants to block the transaction, ${b.agentId} wants to launch a recovery campaign.`,
    "ESCALATE_HUMAN_STANDARD":
      `${a.agentId} escalates to human review, ${b.agentId} sees a standard case. Judgment call required.`,
    "PRIORITY_RECOVERY_STEP_UP_AUTH":
      `${a.agentId} pushes for revenue recovery, ${b.agentId} requires additional authentication first.`,
  }

  return (
    templates[key] ??
    `${a.agentId} recommends ${a.recommendation} (${(a.confidence * 100).toFixed(0)}% conf), ` +
    `${b.agentId} recommends ${b.recommendation} (${(b.confidence * 100).toFixed(0)}% conf).`
  )
}

// ─── MAIN EXPORT ──────────────────────────────────────────────

export function detectDisagreements(
  opinions:     AgentOpinion[],
  revenueAtRisk: number,
  customerLtv:   number
): AgentDisagreement[] {
  const disagreements: AgentDisagreement[] = []

  // Exclude non-actionable opinions
  const active = opinions.filter(
    o => o.recommendation !== "NOT_APPLICABLE" && o.recommendation !== "NO_ACTION"
  )

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]

      if (a.recommendation === b.recommendation) continue

      const opposed = isOpposed(a.recommendation, b.recommendation)

      // Tension = product of confidences, amplified if directly opposed
      const tensionScore = a.confidence * b.confidence * (opposed ? 1.0 : 0.45)
      if (tensionScore < 0.12) continue   // below noise floor

      const severity: AgentDisagreement["severity"] =
        tensionScore > 0.70 ? "CRITICAL" :
        tensionScore > 0.45 ? "HIGH"     :
        tensionScore > 0.25 ? "MEDIUM"   : "LOW"

      const businessStake = revenueAtRisk + customerLtv * 0.1

      disagreements.push({
        severity,
        agents:            [a.agentId, b.agentId],
        recommendations:   [a.recommendation, b.recommendation],
        confidences:       [a.confidence, b.confidence],
        tensionScore,
        businessStake,
        narrativeConflict: buildNarrative(a, b, businessStake),
      })
    }
  }

  // Highest tension first
  return disagreements.sort((a, b) => b.tensionScore - a.tensionScore)
}

// ─── HELPER — extract opinions from a V4 trace ────────────────
// Rassemble les memberOpinions des 3 councils en une liste plate,
// en dédupliquant par agentId.

export function extractOpinionsFromTrace(trace: {
  councils?: Record<string, { memberOpinions: AgentOpinion[] }>
}): AgentOpinion[] {
  if (!trace.councils) return []

  const seen = new Set<string>()
  const result: AgentOpinion[] = []

  for (const council of Object.values(trace.councils)) {
    for (const opinion of council.memberOpinions ?? []) {
      if (!seen.has(opinion.agentId)) {
        seen.add(opinion.agentId)
        result.push(opinion)
      }
    }
  }

  return result
}
