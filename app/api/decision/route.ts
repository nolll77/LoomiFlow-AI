import { NextRequest } from "next/server"
import { runFullAgentPipeline } from "@/core/agents/orchestrator"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const useLLM = !!process.env.OPENAI_API_KEY && process.env.USE_MOCK_AGENTS !== "true"

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(type: string, data: any) {
        const chunk = `data: ${JSON.stringify({ type, ...data })}\n\n`
        controller.enqueue(encoder.encode(chunk))
      }

      try {
        await runFullAgentPipeline(body, body.mcpContext ?? null, useLLM, emit)
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
