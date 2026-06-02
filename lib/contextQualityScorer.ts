// lib/contextQualityScorer.ts
// Evolution G — MCP Context Quality Score
// Note la qualité des données MCP reçues pour chaque décision.
// Un score < 60 signifie que la décision a été prise dans l'incertitude — affiché honnêtement.

import type { CommerceKnowledgeState } from "@/core/shared/commerceState"

// ─── TYPES ────────────────────────────────────────────────────

export interface ContextQualityReport {
  overallScore:      number                   // 0-100
  grade:             "A" | "B" | "C" | "D" | "F"
  fieldScores:       Record<string, number>   // 0-1 par champ MCP
  missingFields:     string[]
  degradedFields:    string[]                 // présents mais valeurs suspectes (defaults)
  impactOnDecision:  "NONE" | "LOW" | "MEDIUM" | "HIGH"
  recommendation:    string
}

// ─── FIELD CHECKS ─────────────────────────────────────────────

interface FieldCheck {
  field:    string
  value:    unknown
  weight:   number   // somme des weights = 1.0
  critical: boolean
}

function buildChecks(state: CommerceKnowledgeState): FieldCheck[] {
  return [
    { field: "fraud.fraudScore",       value: state.fraud.fraudScore,                              weight: 0.20, critical: true  },
    { field: "customer.ltv",           value: state.customer.ltv,                                  weight: 0.15, critical: true  },
    { field: "revenue.revenueAtRisk",  value: state.revenue.revenueAtRisk,                         weight: 0.12, critical: true  },
    { field: "customer.churnScore",    value: state.customer.churnScore,                           weight: 0.12, critical: true  },
    { field: "fraud.signals",          value: state.fraud.signals?.length,                         weight: 0.08, critical: false },
    { field: "customer.segments",      value: state.customer.segments?.length,                     weight: 0.08, critical: false },
    { field: "catalog.searchQuality",  value: state.catalog.searchQualityScore,                   weight: 0.07, critical: false },
    { field: "campaign.performance",   value: state.campaign.campaignPerformance,                  weight: 0.06, critical: false },
    { field: "customer.emailOpenRate", value: state.customer.emailOpenRate,                        weight: 0.06, critical: false },
    { field: "behavioral.fingerprint", value: state.customer.behavioralFingerprint?.velocityScore, weight: 0.06, critical: false },
  ]
}

// ─── SCORE A SINGLE FIELD ─────────────────────────────────────

function scoreField(check: FieldCheck): { score: number; status: "ok" | "degraded" | "missing" } {
  const v = check.value

  // Null / undefined → missing
  if (v == null) return { score: 0, status: "missing" }

  // Empty array → missing
  if (typeof v === "number" && check.field.endsWith(".length") && v === 0)
    return { score: 0.2, status: "degraded" }

  // Critical numeric at exact 0 — looks like a default, not a real zero
  if (typeof v === "number" && v === 0 && check.critical)
    return { score: 0.30, status: "degraded" }

  // Suspiciously round default-looking value for probability fields
  if (typeof v === "number" && v === 0.5 && check.critical)
    return { score: 0.50, status: "degraded" }

  return { score: 1.0, status: "ok" }
}

// ─── GRADE ────────────────────────────────────────────────────

function toGrade(score: number): ContextQualityReport["grade"] {
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  if (score >= 55) return "C"
  if (score >= 40) return "D"
  return "F"
}

// ─── MAIN EXPORT ──────────────────────────────────────────────

export function scoreContextQuality(state: CommerceKnowledgeState): ContextQualityReport {
  const checks = buildChecks(state)

  const fieldScores: Record<string, number> = {}
  const missing:     string[] = []
  const degraded:    string[] = []
  let   weightedSum  = 0

  for (const check of checks) {
    const { score, status } = scoreField(check)
    fieldScores[check.field] = score
    weightedSum += score * check.weight
    if (status === "missing")  missing.push(check.field)
    if (status === "degraded") degraded.push(check.field)
  }

  const overallScore = Math.max(0, Math.min(100, Math.round(weightedSum * 100)))
  const grade        = toGrade(overallScore)

  // Impact on decision = how many critical fields are degraded/missing
  const criticalPoor = checks.filter(c => c.critical && (fieldScores[c.field] ?? 1) < 0.5)
  const impactOnDecision: ContextQualityReport["impactOnDecision"] =
    criticalPoor.length >= 3 ? "HIGH"   :
    criticalPoor.length >= 1 ? "MEDIUM" :
    degraded.length    >= 3 ? "LOW"    : "NONE"

  const recommendation =
    grade === "F" || grade === "D"
      ? `Decision confidence significantly reduced. ${missing.length} fields unavailable from MCP.`
    : grade === "C"
      ? `${missing.length + degraded.length} fields missing or at default values. Decision may be suboptimal.`
    : "Context quality sufficient for a reliable decision."

  return {
    overallScore,
    grade,
    fieldScores,
    missingFields:    missing,
    degradedFields:   degraded,
    impactOnDecision,
    recommendation,
  }
}

// ─── DISPLAY HELPERS ──────────────────────────────────────────

export function gradeColor(grade: ContextQualityReport["grade"]): string {
  switch (grade) {
    case "A": return "#10b981"   // emerald
    case "B": return "#60a5fa"   // blue
    case "C": return "#eab308"   // yellow
    case "D": return "#f97316"   // orange
    case "F": return "#ef4444"   // red
  }
}

export function impactLabel(impact: ContextQualityReport["impactOnDecision"]): string {
  switch (impact) {
    case "NONE":   return "No impact"
    case "LOW":    return "Minor impact"
    case "MEDIUM": return "Moderate impact"
    case "HIGH":   return "High impact"
  }
}
