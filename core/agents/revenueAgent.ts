// core/agents/revenueAgent.ts
import { CommerceEvent, MCPCustomerContext, RevenueAgentOutput } from "@/core/shared/types"
// V4
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"
import type { AgentOpinion } from "@/core/shared/agentTypes"

import { info } from "@/lib/logger"

function log(step: string, data?: any) {
  info(`Agent REVENUE ${step}`, data)
  try {
    const msg = `[AGENT][REVENUE][${step}] ${data ? JSON.stringify(data).slice(0, 150) : ""}`
    const fs=require("fs"),path=require("path"),dir=path.join(process.cwd(),"local-prints"); if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true}); fs.appendFileSync(path.join(dir,"agent-decisions.log"),msg+"\n")
  } catch {}
}

export async function runRevenueAgent(
  event: CommerceEvent,
  ctx: MCPCustomerContext | null,
  useLLM = false
): Promise<RevenueAgentOutput> {
  log("START", { eventType: event.type, value: event.value })
  const t0 = Date.now()

  const ltv = ctx?.ltv ?? 0
  const revenueAtRisk = event.value ?? 0
  const priority = ltv > 2000 ? "critical" : ltv > 1000 ? "high" : revenueAtRisk > 200 ? "medium" : "low"

  let output: RevenueAgentOutput

  if (useLLM && process.env.OPENAI_API_KEY) {
    try { output = await runRevenueLLM(event, ctx) }
    catch { output = buildMockRevenueOutput(event, ctx) }
  } else {
    output = buildMockRevenueOutput(event, ctx)
  }

  output.latencyMs = Date.now() - t0
  log("DONE", { revenueAtRisk: output.revenueAtRisk, recommendation: output.recommendation })
  return output
}

function buildMockRevenueOutput(
  event: CommerceEvent,
  ctx: MCPCustomerContext | null
): RevenueAgentOutput {
  const fieldsAvailable = [
    ctx?.ltv != null,
    ctx?.totalOrders != null,
    ctx?.tier != null,
    event.value != null,
  ].filter(Boolean).length
  const dataQuality = fieldsAvailable / 4

  const ltv = ctx?.ltv ?? 0
  const revenueAtRisk = event.value ?? 0
  const priority = ltv > 2000 ? "critical" : ltv > 1000 ? "high" : revenueAtRisk > 200 ? "medium" : "low"

  const reasons: string[] = []
  if (ltv > 2000) reasons.push(`High lifetime value customer (€${ltv})`)
  if (ltv > 0) reasons.push(`${ctx?.totalOrders ?? "?"} previous orders`)
  if (revenueAtRisk > 0) reasons.push(`€${revenueAtRisk} revenue at immediate risk`)
  if (ctx?.tier === "VIP") reasons.push("VIP tier — prioritize recovery over blocking")
  reasons.push(`dataQuality=${dataQuality.toFixed(2)}`)

  const recommendation = ltv > 1000 || revenueAtRisk > 200 ? "ALLOW" : "HOLD"
  const discount = ltv > 2000 ? "10%" : ltv > 1000 ? "5%" : undefined

  return {
    agentName: "revenue",
    score: Math.min(1, (ltv / 5000 + revenueAtRisk / 1000) / 2),
    revenueAtRisk,
    customerLTV: ltv,
    dataQuality,
    confidence: Number((dataQuality * 0.85).toFixed(2)),
    recommendation,
    discountRecommendation: discount,
    revenueRecoveryProbability: discount ? 0.78 : 0.55,
    priority,
    reasons,
    mcpSourcesUsed: ctx ? ["get_customer_properties", "get_customer_prediction_score"] : [],
    latencyMs: 0,
  }
}

async function runRevenueLLM(
  event: CommerceEvent,
  ctx: MCPCustomerContext | null
): Promise<RevenueAgentOutput> {
  const { default: OpenAI } = await import("openai")
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: `You are a Revenue Optimization Agent. Analyze revenue risk. Return JSON: {"revenueAtRisk": number, "recommendation": "ALLOW|BLOCK|HOLD", "discountRecommendation": "5%|10%|null", "priority": "low|medium|high|critical", "reasons": ["..."]}` },
      { role: "user", content: JSON.stringify({ event, ctx }) },
    ],
    response_format: { type: "json_object" },
    max_tokens: 300,
  })
  const raw = JSON.parse(completion.choices[0].message.content!)
  const mock = buildMockRevenueOutput(event, ctx)
  return { ...mock, ...raw, agentName: "revenue" as const }
}

// ─── V4 — REVENUE AGENT AS PURE FUNCTION ───────────────────

export async function revenueAgent(state: CommerceKnowledgeState): Promise<AgentOpinion> {
  const { revenue, customer, campaign } = state

  const recoveryPotential = revenue.revenueAtRisk *
    (customer.emailOpenRate > 0.4 ? 0.65 : 0.35)

  const recommendation =
    revenue.revenueAtRisk > 500 && customer.tier === "VIP" ? "PRIORITY_RECOVERY" :
    revenue.revenueAtRisk > 200 ? "RECOVERY_CAMPAIGN" :
    revenue.revenueAtRisk > 0   ? "ALLOW" : "MONITOR"

  const confidence = 0.82
  const dataQuality = revenue.revenueAtRisk > 0 ? 0.9 : 0.5
  const reasoning = [
    `Revenue at risk: €${revenue.revenueAtRisk}`,
    `Recovery potential: €${recoveryPotential.toFixed(0)}`,
    `Email open rate: ${(customer.emailOpenRate * 100).toFixed(0)}%`,
    `Campaign performance: ${campaign.campaignPerformance}`,
    `Forecasted LTV: €${revenue.forecastedLTV}`,
  ]

  return {
    agentId: "revenue",
    recommendation,
    confidence,
    dataQuality,
    reasoning,
    expectedOutcome: { revenueGained: recoveryPotential },
    urgency: revenue.revenueAtRisk > 500 ? "high" : "medium",
    requiredActions: [{
      type: "campaign_trigger",
      tool: "trackCustomerEvent",
      params: {
        customerId: state.event.customerId,
        eventName: "payment_recovery_triggered",
        data: { revenueAtRisk: revenue.revenueAtRisk, recoveryPotential },
      },
      estimatedImpact: recoveryPotential,
      rollbackable: false,
    }],
    dataQualityFlags: [],
    
    // ──────────────────────────────────────────────────────
    // BACKWARD COMPAT FIELDS (V3 UI components)
    // ──────────────────────────────────────────────────────
    agentName: "revenue",
    score: confidence,
    reasons: reasoning,
    customerLTV: revenue.forecastedLTV,
    revenueAtRisk: revenue.revenueAtRisk,
    discountRecommendation: revenue.revenueAtRisk > 500 ? "10%" : revenue.revenueAtRisk > 200 ? "5%" : undefined,
    revenueRecoveryProbability: customer.emailOpenRate > 0.4 ? 0.78 : 0.55,
    priority: revenue.revenueAtRisk > 500 ? "critical" : revenue.revenueAtRisk > 200 ? "high" : "medium",
    latencyMs: 0,
    mcpSourcesUsed: ["get_customer_properties", "get_customer_prediction_score"],
  }
}
