import { NextRequest, NextResponse } from "next/server"
import { normalizePayPalWebhook } from "@/server/paypal/client"
import { runFullAgentPipeline } from "@/core/agents/orchestrator"

export async function POST(req: NextRequest) {
  const body = await req.json()
  console.log("[WEBHOOK][PayPal] Event type:", body.event_type)

  const paypalData = normalizePayPalWebhook(body)
  if (!paypalData) return NextResponse.json({ received: true, processed: false })

  const event = {
    id: `webhook_${Date.now()}`,
    type: "payment_failed" as const,
    timestamp: Date.now(),
    customerId: paypalData.buyerAccountId ?? "unknown",
    value: paypalData.amount.value,
    paypalData,
  }

  const trace = await runFullAgentPipeline(event, null, false)

  try {
    const { sendWebSocket } = await import("@/server/websocket/gateway")
    sendWebSocket({ type: "COCKPIT_EVENT", payload: { event, trace } })
  } catch {}

  return NextResponse.json({ received: true, processed: true, decision: trace.finalDecision })
}
