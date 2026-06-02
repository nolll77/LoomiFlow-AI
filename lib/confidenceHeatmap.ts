// lib/confidenceHeatmap.ts
// Evolution B — Decision Confidence Heatmap
// Stocke les 20 dernières décisions avec la confiance de chaque Council.
// In-memory (session) — reset au redémarrage du serveur, suffisant pour la démo.

import type { DecisionTrace } from "@/core/shared/types"

export interface HeatmapRow {
  decisionId: string
  decision:   string
  ts:         number
  councils: {
    risk:     number   // confidence 0–1
    revenue:  number
    customer: number
  }
  winner: string
}

const MAX_ROWS = 20
const heatmapHistory: HeatmapRow[] = []

// ─── RECORD ───────────────────────────────────────────────────

export function recordHeatmapRow(trace: DecisionTrace): void {
  const councils = trace.councils as Record<string, { confidence: number }> | undefined
  const market   = trace.marketDecision as { winningCouncil?: string } | undefined

  if (!councils || !market) return

  heatmapHistory.push({
    decisionId: trace.id,
    decision:   trace.finalDecision,
    ts:         trace.timestamp,
    councils: {
      risk:     councils.risk?.confidence     ?? 0,
      revenue:  councils.revenue?.confidence  ?? 0,
      customer: councils.customer?.confidence ?? 0,
    },
    winner: market.winningCouncil ?? "risk",
  })

  if (heatmapHistory.length > MAX_ROWS) heatmapHistory.shift()
}

// ─── READ ─────────────────────────────────────────────────────

export function getHeatmapData(): HeatmapRow[] {
  return [...heatmapHistory]
}
