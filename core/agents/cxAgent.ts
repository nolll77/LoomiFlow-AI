// core/agents/cxAgent.ts
import { CommerceEvent, MCPCustomerContext, CXAgentOutput } from "@/core/shared/types"

function log(step: string, data?: any) {
  const msg = `[AGENT][CX][${step}] ${data ? JSON.stringify(data).slice(0,150) : ""}`
  console.log(msg)
  try { const fs=require("fs"),path=require("path"),dir=path.join(process.cwd(),"local-prints"); if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true}); fs.appendFileSync(path.join(dir,"agent-decisions.log"),msg+"\n") } catch {}
}

export async function runCXAgent(
  event: CommerceEvent,
  ctx: MCPCustomerContext | null,
  useLLM = false
): Promise<CXAgentOutput> {
  log("START", { churnRisk: ctx?.churnRisk })
  const t0 = Date.now()

  let output: CXAgentOutput
  if (useLLM && process.env.OPENAI_API_KEY) {
    try { output = await runCXLLM(event, ctx) }
    catch { output = buildMockCXOutput(event, ctx) }
  } else {
    output = buildMockCXOutput(event, ctx)
  }

  output.latencyMs = Date.now() - t0
  log("DONE", { churnRisk: output.churnRisk, recommendation: output.recommendation })
  return output
}

function buildMockCXOutput(event: CommerceEvent, ctx: MCPCustomerContext | null): CXAgentOutput {
  const churnRisk = ctx?.churnRisk ?? "medium"
  const tier = ctx?.tier ?? "standard"

  const reasons: string[] = []
  if (churnRisk === "high") reasons.push("High churn risk — hard block would likely cause permanent loss")
  if (tier === "VIP") reasons.push("VIP customer — prioritize experience over friction")
  reasons.push("Step-up auth preserves trust while mitigating fraud risk")

  const recommendation = churnRisk === "high" ? "STEP_UP_AUTH" : "HOLD"
  const customerMessage = churnRisk === "high"
    ? `Hi! We noticed an unusual payment attempt on your account. For your security, we've added a quick verification step. Your ${tier === "VIP" ? "loyalty discount of 10% has been applied" : "order is saved"} — click here to complete your purchase.`
    : "We're verifying your payment. This will only take a moment."

  return {
    agentName: "cx",
    score: churnRisk === "high" ? 0.8 : churnRisk === "medium" ? 0.5 : 0.3,
    churnRisk,
    friction: churnRisk === "high" ? "high" : "medium",
    confidence: 0.82,
    recommendation,
    customerMessage,
    escalateToSupport: churnRisk === "high" && tier === "VIP",
    reasons,
    mcpSourcesUsed: ctx ? ["get_customer_prediction_score", "get_customer_properties"] : [],
    latencyMs: 0,
  }
}

async function runCXLLM(event: CommerceEvent, ctx: MCPCustomerContext | null): Promise<CXAgentOutput> {
  const { default: OpenAI } = await import("openai")
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: `You are a Customer Experience Agent. Protect customer relationship. Return JSON: {"churnRisk": "low|medium|high", "recommendation": "ALLOW|HOLD|STEP_UP_AUTH", "customerMessage": "...", "escalateToSupport": boolean, "reasons": ["..."]}` },
      { role: "user", content: JSON.stringify({ event, ctx }) },
    ],
    response_format: { type: "json_object" },
    max_tokens: 400,
  })
  const raw = JSON.parse(completion.choices[0].message.content!)
  const mock = buildMockCXOutput(event, ctx)
  return { ...mock, ...raw, agentName: "cx" as const }
}
