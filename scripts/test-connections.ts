// scripts/test-connections.ts
// Run: npx tsx scripts/test-connections.ts
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

async function main() {
  console.log("=".repeat(60))
  console.log("  LOOMIFLOW AI — Connection Test Suite v2")
  console.log("  " + new Date().toISOString())
  console.log("=".repeat(60))

  const results: Record<string, boolean> = {}

  // ─── ENV CHECK ───────────────────────────────────────────────
  console.log("\n📋 Environment Variables:")
  const required = [
    "MCP_URL", "BLOOMREACH_PROJECT_TOKEN", "BLOOMREACH_ENGAGEMENT_URL",
    "BLOOMREACH_API_BASE", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET",
    "PAYPAL_SANDBOX_BASE_URL",
  ]
  const optional = ["OPENAI_API_KEY", "BLOOMREACH_API_TOKEN", "LOOMI_PROJECT_ID"]

  let envOk = true
  for (const k of required) {
    const v = process.env[k]
    if (!v) { console.error(`  ❌ MISSING: ${k}`); envOk = false }
    else console.log(`  ✅ ${k} = ${v.slice(0, 50)}${v.length > 50 ? "..." : ""}`)
  }
  for (const k of optional) {
    const v = process.env[k]
    if (!v) console.warn(`  ⚠️  ${k} = NOT SET (optional but recommended)`)
    else console.log(`  ✅ ${k} = ${v.slice(0, 20)}...`)
  }

  // Critical: trailing slash check
  if (process.env.MCP_URL?.endsWith("/")) {
    console.error("\n  🚨 CRITICAL: MCP_URL has trailing slash! Fix: remove the /")
    console.error(`     Current: ${process.env.MCP_URL}`)
    console.error(`     Correct: ${process.env.MCP_URL.slice(0, -1)}`)
  }
  results.env = envOk

  // ─── MCP WHOAMI ───────────────────────────────────────────────
  console.log("\n🔌 MCP: Testing whoami...")
  try {
    const t0 = Date.now()
    const res = await fetch(process.env.MCP_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/call", id: 1, params: { name: "whoami", arguments: {} } }),
      signal: AbortSignal.timeout(15000),
    })
    const d = await res.json()
    const ms = Date.now() - t0
    results.mcpWhoami = res.ok
    console.log(`  ${res.ok ? "✅" : "❌"} HTTP ${res.status} in ${ms}ms`)
    if (d.result) console.log("  Result:", JSON.stringify(d.result).slice(0, 100))
    if (d.error) console.error("  Error:", d.error)
  } catch (e: any) {
    results.mcpWhoami = false
    console.error("  ❌ FAILED:", e.message)
  }

  // ─── MCP TOOLS LIST ───────────────────────────────────────────
  console.log("\n🛠️  MCP: Fetching tools list...")
  try {
    const res = await fetch(process.env.MCP_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 2, params: {} }),
      signal: AbortSignal.timeout(15000),
    })
    const d = await res.json()
    const tools: string[] = (d.result?.tools ?? []).map((t: any) => t.name)
    results.mcpTools = tools.length > 0
    console.log(`  ${tools.length > 0 ? "✅" : "❌"} ${tools.length} tools found`)

    const expectedTools = [
      "get_customer_properties",
      "get_customer_prediction_score",
      "list_customers",
      "execute_analytics",
      "get_scenario",
      "get_api_trigger",
    ]
    for (const t of expectedTools) {
      console.log(`  ${tools.includes(t) ? "✅" : "⚠️ "} ${t}`)
    }
    if (tools.length > 0) {
      console.log("  All tools:", tools.join(", ").slice(0, 200))
    }
  } catch (e: any) {
    results.mcpTools = false
    console.error("  ❌ FAILED:", e.message)
  }

  // ─── PAYPAL AUTH ──────────────────────────────────────────────
  console.log("\n💳 PayPal: Testing OAuth...")
  try {
    const creds = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64")
    const t0 = Date.now()
    const res = await fetch(`${process.env.PAYPAL_SANDBOX_BASE_URL}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(10000),
    })
    const d = await res.json()
    const ms = Date.now() - t0
    results.paypal = !!d.access_token
    console.log(`  ${d.access_token ? "✅" : "❌"} Token obtained in ${ms}ms`)
    if (d.access_token) console.log(`  Expires in: ${d.expires_in}s`)
    else console.error("  Error:", JSON.stringify(d).slice(0, 100))
  } catch (e: any) {
    results.paypal = false
    console.error("  ❌ FAILED:", e.message)
  }

  // ─── BLOOMREACH ENGAGEMENT ────────────────────────────────────
  console.log("\n🌸 Bloomreach: Testing Engagement URL...")
  try {
    const res = await fetch(process.env.BLOOMREACH_ENGAGEMENT_URL!, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
    })
    results.bloomreach = res.status < 500
    console.log(`  ${res.status < 500 ? "✅" : "❌"} HTTP ${res.status}`)
    console.log(`  URL: ${process.env.BLOOMREACH_ENGAGEMENT_URL}`)
    if (!process.env.BLOOMREACH_API_TOKEN) {
      console.warn("  ⚠️  BLOOMREACH_API_TOKEN not set — write operations will be skipped")
    }
    if (!process.env.LOOMI_PROJECT_ID) {
      console.warn("  ⚠️  LOOMI_PROJECT_ID not set — get it from Bloomreach UI > Settings")
    }
  } catch (e: any) {
    results.bloomreach = false
    console.error("  ❌ FAILED:", e.message)
  }

  // ─── OPENAI ───────────────────────────────────────────────────
  console.log("\n🤖 OpenAI: Checking API key...")
  if (process.env.OPENAI_API_KEY) {
    console.log("  ✅ API key configured")
    results.openai = true
  } else {
    console.warn("  ⚠️  Not configured — agents will use mock mode")
    results.openai = false
  }

  // ─── SUMMARY ──────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60))
  console.log("  SUMMARY:")
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${v ? "✅" : "❌"} ${k}`)
  }
  const critical = results.mcpWhoami && results.paypal
  console.log(`\n  Overall: ${critical ? "✅ READY TO BUILD" : "❌ FIX ISSUES ABOVE"}`)
  console.log("=".repeat(60))

  // Write proof
  try {
    const fs = require("fs"), path = require("path")
    const dir = path.join(process.cwd(), "local-proofs")
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, "proof-connections.md"),
      `# Connection Test Results\n${new Date().toISOString()}\n\n` +
        Object.entries(results).map(([k, v]) => `- ${v ? "✅" : "❌"} ${k}`).join("\n") +
        `\n\nOverall: ${critical ? "READY" : "ISSUES FOUND"}`
    )
    console.log("\n  📁 Results saved to local-proofs/proof-connections.md")
  } catch {}
}

main().catch(console.error)
