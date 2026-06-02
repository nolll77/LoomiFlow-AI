import { NextRequest, NextResponse } from "next/server"
import { DEMO_SCENARIOS } from "@/lib/mockEvents"
import { runFullAgentPipeline } from "@/core/agents/orchestrator"

export async function POST(req: NextRequest) {
  const { scenario = "vipPaymentFailure" } = await req.json()
  console.log(`[SIMULATE] Running scenario: ${scenario}`)

  const event = DEMO_SCENARIOS[scenario as keyof typeof DEMO_SCENARIOS]
  if (!event) return NextResponse.json({ error: "Unknown scenario" }, { status: 400 })

  const useLLM = !!process.env.OPENAI_API_KEY && process.env.USE_MOCK_AGENTS !== "true"

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function emit(type: string, data: any) {
        const chunk = `data: ${JSON.stringify({ type, ...data })}\n\n`
        controller.enqueue(encoder.encode(chunk))
      }

      try {
        const trace = await runFullAgentPipeline(event, event.mcpContext ?? null, useLLM, emit)
        try {
          const { sendWebSocket } = await import("@/server/websocket/gateway")
          sendWebSocket({ type: "COCKPIT_EVENT", payload: { event, trace, timestamp: Date.now() } })
        } catch {}
      } catch (e) {
        emit("error", { message: String(e) })
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  })
}
