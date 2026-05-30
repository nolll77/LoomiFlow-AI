import { NextResponse } from "next/server"
export async function GET() {
  console.log("[HEALTH] Running...")
  const r: Record<string, any> = {}

  try {
    const res = await fetch(process.env.MCP_URL!, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "tools/call", id: 1, params: { name: "whoami", arguments: {} } }), signal: AbortSignal.timeout(10000) })
    r.mcp = { status: res.ok ? "ok" : "error", httpStatus: res.status, trailingSlashWarning: process.env.MCP_URL?.endsWith("/") ? "REMOVE SLASH" : "ok" }
    console.log("[HEALTH] MCP:", r.mcp.status)
  } catch (e: any) { r.mcp = { status: "error", error: e.message }; console.error("[HEALTH] MCP failed:", e.message) }

  try {
    const creds = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")
    const res = await fetch(`${process.env.PAYPAL_SANDBOX_BASE_URL}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", signal: AbortSignal.timeout(10000) })
    const d = await res.json()
    r.paypal = { status: d.access_token ? "ok" : "error" }
    console.log("[HEALTH] PayPal:", r.paypal.status)
  } catch (e: any) { r.paypal = { status: "error", error: e.message } }

  r.bloomreach = { projectToken: process.env.BLOOMREACH_PROJECT_TOKEN, hasApiToken: !!process.env.BLOOMREACH_API_TOKEN, loomiProjectId: process.env.LOOMI_PROJECT_ID || "MISSING" }
  r.openai = { configured: !!process.env.OPENAI_API_KEY, mockMode: process.env.USE_MOCK_AGENTS === "true" }

  const healthy = r.mcp?.status === "ok" && r.paypal?.status === "ok"
  console.log(`[HEALTH] ${healthy ? "HEALTHY" : "DEGRADED"}`)
  return NextResponse.json({ status: healthy ? "healthy" : "degraded", services: r }, { status: healthy ? 200 : 207 })
}
