// core/agents/orchestrator.ts
import {
  CommerceEvent, MCPCustomerContext,
  FraudAgentOutput, RevenueAgentOutput, CXAgentOutput,
  OrchestratorDecision, DecisionTrace, TraceEntry
} from "@/core/shared/types"
import { executeAgentDecisionWrites } from "@/server/bloomreach/writeApi"

function log(step: string, data?: any) {
  const msg = `[ORCHESTRATOR][${step}] ${data ? JSON.stringify(data).slice(0,200) : ""}`
  console.log(msg)
  try { const fs=require("fs"),path=require("path"),dir=path.join(process.cwd(),"local-prints"); if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true}); fs.appendFileSync(path.join(dir,"agent-decisions.log"),msg+"\n") } catch {}
}

export async function runOrchestrator(
  event: CommerceEvent,
  ctx: MCPCustomerContext | null,
  fraud: FraudAgentOutput,
  revenue: RevenueAgentOutput,
  cx: CXAgentOutput,
  useLLM = false
): Promise<OrchestratorDecision> {
  log("START", { fraud: fraud.recommendation, revenue: revenue.recommendation, cx: cx.recommendation })

  let decision: OrchestratorDecision
  if (useLLM && process.env.OPENAI_API_KEY) {
    try { decision = await runOrchestratorLLM(event, ctx, fraud, revenue, cx) }
    catch (e) { log("LLM_FALLBACK", { error: String(e) }); decision = runMockOrchestrator(fraud, revenue, cx) }
  } else {
    decision = runMockOrchestrator(fraud, revenue, cx)
  }

  log("DECISION", { final: decision.finalDecision, confidence: decision.confidence, severity: decision.severity })
  return decision
}

export function computeDynamicWeights(
  fraud: FraudAgentOutput,
  revenue: RevenueAgentOutput,
  cx: CXAgentOutput
): { fraud: number; revenue: number; cx: number } {
  const BASE = { fraud: 0.62, revenue: 0.23, cx: 0.15 }
  const raw = {
    fraud: BASE.fraud * fraud.dataQuality * fraud.confidence,
    revenue: BASE.revenue * revenue.dataQuality * revenue.confidence,
    cx: BASE.cx * cx.dataQuality * cx.confidence,
  }
  const total = raw.fraud + raw.revenue + raw.cx
  if (total === 0) return BASE
  return {
    fraud: raw.fraud / total,
    revenue: raw.revenue / total,
    cx: raw.cx / total,
  }
}

export function runMockOrchestrator(
  fraud: FraudAgentOutput,
  revenue: RevenueAgentOutput,
  cx: CXAgentOutput
): OrchestratorDecision {
  // Consensus weights (dynamically adjusted by agent data quality)
  const weights = computeDynamicWeights(fraud, revenue, cx)

  // Rule-based resolution
  let finalDecision: OrchestratorDecision["finalDecision"]
  let reasoning: string[] = [
    `Dynamic weights applied: fraud=${weights.fraud.toFixed(2)}, revenue=${weights.revenue.toFixed(2)}, cx=${weights.cx.toFixed(2)}`
  ]
  let tradeoffResolved: string | undefined

  // Safety first: high fraud with low LTV = block
  if (fraud.fraudScore > 0.85 && revenue.customerLTV < 500) {
    finalDecision = "BLOCK"
    reasoning.push("High fraud score exceeds safety threshold", "Customer LTV does not justify risk exposure", "Blocking protects platform integrity")
    tradeoffResolved = "fraud_safety_over_revenue"
  }
  // VIP with fraud: step-up auth (Peter Centgraf pattern)
  else if (fraud.fraudScore > 0.6 && revenue.customerLTV > 1000) {
    finalDecision = "STEP_UP_AUTH"
    reasoning.push(
      `Fraud score ${fraud.fraudScore.toFixed(2)} exceeds threshold but customer LTV (€${revenue.customerLTV}) justifies recovery`,
      "Step-up auth balances fraud protection with customer retention",
      `CX agent: ${cx.churnRisk} churn risk — hard block would likely cause permanent loss`
    )
    tradeoffResolved = "revenue_cx_over_fraud_block"
  }
  // High revenue, low fraud: allow with voucher
  else if (fraud.fraudScore < 0.4 && revenue.revenueAtRisk > 200) {
    finalDecision = "ALLOW"
    reasoning.push(
      "Fraud risk within acceptable range",
      `€${revenue.revenueAtRisk} revenue recovery opportunity`,
      revenue.discountRecommendation ? `${revenue.discountRecommendation} goodwill discount recommended` : "Retry payment link to be sent"
    )
    tradeoffResolved = "revenue_optimized"
  }
  else {
    finalDecision = "HOLD"
    reasoning.push("Mixed signals — holding for manual review", "No dominant risk factor identified")
  }

  const severity = fraud.fraudScore > 0.8 ? "critical" : revenue.revenueAtRisk > 300 ? "high" : "medium"
  const actions: string[] = []
  if (finalDecision === "STEP_UP_AUTH" || finalDecision === "ALLOW") {
    actions.push("Send secure payment retry link to customer")
    if (revenue.discountRecommendation) actions.push(`Apply ${revenue.discountRecommendation} goodwill discount`)
    if (cx.escalateToSupport) actions.push("Notify support team (VIP at-risk)")
  }
  if (finalDecision === "BLOCK") actions.push("Block transaction", "Log fraud event for review")

  return {
    finalDecision,
    confidence: Math.round((weights.fraud * fraud.confidence + weights.revenue * revenue.confidence + weights.cx * cx.confidence) * 100) / 100,
    severity,
    reasoning,
    actions,
    customerMessage: cx.customerMessage,
    consensusWeights: weights,
    tradeoffResolved,
    revenueAtRisk: revenue.revenueAtRisk,
  }
}

async function runOrchestratorLLM(
  event: CommerceEvent,
  ctx: MCPCustomerContext | null,
  fraud: FraudAgentOutput,
  revenue: RevenueAgentOutput,
  cx: CXAgentOutput
): Promise<OrchestratorDecision> {
  const { default: OpenAI } = await import("openai")
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a Commerce Operations Orchestrator. Synthesize 3 agent outputs into ONE final decision.
Rules: fraud>0.85 + ltv<500 = BLOCK. fraud>0.6 + ltv>1000 = STEP_UP_AUTH. fraud<0.4 + revenue>200 = ALLOW. else HOLD.
Return JSON: {"finalDecision": "BLOCK|ALLOW|HOLD|STEP_UP_AUTH|THROTTLE", "confidence": 0-1, "severity": "low|medium|high|critical", "reasoning": ["..."], "actions": ["..."], "tradeoffResolved": "string"}`,
      },
      { role: "user", content: JSON.stringify({ event, ctx, fraud, revenue, cx }) },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  })
  const raw = JSON.parse(completion.choices[0].message.content!)
  const mock = runMockOrchestrator(fraud, revenue, cx)
  return { ...mock, ...raw, consensusWeights: mock.consensusWeights, revenueAtRisk: revenue.revenueAtRisk }
}

// ─── FULL PIPELINE ────────────────────────────────────────────

export async function runFullAgentPipeline(
  event: CommerceEvent,
  ctx: MCPCustomerContext | null,
  useLLM = false,
  onProgress?: (type: string, data: any) => void
): Promise<DecisionTrace> {
  console.log(`[PIPELINE] Starting for event: ${event.id} type=${event.type}`)
  const t0 = Date.now()
  const timeline: TraceEntry[] = []
  const ts = () => new Date().toISOString().split("T")[1].replace("Z", "")

  timeline.push({ time: ts(), label: "COMMERCE_EVENT_RECEIVED", type: "event" })
  onProgress?.("event_received", { eventId: event.id, timestamp: Date.now() })

  // ⚡ PREDICTIVE PRE-FETCH — Launch immediately in parallel
  let mcpPrefetchPromise: Promise<MCPCustomerContext> | null = null
  if (!ctx && event.customerId) {
    onProgress?.("mcp_start", { customerId: event.customerId })
    const { prefetchMCPContext } = await import("@/server/mcp/client")
    timeline.push({ time: ts(), label: "MCP_PREFETCH_INITIATED", type: "mcp" })
    mcpPrefetchPromise = prefetchMCPContext(event.customerId)
  }

  // Simulated parallel event normalization / CPU work (zero perceived latency)
  timeline.push({ time: ts(), label: "EVENT_NORMALIZATION", type: "event" })

  // Await the prefetch right before agents need it
  let mcpContext = ctx
  if (mcpPrefetchPromise) {
    const t1 = Date.now()
    try {
      mcpContext = await mcpPrefetchPromise
      onProgress?.("mcp_complete", { context: mcpContext, latencyMs: Date.now() - t1 })
      timeline.push({ time: ts(), label: "MCP_CONTEXT_READY", type: "mcp", durationMs: Date.now() - t1 })
    } catch (e) {
      console.warn("[PIPELINE] MCP prefetch failed, proceeding with null context:", e)
      timeline.push({ time: ts(), label: "MCP_CONTEXT_FETCH_FAILED", type: "mcp" })
    }
  }

  // Parallel agents
  timeline.push({ time: ts(), label: "AGENTS_STARTED_PARALLEL", type: "agent" })
  const { runFraudAgent } = await import("./fraudAgent")
  const { runRevenueAgent } = await import("./revenueAgent")
  const { runCXAgent } = await import("./cxAgent")

  const t2 = Date.now()
  const [fraud, revenue, cx] = await Promise.all([
    runFraudAgent(event, mcpContext, useLLM).then(res => {
      onProgress?.("agent_complete", { agent: "fraud", result: res })
      return res
    }),
    runRevenueAgent(event, mcpContext, useLLM).then(res => {
      onProgress?.("agent_complete", { agent: "revenue", result: res })
      return res
    }),
    runCXAgent(event, mcpContext, useLLM).then(res => {
      onProgress?.("agent_complete", { agent: "cx", result: res })
      return res
    })
  ] as const)
  timeline.push({ time: ts(), label: "ALL_AGENTS_COMPLETE", type: "agent", durationMs: Date.now() - t2 })

  // Orchestrator
  timeline.push({ time: ts(), label: "CONSENSUS_ENGINE_START", type: "consensus" })
  const t3 = Date.now()
  const decision = await runOrchestrator(event, mcpContext, fraud, revenue, cx, useLLM)
  onProgress?.("decision_final", { decision, confidence: decision.confidence })
  timeline.push({ time: ts(), label: "CONSENSUS_ENGINE_COMPLETE", type: "consensus", durationMs: Date.now() - t3 })

  // Write actions
  let writeActions = undefined
  if (process.env.BLOOMREACH_API_TOKEN && event.customerId) {
    timeline.push({ time: ts(), label: "BLOOMREACH_WRITE_START", type: "write" })
    onProgress?.("write_start", { customerId: event.customerId })
    try {
      writeActions = await executeAgentDecisionWrites(event.customerId, decision.finalDecision, {
        revenueAtRisk: revenue.revenueAtRisk,
        churnRisk: cx.churnRisk,
        fraudScore: fraud.fraudScore,
      })
      onProgress?.("write_complete", { success: true })
      timeline.push({ time: ts(), label: "BLOOMREACH_WRITE_COMPLETE", type: "write" })
    } catch (e) { console.warn("[PIPELINE] Write failed:", e) }
  }

  timeline.push({ time: ts(), label: `FINAL_DECISION: ${decision.finalDecision}`, type: "decision" })

  const trace: DecisionTrace = {
    id: `trace_${event.id}`,
    transactionId: event.id,
    timeline,
    agents: { fraud, revenue, cx },
    orchestrator: decision,
    consensusWeights: decision.consensusWeights,
    finalDecision: decision.finalDecision,
    confidence: decision.confidence,
    reasoning: decision.reasoning,
    mcpContextSources: mcpContext?.toolsUsed ?? [],
    paypalData: event.paypalData,
    writeActions,
    timestamp: Date.now(),
  }

  // ── SRE Observability envelope + Memory graph ──────────────
  try {
    const { buildObservabilityEnvelope } = await import("@/lib/observabilityEnvelope")
    trace.observability = buildObservabilityEnvelope(trace)
  } catch (e) { console.warn("[PIPELINE] Observability envelope failed:", e) }

  try {
    const { buildAgentMemoryGraph } = await import("@/lib/memoryGraph")
    trace.memoryGraph = buildAgentMemoryGraph(trace)
  } catch (e) { console.warn("[PIPELINE] Memory graph failed:", e) }

  // ── Incident logging ───────────────────────────────────────
  try {
    const { reconstructIncidentFromTrace } = await import("@/lib/incidentReconstructor")
    const incident = reconstructIncidentFromTrace(trace)
    if (incident && incident.severity >= 40) {
      const fs = require("fs"), path = require("path")
      const dir = path.join(process.cwd(), "local-prints")
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const line = JSON.stringify({
        ts: new Date().toISOString(),
        traceId: trace.id,
        incidentType: incident.type,
        severity: incident.severity,
        rootCause: incident.rootCause?.name,
        narrative: incident.narrative,
        decision: trace.finalDecision,
      })
      fs.appendFileSync(path.join(dir, "sre-decisions.log"), line + "\n")
    }
  } catch (e) { console.warn("[PIPELINE] Incident logging failed:", e) }

  const elapsed = Date.now() - t0
  console.log(`[PIPELINE] Complete in ${elapsed}ms — Decision: ${decision.finalDecision} (${(decision.confidence*100).toFixed(0)}% confidence)`)
  onProgress?.("trace_complete", { trace })
  return trace
}

