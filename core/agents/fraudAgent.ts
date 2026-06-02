// core/agents/fraudAgent.ts
import { CommerceEvent, MCPCustomerContext, FraudAgentOutput } from "@/core/shared/types"
import { analyzeBehavior } from "@/core/mcp/behaviorAnalyzer"
// V4
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"
import type { AgentOpinion } from "@/core/shared/agentTypes"

function agentLog(name: string, step: string, data?: any) {
  const msg = `[AGENT][${name}][${step}][${new Date().toISOString()}] ${
    data ? JSON.stringify(data).slice(0, 200) : ""
  }`
  console.log(msg)
  try {
    const fs = require("fs"), path = require("path")
    const dir = path.join(process.cwd(), "local-prints")
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, "agent-decisions.log"), msg + "\n")
  } catch {}
}

export async function runFraudAgent(
  event: CommerceEvent,
  ctx: MCPCustomerContext | null,
  useLLM = false
): Promise<FraudAgentOutput> {
  agentLog("FRAUD", "START", { eventType: event.type, customerId: event.customerId })
  const t0 = Date.now()

  let output: FraudAgentOutput

  if (useLLM && process.env.OPENAI_API_KEY) {
    try {
      const baseScore = computeMockFraudScore(event, ctx)
      output = await runFraudLLM(event, ctx, baseScore)
    } catch (e) {
      agentLog("FRAUD", "LLM_FALLBACK", { error: String(e) })
      output = buildMockFraudOutput(event, ctx)
    }
  } else {
    output = buildMockFraudOutput(event, ctx)
  }

  output.latencyMs = Date.now() - t0
  agentLog("FRAUD", "DONE", {
    score: output.fraudScore,
    recommendation: output.recommendation,
    latencyMs: output.latencyMs,
  })
  return output
}

function computeMockFraudScore(event: CommerceEvent, ctx: MCPCustomerContext | null): number {
  let score = 0
  if (event.paypalData?.fraudSignals?.velocityAnomaly) score += 0.35
  if (event.paypalData?.fraudSignals?.deviceMismatch) score += 0.25
  if (event.paypalData?.fraudSignals?.geoInconsistency) score += 0.25
  if (event.paypalData?.fraudSignals?.riskScore) score += event.paypalData.fraudSignals.riskScore * 0.15
  if (event.type === "payment_failed") score += 0.1
  if (event.type === "fraud_detected") score += 0.4
  if (ctx?.tier === "VIP") score *= 0.7
  return Math.min(score, 1)
}

function buildMockFraudOutput(
  event: CommerceEvent,
  ctx: MCPCustomerContext | null,
  overrideScore?: number
): FraudAgentOutput {
  const fingerprint = analyzeBehavior(ctx?.recentEvents ?? [], event)

  const baseFraud = overrideScore ?? computeMockFraudScore(event, ctx)
  const behavioralBoost = 
    (fingerprint.velocityScore > 0.7 ? 0.15 : 0) +
    (fingerprint.deviceChangeDetected ? 0.10 : 0) +
    (fingerprint.unusualHour ? 0.05 : 0)
  
  const enrichedFraudScore = Math.min(1.0, baseFraud + behavioralBoost)

  const signals = [
    baseFraud > 0.6 && "high_base_fraud_score",
    fingerprint.velocityScore > 0.7 && "unusual_velocity",
    fingerprint.deviceChangeDetected && "device_change",
    fingerprint.unusualHour && "off_hours_activity",
    fingerprint.journeyState === "churning" && "churn_pattern",
    event.paypalData?.fraudSignals?.geoInconsistency && "geo_inconsistency"
  ].filter(Boolean) as string[]

  const recommendation = enrichedFraudScore > 0.85 ? "BLOCK" : enrichedFraudScore > 0.60 ? "STEP_UP_AUTH" : "ALLOW"
  
  const baseConfidence = fingerprint.velocityScore > 0.5 ? 0.92 : 0.78
  const dataQuality = (ctx?.recentEvents?.length ?? 0) > 5 ? 0.9 : 0.5

  return {
    agentName: "fraud",
    score: enrichedFraudScore,
    fraudScore: enrichedFraudScore,
    dataQuality,
    confidence: Number((dataQuality * baseConfidence).toFixed(2)),
    recommendation,
    signals,
    reasons: [...signals, `base=${baseFraud.toFixed(2)} + behavioral=${behavioralBoost.toFixed(2)}`],
    blockPayment: recommendation === "BLOCK",
    mcpSourcesUsed: ctx ? ["get_customer_properties", "list_customer_events"] : [],
    latencyMs: 0,
  }
}

async function runFraudLLM(
  event: CommerceEvent,
  ctx: MCPCustomerContext | null,
  baseScore: number
): Promise<FraudAgentOutput> {
  const { default: OpenAI } = await import("openai")
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a Fraud Detection Agent for an e-commerce platform.
Analyze the event and customer context for fraud risk.
Return ONLY valid JSON: {"fraudScore": 0-1, "recommendation": "BLOCK|ALLOW|STEP_UP_AUTH", "signals": ["..."], "confidence": 0-1}`,
      },
      {
        role: "user",
        content: JSON.stringify({ event, customerContext: ctx, baseScore }),
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 300,
  })

  const raw = JSON.parse(completion.choices[0].message.content!)
  return buildMockFraudOutput(event, ctx, raw.fraudScore ?? baseScore)
}

// ─── V4 — FRAUD AGENT AS PURE FUNCTION ───────────────────────

export async function fraudAgent(state: CommerceKnowledgeState): Promise<AgentOpinion> {
  const { fraud, customer, event } = state
  const score = fraud.enrichedFraudScore
  const thresholds = state.sessionThresholds

  const recommendation =
    score > thresholds.fraudBlockThreshold && customer.ltv < 500 ? "BLOCK" :
    score > thresholds.fraudStepThreshold  && customer.ltv > 1000 ? "STEP_UP_AUTH" :
    score > thresholds.fraudStepThreshold ? "STEP_UP_AUTH" :
    score < 0.40 ? "ALLOW" : "HOLD"

  const dataQuality = [
    fraud.fraudScore != null,
    customer.behavioralFingerprint != null,
    fraud.signals.length > 0,
    customer.ltv > 0,
    event.value != null,
  ].filter(Boolean).length / 5

  return {
    agentId: "fraud",
    recommendation,
    confidence: dataQuality * (score > 0.7 ? 0.95 : score > 0.5 ? 0.80 : 0.65),
    dataQuality,
    reasoning: [
      `Fraud score: ${score.toFixed(2)} (base: ${fraud.fraudScore.toFixed(2)})`,
      ...fraud.signals.map(s => `Signal: ${s}`),
      `Customer LTV: €${customer.ltv}`,
      `Threshold (adaptive): ${thresholds.fraudBlockThreshold.toFixed(2)}`,
    ],
    expectedOutcome: {
      fraudPrevented:   recommendation === "BLOCK"         ? event.value ?? 0 : 0,
      revenueProtected: recommendation === "STEP_UP_AUTH"  ? customer.ltv * 0.15 : 0,
    },
    urgency: score > 0.85 ? "immediate" : score > 0.60 ? "high" : "medium",
    requiredActions: recommendation === "BLOCK" ? [{
      type: "payment_action",
      tool: "blockPayment",
      params: { customerId: event.customerId, reason: fraud.signals[0] ?? "fraud_detected" },
      estimatedImpact: event.value ?? 0,
      rollbackable: true,
    }] : [],
    dataQualityFlags: dataQuality < 0.6 ? ["INSUFFICIENT_FRAUD_DATA"] : [],
  }
}
