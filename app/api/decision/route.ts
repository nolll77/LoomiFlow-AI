import { NextRequest, NextResponse } from "next/server"
import { runFullAgentPipeline } from "@/core/agents/orchestrator"

export async function POST(req: NextRequest) {
  const body = await req.json()
  console.log("[DECISION] Received event:", body.type, body.customerId)

  const useLLM = !!process.env.OPENAI_API_KEY && process.env.USE_MOCK_AGENTS !== "true"
  const trace = await runFullAgentPipeline(body, body.mcpContext ?? null, useLLM)

  return NextResponse.json({ success: true, trace })
}
