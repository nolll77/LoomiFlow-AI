// lib/commercePulse.ts
// Evolution E — Autonomous Commerce Pulse
// Calcule un score de santé global du commerce (0-100) depuis l'état V4 courant
// et l'historique des traces récentes. Mis à jour à chaque décision.

import type { CommerceKnowledgeState } from "@/core/shared/commerceState"
import type { DecisionTrace }           from "@/core/shared/types"

// ─── TYPES ────────────────────────────────────────────────────

export interface CommercePulse {
  score:    number                          // 0-100
  trend:    "IMPROVING" | "STABLE" | "DECLINING" | "CRITICAL"
  components: {
    fraudHealth:       number               // 100 = zéro fraude
    revenueHealth:     number               // 100 = conversion parfaite
    customerHealth:    number               // 100 = churn zéro
    operationalHealth: number               // 100 = SLO respectés
  }
  alerts:        string[]
  lastUpdatedAt: number
}

// ─── ROLLING HISTORY (in-memory, session) ─────────────────────

const pulseHistory: Array<{ score: number; ts: number }> = []
const MAX_HISTORY = 50

// ─── HELPERS ──────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)))
}

function avgFraudFromTraces(traces: DecisionTrace[]): number {
  const recent = traces.slice(-10)
  if (recent.length === 0) return 0.3
  const sum = recent.reduce((acc, t) => {
    // V4 path: councils.risk.memberOpinions[fraud].fraudScore
    const councils = (t as any).councils as
      Record<string, { memberOpinions: Array<{ agentId: string; fraudScore?: number; confidence?: number }> }> | undefined
    const fraudOp = councils?.risk?.memberOpinions?.find(o => o.agentId === "fraud")
    const score   = fraudOp?.fraudScore ?? fraudOp?.confidence ?? (t.agents as any)?.fraud?.fraudScore ?? 0.3
    return acc + score
  }, 0)
  return sum / recent.length
}

function blockRateFromTraces(traces: DecisionTrace[]): number {
  if (traces.length === 0) return 0
  return traces.filter(t => t.finalDecision === "BLOCK").length / traces.length
}

function avgLatencyFromTraces(traces: DecisionTrace[]): number {
  const recent = traces.slice(-5)
  if (recent.length === 0) return 1200
  const sum = recent.reduce((acc, t) =>
    acc + (t.observability?.latency?.totalMs ?? 1400), 0)
  return sum / recent.length
}

// ─── TREND ────────────────────────────────────────────────────

function computeTrend(score: number): CommercePulse["trend"] {
  if (pulseHistory.length < 5) return "STABLE"
  if (score < 35) return "CRITICAL"

  const prev5 = pulseHistory.slice(-10, -5)
  const last5  = pulseHistory.slice(-5)
  if (prev5.length < 3) return "STABLE"

  const prevAvg = prev5.reduce((s, p) => s + p.score, 0) / prev5.length
  const lastAvg = last5.reduce((s, p) => s + p.score, 0) / last5.length

  if (lastAvg > prevAvg + 4) return "IMPROVING"
  if (lastAvg < prevAvg - 4) return "DECLINING"
  return "STABLE"
}

// ─── MAIN EXPORT ──────────────────────────────────────────────

export function computeCommercePulse(
  state:         CommerceKnowledgeState,
  recentTraces:  DecisionTrace[]
): CommercePulse {

  // ── Fraud health (35%) ──────────────────────────────────────
  const avgFraud  = avgFraudFromTraces(recentTraces)
  const fraudHealth = clamp((1 - avgFraud) * 100)

  // ── Revenue health (30%) ────────────────────────────────────
  const blockRate      = blockRateFromTraces(recentTraces)
  const convRate       = state.revenue.conversionRate ?? 0.5
  const revenueHealth  = clamp((1 - blockRate) * 100 * convRate * 2)

  // ── Customer health (25%) ───────────────────────────────────
  const churnScore       = state.customer.churnScore     ?? 0.3
  const engagementScore  = state.customer.engagementScore ?? 0.6
  const customerHealth   = clamp((1 - churnScore) * 100 * engagementScore)

  // ── Operational health (10%) ────────────────────────────────
  const avgLatencyMs     = avgLatencyFromTraces(recentTraces)
  const operationalHealth = clamp(100 - Math.max(0, (avgLatencyMs - 800) / 30))

  // ── Composite score ─────────────────────────────────────────
  const score = clamp(
    fraudHealth       * 0.35 +
    revenueHealth     * 0.30 +
    customerHealth    * 0.25 +
    operationalHealth * 0.10
  )

  // ── History + trend ─────────────────────────────────────────
  pulseHistory.push({ score, ts: Date.now() })
  if (pulseHistory.length > MAX_HISTORY) pulseHistory.shift()

  const trend = computeTrend(score)

  // ── Alerts ──────────────────────────────────────────────────
  const alerts: string[] = []
  if (fraudHealth       < 40) alerts.push("FRAUD SPIKE DETECTED")
  if (revenueHealth     < 50) alerts.push("REVENUE UNDER PRESSURE")
  if (customerHealth    < 40) alerts.push("CHURN RISK ELEVATED")
  if (operationalHealth < 60) alerts.push("LATENCY DEGRADATION")

  return {
    score,
    trend,
    components: { fraudHealth, revenueHealth, customerHealth, operationalHealth },
    alerts,
    lastUpdatedAt: Date.now(),
  }
}

// ─── UTILS for display ────────────────────────────────────────

export function getPulseColor(score: number): string {
  if (score < 40) return "#ef4444"  // red
  if (score < 60) return "#f97316"  // orange
  if (score < 75) return "#eab308"  // yellow
  return "#10b981"                  // emerald
}

export function getTrendSymbol(trend: CommercePulse["trend"]): string {
  switch (trend) {
    case "IMPROVING": return "↗"
    case "DECLINING": return "↘"
    case "CRITICAL":  return "↓"
    default:          return "→"
  }
}
