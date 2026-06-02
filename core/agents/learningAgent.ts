// core/agents/learningAgent.ts
// V4 — Boucle d'amélioration continue en session
// Observe toutes les décisions, adapte les seuils et poids des councils

import type { CommerceKnowledgeState } from "@/core/shared/commerceState"
import type { MarketDecision }         from "@/core/orchestration/types"
import { adjustThreshold, getAdaptedThresholds } from "@/lib/sessionLedger"
import { adjustCouncilWeight, getCurrentCouncilWeights } from "@/core/orchestration/opinionMarket"
import { info } from "@/lib/logger"

// ─── TYPES ────────────────────────────────────────────────────

interface DecisionRecord {
  traceId:       string
  decision:      string
  winningCouncil: string
  confidence:    number
  utilityScores: Record<string, number>

  // Outcome (renseigné après coup si disponible)
  outcome?:              "SUCCESS" | "FAILURE" | "PARTIAL"
  actualRevenueDelta?:   number
  fraudOccurred?:        boolean
  customerRetained?:     boolean

  state: {
    fraudScore: number
    ltv:        number
    churnScore: number
  }

  ts: number
}

export interface LearningInsights {
  ready:               boolean
  sessionSize?:        number
  decisionDistribution?: Record<string, number>
  avgConfidence?:      number
  mostActiveCouncil?:  string
  adaptationActive?:   boolean
  currentThresholds?:  ReturnType<typeof getAdaptedThresholds>
  councilWeights?:     Record<string, number>
  trend?:              string
}

// ─── IN-MEMORY STORE ──────────────────────────────────────────
// Reset à chaque démarrage serveur — intentionnel (session learning)

const decisionMemory: DecisionRecord[] = []
const MAX_MEMORY = 50

// ─── RECORD ───────────────────────────────────────────────────

export function recordDecisionForLearning(
  traceId:        string,
  marketDecision: MarketDecision,
  state:          CommerceKnowledgeState
): void {
  decisionMemory.push({
    traceId,
    decision:       marketDecision.finalDecision,
    winningCouncil: marketDecision.winningCouncil,
    confidence:     marketDecision.confidence,
    utilityScores:  marketDecision.utilityScores,
    state: {
      fraudScore: state.fraud.enrichedFraudScore,
      ltv:        state.customer.ltv,
      churnScore: state.customer.churnScore,
    },
    ts: Date.now(),
  })

  if (decisionMemory.length > MAX_MEMORY) decisionMemory.shift()

  adaptFromMemory()
}

/** Renseigner l'outcome réel a posteriori (ex: webhook Bloomreach) */
export function recordOutcome(
  traceId: string,
  outcome: DecisionRecord["outcome"],
  delta?: { revenueDelta?: number; fraudOccurred?: boolean; customerRetained?: boolean }
): void {
  const record = decisionMemory.find(d => d.traceId === traceId)
  if (!record) return
  record.outcome             = outcome
  record.actualRevenueDelta  = delta?.revenueDelta
  record.fraudOccurred       = delta?.fraudOccurred
  record.customerRetained    = delta?.customerRetained
}

// ─── ADAPTATION ───────────────────────────────────────────────

function adaptFromMemory(): void {
  if (decisionMemory.length < 10) return

  const recent = decisionMemory.slice(-50)

  // ── Distribution des décisions ────────────────────────────
  const decisionDist: Record<string, number> = {}
  recent.forEach(d => { decisionDist[d.decision] = (decisionDist[d.decision] ?? 0) + 1 })

  const blockRate  = (decisionDist["BLOCK"]         ?? 0) / recent.length
  const stepUpRate = (decisionDist["STEP_UP_AUTH"]   ?? 0) / recent.length

  // ── Conseil dominance ─────────────────────────────────────
  const councilWins: Record<string, number> = {}
  recent.forEach(d => { councilWins[d.winningCouncil] = (councilWins[d.winningCouncil] ?? 0) + 1 })

  const avgFraud = recent.reduce((s, d) => s + d.state.fraudScore, 0) / recent.length

  // ── Règles d'adaptation ───────────────────────────────────

  // Sur-détection fraude → relâcher légèrement
  if (blockRate > 0.45) {
    adjustThreshold("fraudBlockThreshold", +0.02)
    info("[LEARNING] High BLOCK rate. Relaxing fraud threshold slightly.", { blockRate })
  }

  // Environnement à risque élevé → mode défensif
  if (avgFraud > 0.72) {
    adjustThreshold("fraudBlockThreshold", -0.03)
    adjustThreshold("fraudStepThreshold",  -0.02)
    info("[LEARNING] High fraud environment. Tightening thresholds. DEFENSIVE MODE.", { avgFraud })
  }

  // STEP_UP trop rare → peut-être seuil trop haut
  if (stepUpRate < 0.05 && blockRate < 0.10 && avgFraud > 0.5) {
    adjustThreshold("fraudStepThreshold", -0.02)
    info("[LEARNING] Low STEP_UP_AUTH rate despite fraud signals. Lowering step threshold.", { stepUpRate, blockRate, avgFraud })
  }

  // Risk Council trop dominant → rééquilibrer
  const riskDominance = (councilWins["risk"] ?? 0) / recent.length
  if (riskDominance > 0.75 && recent.length >= 15) {
    adjustCouncilWeight("risk",     -0.02)
    adjustCouncilWeight("revenue",  +0.01)
    adjustCouncilWeight("customer", +0.01)
    info("[LEARNING] Risk council over-dominant. Rebalancing.", { riskDominance })
  }
}

// ─── INSIGHTS ─────────────────────────────────────────────────

function analyzeTrend(records: DecisionRecord[]): string {
  const first5 = records.slice(0, 5)
  const last5  = records.slice(-5)
  const avgFirst = first5.reduce((s, d) => s + d.state.fraudScore, 0) / 5
  const avgLast  = last5.reduce((s, d)  => s + d.state.fraudScore, 0) / 5

  if (avgLast > avgFirst + 0.15) return "FRAUD_ESCALATING"
  if (avgLast < avgFirst - 0.15) return "FRAUD_NORMALIZING"
  return "STABLE"
}

export function getLearningInsights(): LearningInsights {
  const recent = decisionMemory.slice(-20)
  if (recent.length === 0) return { ready: false }

  const decisionDist: Record<string, number> = {}
  recent.forEach(d => { decisionDist[d.decision] = (decisionDist[d.decision] ?? 0) + 1 })

  const avgConfidence = recent.reduce((s, d) => s + d.confidence, 0) / recent.length

  const councilWins: Record<string, number> = {}
  recent.forEach(d => { councilWins[d.winningCouncil] = (councilWins[d.winningCouncil] ?? 0) + 1 })

  const mostActiveCouncil = Object.entries(councilWins)
    .sort((a, b) => b[1] - a[1])[0]?.[0]

  return {
    ready:                recent.length >= 5,
    sessionSize:          decisionMemory.length,
    decisionDistribution: decisionDist,
    avgConfidence,
    mostActiveCouncil,
    adaptationActive:     recent.length >= 8,
    currentThresholds:    getAdaptedThresholds(),
    councilWeights:       getCurrentCouncilWeights(),
    trend:                recent.length >= 10 ? analyzeTrend(recent) : "insufficient_data",
  }
}
