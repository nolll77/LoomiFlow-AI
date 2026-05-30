import { NextResponse } from "next/server"
import { mcpWhoami, listMCPTools, listCustomers, listScenarios, listApiTriggers } from "@/server/mcp/client"

export async function GET() {
  console.log("[MCP-TEST] Running tests...")
  const r: Record<string, any> = {}

  const whoami = await mcpWhoami()
  r.whoami = { ok: !whoami.error, latencyMs: whoami.latencyMs, error: whoami.error }

  try { const tools = await listMCPTools(); r.tools = { count: tools.length, sample: tools.slice(0,8).map((t:any)=>t.name) } }
  catch (e: any) { r.tools = { error: e.message } }

  const customers = await listCustomers(3)
  r.customers = { ok: !customers.error, latencyMs: customers.latencyMs, error: customers.error }

  const scenarios = await listScenarios()
  r.scenarios = { ok: !scenarios.error, latencyMs: scenarios.latencyMs, error: scenarios.error }

  const triggers = await listApiTriggers()
  r.apiTriggers = { ok: !triggers.error, latencyMs: triggers.latencyMs, error: triggers.error }

  console.log("[MCP-TEST] Complete:", Object.entries(r).map(([k,v])=>`${k}:${(v as any).ok?'✅':'❌'}`).join(" "))
  return NextResponse.json({ status: !whoami.error ? "ok" : "error", results: r })
}
