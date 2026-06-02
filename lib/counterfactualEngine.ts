import { DecisionTrace, Counterfactual } from "@/core/shared/types"

export function generateCounterfactuals(trace: DecisionTrace): Counterfactual[] {
  const { finalDecision } = trace
  const fraudScore = trace.agents.fraud.fraudScore ?? 0.5
  const ltv = trace.agents.revenue.customerLTV ?? 0
  const revenueAtRisk = trace.agents.revenue.revenueAtRisk ?? 0
  
  const counterfactuals: Counterfactual[] = []
  
  if (finalDecision === "BLOCK") {
    // CF1 : que faudrait-il pour éviter le BLOCK ?
    if (fraudScore > 0.85) {
      counterfactuals.push({
        variable: "fraudScore",
        currentValue: fraudScore,
        thresholdValue: 0.84,
        deltaRequired: -(fraudScore - 0.84),
        newDecision: ltv > 1000 ? "STEP_UP_AUTH" : "HOLD",
        probability: 0.12 // historiquement 12% des scores > 0.85 redescendent
      })
    }
    if (ltv < 500) {
      counterfactuals.push({
        variable: "customerLTV",
        currentValue: ltv,
        thresholdValue: 500,
        deltaRequired: 500 - ltv,
        newDecision: "STEP_UP_AUTH",
        probability: 0.35 // 35% des nouveaux clients atteignent 500 LTV
      })
    }
  }
  
  if (finalDecision === "STEP_UP_AUTH") {
    // CF1 : que faudrait-il pour un ALLOW direct ?
    if (fraudScore > 0.40) {
      counterfactuals.push({
        variable: "fraudScore",
        currentValue: fraudScore,
        thresholdValue: 0.39,
        deltaRequired: -(fraudScore - 0.39),
        newDecision: "ALLOW",
        probability: 0.28
      })
    }
  }
  
  if (finalDecision === "HOLD") {
    // CF1 : que faudrait-il pour un ALLOW ?
    counterfactuals.push({
      variable: "revenueAtRisk",
      currentValue: revenueAtRisk,
      thresholdValue: 200,
      deltaRequired: 200 - revenueAtRisk,
      newDecision: "ALLOW",
      probability: 0.45
    })
  }

  if (finalDecision === "ALLOW") {
    // CF1 : que faudrait-il pour un BLOCK ?
    if (fraudScore < 0.85) {
      counterfactuals.push({
        variable: "fraudScore",
        currentValue: fraudScore,
        thresholdValue: 0.86,
        deltaRequired: 0.86 - fraudScore,
        newDecision: "BLOCK",
        probability: 0.05
      })
    }
  }
  
  return counterfactuals.slice(0, 3) // Max 3 pour la lisibilité
}
