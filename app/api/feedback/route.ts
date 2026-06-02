import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { traceId, originalDecision, forcedDecision, operatorId } = body

    if (!traceId || !originalDecision || !forcedDecision) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
    }

    // Prepare log entry for simulated reinforcement learning/MLOps
    const logEntry = {
      timestamp: new Date().toISOString(),
      traceId,
      originalDecision,
      forcedDecision,
      operatorId: operatorId || "system",
      status: "pending_retraining",
    }

    const logLine = `[FEEDBACK] ${JSON.stringify(logEntry)}\n`

    // Write to local-prints directory
    const dir = path.join(process.cwd(), "local-prints")
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    fs.appendFileSync(path.join(dir, "ai-feedback.log"), logLine)
    
    console.log(`[FEEDBACK_LOOP] Decision overriden from ${originalDecision} to ${forcedDecision} for trace ${traceId}`)

    return NextResponse.json({ success: true, entry: logEntry })
  } catch (error) {
    console.error("[FEEDBACK_LOOP] Error logging feedback", error)
    return NextResponse.json({ error: "Failed to log feedback" }, { status: 500 })
  }
}
