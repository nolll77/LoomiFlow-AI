import { NextRequest, NextResponse } from "next/server"
import { DEMO_SCENARIOS } from "@/lib/mockEvents"
import { runFullAgentPipeline } from "@/core/agents/orchestrator"

export async function POST(req: NextRequest) {
  const { scenario = "vipPaymentFailure" } = await req.json()
  console.log(`[SIMULATE] Running scenario: ${scenario}`)

  const event = DEMO_SCENARIOS[scenario as keyof typeof DEMO_SCENARIOS]
  if (!event) return NextResponse.json({ error: "Unknown scenario" }, { status: 400 })

  const useLLM = !!process.env.OPENAI_API_KEY && process.env.USE_MOCK_AGENTS !== "true"
  const trace = await runFullAgentPipeline(event, event.mcpContext ?? null, useLLM)

  try {
    const { sendWebSocket } = await import("@/server/websocket/gateway")
    sendWebSocket({ type: "COCKPIT_EVENT", payload: { event, trace, timestamp: Date.now() } })
  } catch {}

  return NextResponse.json({ success: true, scenario, trace })
}
