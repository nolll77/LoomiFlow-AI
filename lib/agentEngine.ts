// lib/agentEngine.ts — Mock agent engine for demo without LLM
import { CommerceEvent, FraudAgentOutput, RevenueAgentOutput, CXAgentOutput, OrchestratorDecision } from "@/core/shared/types"

export function getMockAgentOutputs(event: CommerceEvent) {
  const isVIP = event.mcpContext?.tier === "VIP"
  const ltv = event.mcpContext?.ltv ?? 0
  const value = event.value ?? 0
  const fraud = event.paypalData?.fraudSignals?.riskScore ?? (event.fraudScore ?? 0.3)

  const fraudOutput: FraudAgentOutput = {
    agentName: "fraud",
    score: fraud,
    fraudScore: fraud,
    confidence: fraud > 0.7 ? 0.92 : 0.75,
    recommendation: fraud > 0.7 ? "BLOCK" : fraud > 0.4 ? "STEP_UP_AUTH" : "ALLOW",
    signals: [
      ...(event.paypalData?.fraudSignals?.velocityAnomaly ? ["Velocity anomaly"] : []),
      ...(event.paypalData?.fraudSignals?.geoInconsistency ? ["Geo inconsistency"] : []),
      ...(fraud < 0.3 ? ["Normal behavior pattern"] : []),
    ],
    reasons: [`Fraud score: ${fraud.toFixed(2)}`],
    blockPayment: fraud > 0.8,
    mcpSourcesUsed: ["get_customer_properties", "list_customer_events"],
    latencyMs: 890,
  }

  const revenueOutput: RevenueAgentOutput = {
    agentName: "revenue",
    score: Math.min(1, (ltv / 5000 + value / 1000) / 2),
    revenueAtRisk: value,
    customerLTV: ltv,
    confidence: 0.85,
    recommendation: ltv > 1000 || value > 200 ? "ALLOW" : "HOLD",
    discountRecommendation: isVIP ? "10%" : undefined,
    revenueRecoveryProbability: 0.78,
    priority: ltv > 2000 ? "critical" : value > 200 ? "high" : "medium",
    reasons: [
      ...(isVIP ? [`VIP tier — LTV €${ltv}`] : []),
      `€${value} at immediate risk`,
    ],
    mcpSourcesUsed: ["get_customer_properties", "get_customer_prediction_score"],
    latencyMs: 620,
  }

  const cxOutput: CXAgentOutput = {
    agentName: "cx",
    score: event.mcpContext?.churnRisk === "high" ? 0.8 : 0.5,
    churnRisk: event.mcpContext?.churnRisk ?? "medium",
    friction: event.mcpContext?.churnRisk === "high" ? "high" : "medium",
    confidence: 0.82,
    recommendation: event.mcpContext?.churnRisk === "high" ? "STEP_UP_AUTH" : "HOLD",
    customerMessage: isVIP
      ? `Hi ${event.mcpContext?.tier === "VIP" ? "valued customer" : "there"}! We noticed an issue with your payment. We've saved your order and applied a special offer — click here to complete your purchase.`
      : "We're verifying your payment details. This will take just a moment.",
    escalateToSupport: isVIP && event.mcpContext?.churnRisk === "high",
    reasons: [`Churn risk: ${event.mcpContext?.churnRisk ?? "medium"}`],
    mcpSourcesUsed: ["get_customer_prediction_score"],
    latencyMs: 510,
  }

  return { fraudOutput, revenueOutput, cxOutput }
}
