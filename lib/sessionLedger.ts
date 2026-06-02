interface SessionLedger {
  decisions: Array<{ decision: string; fraudScore: number; ltv: number; ts: number }>
  fraudRateObserved: number    // rolling 5min
  avgFraudScore: number
  blockRate: number
  adaptedThresholds: {
    fraudBlockThreshold: number   // default 0.85 — monte si trop de BLOCK
    fraudStepThreshold: number    // default 0.60
    allowRevenueMin: number       // default 200
  }
}

// In-memory ledger for the current server process session
const ledger: SessionLedger = {
  decisions: [],
  fraudRateObserved: 0,
  avgFraudScore: 0,
  blockRate: 0,
  adaptedThresholds: {
    fraudBlockThreshold: 0.85,
    fraudStepThreshold: 0.60,
    allowRevenueMin: 200,
  }
}

export function recordDecision(decision: string, fraudScore: number, ltv: number) {
  ledger.decisions.push({ decision, fraudScore, ltv, ts: Date.now() })
  
  // Ne garder que les 20 dernières décisions (rolling window)
  if (ledger.decisions.length > 20) ledger.decisions.shift()
  
  // Recalculer métriques
  const recent = ledger.decisions
  ledger.blockRate = recent.filter(d => d.decision === "BLOCK").length / recent.length
  ledger.avgFraudScore = recent.reduce((s, d) => s + d.fraudScore, 0) / recent.length
  
  // Reset au cas où
  ledger.adaptedThresholds.fraudBlockThreshold = 0.85
  ledger.adaptedThresholds.fraudStepThreshold = 0.60
  
  // Adaptation : si BLOCK rate > 40%, on est peut-être trop agressif
  // → Monter le seuil de BLOCK légèrement (protection faux positifs)
  if (ledger.blockRate > 0.40 && recent.length >= 10) {
    ledger.adaptedThresholds.fraudBlockThreshold = Math.min(0.92, 
      ledger.adaptedThresholds.fraudBlockThreshold + 0.05)
  }
  
  // Si fraud score moyen > 0.7 sur la session → on est sous attaque
  // → Baisser les seuils (mode défensif)
  if (ledger.avgFraudScore > 0.70 && recent.length >= 10) {
    ledger.adaptedThresholds.fraudBlockThreshold = Math.max(0.75,
      ledger.adaptedThresholds.fraudBlockThreshold - 0.10)
    ledger.adaptedThresholds.fraudStepThreshold = Math.max(0.45,
      ledger.adaptedThresholds.fraudStepThreshold - 0.10)
  }
}

export function getAdaptedThresholds() {
  return ledger.adaptedThresholds
}

export function getLedgerStats() {
  return {
    blockRate: ledger.blockRate,
    avgFraudScore: ledger.avgFraudScore,
    thresholds: ledger.adaptedThresholds,
    sessionSize: ledger.decisions.length,
    adaptationActive: ledger.decisions.length >= 10
  }
}
