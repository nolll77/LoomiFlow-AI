// core/agents/fraudAgent.ts
import { CommerceEvent, MCPCustomerContext, FraudAgentOutput } from "@/core/shared/types"

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

  // Mock scoring (used when USE_MOCK_AGENTS=true or no OpenAI key)
  const mockScore = computeMockFraudScore(event, ctx)

  let output: FraudAgentOutput

  if (useLLM && process.env.OPENAI_API_KEY) {
    try {
      output = await runFraudLLM(event, ctx, mockScore)
    } catch (e) {
      agentLog("FRAUD", "LLM_FALLBACK", { error: String(e) })
      output = buildMockFraudOutput(event, ctx, mockScore)
    }
  } else {
    output = buildMockFraudOutput(event, ctx, mockScore)
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
  // PayPal fraud signals
  if (event.paypalData?.fraudSignals?.velocityAnomaly) score += 0.35
  if (event.paypalData?.fraudSignals?.deviceMismatch) score += 0.25
  if (event.paypalData?.fraudSignals?.geoInconsistency) score += 0.25
  if (event.paypalData?.fraudSignals?.riskScore) score += event.paypalData.fraudSignals.riskScore * 0.15
  // Event type risk
  if (event.type === "payment_failed") score += 0.1
  if (event.type === "fraud_detected") score += 0.4
  // VIP customers get benefit of doubt
  if (ctx?.tier === "VIP") score *= 0.7
  return Math.min(score, 1)
}

function buildMockFraudOutput(
  event: CommerceEvent,
  ctx: MCPCustomerContext | null,
  score: number
): FraudAgentOutput {
  const signals: string[] = []
  if (event.paypalData?.fraudSignals?.velocityAnomaly) signals.push("Velocity anomaly detected")
  if (event.paypalData?.fraudSignals?.deviceMismatch) signals.push("Device fingerprint mismatch")
  if (event.paypalData?.fraudSignals?.geoInconsistency) signals.push("Geographic inconsistency")
  if (score < 0.3) signals.push("Normal behavioral pattern")

  const recommendation = score > 0.7 ? "BLOCK" : score > 0.4 ? "STEP_UP_AUTH" : "ALLOW"

  return {
    agentName: "fraud",
    score,
    fraudScore: score,
    confidence: score > 0.7 ? 0.92 : score > 0.4 ? 0.75 : 0.88,
    recommendation,
    signals,
    reasons: signals,
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
