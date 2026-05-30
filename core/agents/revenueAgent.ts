// core/agents/revenueAgent.ts
import { CommerceEvent, MCPCustomerContext, RevenueAgentOutput } from "@/core/shared/types"

function log(step: string, data?: any) {
  const msg = `[AGENT][REVENUE][${step}] ${data ? JSON.stringify(data).slice(0, 150) : ""}`
  console.log(msg)
  try { const fs=require("fs"),path=require("path"),dir=path.join(process.cwd(),"local-prints"); if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true}); fs.appendFileSync(path.join(dir,"agent-decisions.log"),msg+"\n") } catch {}
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
  const ltv = ctx?.ltv ?? 0
  const revenueAtRisk = event.value ?? 0
  const priority = ltv > 2000 ? "critical" : ltv > 1000 ? "high" : revenueAtRisk > 200 ? "medium" : "low"

  const reasons: string[] = []
  if (ltv > 2000) reasons.push(`High lifetime value customer (€${ltv})`)
  if (ltv > 0) reasons.push(`${ctx?.totalOrders ?? "?"} previous orders`)
  if (revenueAtRisk > 0) reasons.push(`€${revenueAtRisk} revenue at immediate risk`)
  if (ctx?.tier === "VIP") reasons.push("VIP tier — prioritize recovery over blocking")

  const recommendation = ltv > 1000 || revenueAtRisk > 200 ? "ALLOW" : "HOLD"
  const discount = ltv > 2000 ? "10%" : ltv > 1000 ? "5%" : undefined

  return {
    agentName: "revenue",
    score: Math.min(1, (ltv / 5000 + revenueAtRisk / 1000) / 2),
    revenueAtRisk,
    customerLTV: ltv,
    confidence: 0.85,
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
