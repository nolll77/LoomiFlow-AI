// server/mcp/client.ts
// LOOMI CONNECT MCP CLIENT — 83 tools confirmed
// URL sans trailing slash (Saurav @here May 27, 2026)

import { MCPCustomerContext } from "@/core/shared/types"

const MCP_URL = process.env.MCP_URL!
// Should be: https://loomi-mcp-alpha.bloomreach.com/mcp (NO slash)

// ─── LOGGING ──────────────────────────────────────────────────

function mcpLog(tool: string, status: "START" | "OK" | "ERROR" | "SLOW", data?: any) {
  const msg = `[MCP][${status}][${new Date().toISOString()}] tool=${tool} ${
    data ? JSON.stringify(data).slice(0, 200) : ""
  }`
  console.log(msg)
  // Write to local print file
  try {
    const fs = require("fs")
    const path = require("path")
    const dir = path.join(process.cwd(), "local-prints")
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, "mcp-calls.log"), msg + "\n")
  } catch {
    // non-blocking
  }
}

// ─── CORE CALLER ──────────────────────────────────────────────

interface MCPCallResult {
  result: any
  latencyMs: number
  cached: boolean
  error: string | null
  toolName: string
}

async function mcpCall(
  endpoint: string,
  toolName: string,
  args: Record<string, any> = {}
): Promise<MCPCallResult> {
  const t0 = Date.now()
  mcpLog(toolName, "START", { argKeys: Object.keys(args) })

  // Safety check for trailing slash
  if (endpoint.endsWith("/")) {
    console.warn(`[MCP] WARNING: URL has trailing slash! Removing: ${endpoint}`)
    endpoint = endpoint.slice(0, -1)
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        id: `${toolName}_${t0}`,
        params: { name: toolName, arguments: args },
      }),
      signal: AbortSignal.timeout(35000),
    })

    const ms = Date.now() - t0

    if (!res.ok) {
      const errText = await res.text()
      mcpLog(toolName, "ERROR", { status: res.status, body: errText.slice(0, 100) })
      return { result: null, latencyMs: ms, cached: false, error: `HTTP ${res.status}`, toolName }
    }

    const data = await res.json()

    if (ms > 15000) mcpLog(toolName, "SLOW", { latencyMs: ms })
    else mcpLog(toolName, "OK", { latencyMs: ms })

    return { result: data.result, latencyMs: ms, cached: false, error: null, toolName }
  } catch (err: any) {
    const ms = Date.now() - t0
    mcpLog(toolName, "ERROR", { error: err.message, latencyMs: ms })
    return { result: null, latencyMs: ms, cached: false, error: err.message, toolName }
  }
}

const projectId = () => process.env.LOOMI_PROJECT_ID || ""

// ─── DISCOVERY ────────────────────────────────────────────────

export async function listMCPTools() {
  console.log("[MCP] Fetching tools list...")
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1, params: {} }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json()
  const tools = data.result?.tools ?? []
  console.log(`[MCP] ${tools.length} tools available:`, tools.slice(0, 10).map((t: any) => t.name))
  return tools
}

export const mcpWhoami = () => {
  console.log("[MCP] Testing connection with whoami...")
  return mcpCall(MCP_URL, "whoami")
}

// ─── CUSTOMER TOOLS ───────────────────────────────────────────

export const getCustomerProperties = (customerId: string) =>
  mcpCall(MCP_URL, "get_customer_properties", {
    customer_id: customerId,
    project_id: projectId(),
  })

export const getCustomerPredictionScore = (customerId: string) =>
  mcpCall(MCP_URL, "get_customer_prediction_score", {
    customer_id: customerId,
    project_id: projectId(),
  })

export const listCustomerEvents = (customerId: string, limit = 10) =>
  mcpCall(MCP_URL, "list_customer_events", {
    customer_id: customerId,
    project_id: projectId(),
    count: limit,
  })

export const listCustomers = (count = 5, query?: string) =>
  mcpCall(MCP_URL, "list_customers", {
    project_id: projectId(),
    count,
    ...(query && { query }),
  })

export const getSegmentations = () =>
  mcpCall(MCP_URL, "get_segmentations", { project_id: projectId() })

export const listCustomersInSegment = (segmentId: string) =>
  mcpCall(MCP_URL, "list_customers_in_segment", {
    segment_id: segmentId,
    project_id: projectId(),
  })

// ─── ANALYTICS TOOLS ──────────────────────────────────────────

export const executeAnalytics = (query: Record<string, any>) =>
  mcpCall(MCP_URL, "execute_analytics", { ...query, project_id: projectId() })

export const getFunnel = (funnelId: string) =>
  mcpCall(MCP_URL, "get_funnel", { funnel_id: funnelId, project_id: projectId() })

export const listFunnels = () =>
  mcpCall(MCP_URL, "list_funnels", { project_id: projectId() })

export const getTrend = (trendId: string) =>
  mcpCall(MCP_URL, "get_trend", { trend_id: trendId, project_id: projectId() })

// ─── SCENARIO TOOLS ───────────────────────────────────────────

export const getScenario = (scenarioId: string) =>
  mcpCall(MCP_URL, "get_scenario", { scenario_id: scenarioId, project_id: projectId() })

export const listScenarios = () => {
  console.log("[MCP] Listing all scenarios...")
  return mcpCall(MCP_URL, "list_scenarios", { project_id: projectId() })
}

export const getApiTrigger = (triggerId: string) =>
  mcpCall(MCP_URL, "get_api_trigger", { trigger_id: triggerId, project_id: projectId() })

export const listApiTriggers = () => {
  console.log("[MCP] Listing API triggers (key for write operations)...")
  return mcpCall(MCP_URL, "list_api_triggers", { project_id: projectId() })
}

// ─── VOUCHERS / RECOMMENDATIONS ───────────────────────────────

export const getVoucherPool = (poolId: string) =>
  mcpCall(MCP_URL, "get_voucher_pool", { pool_id: poolId })

export const listVoucherPools = () =>
  mcpCall(MCP_URL, "list_voucher_pools", { project_id: projectId() })

export const getRecommendation = (recommendationId: string) =>
  mcpCall(MCP_URL, "get_recommendation", { recommendation_id: recommendationId })

export const getCatalog = (catalogId: string) =>
  mcpCall(MCP_URL, "get_catalog", { catalog_id: catalogId, project_id: projectId() })

// ─── COMPOSITE: FULL CUSTOMER CONTEXT ─────────────────────────

export async function getCustomerFullContext(
  customerId: string
): Promise<MCPCustomerContext> {
  console.log(`[MCP] Building full context for customer: ${customerId}`)
  const t0 = Date.now()

  const [propsResult, predResult, eventsResult] = await Promise.allSettled([
    getCustomerProperties(customerId),
    getCustomerPredictionScore(customerId),
    listCustomerEvents(customerId, 10),
  ])

  const props =
    propsResult.status === "fulfilled" ? propsResult.value.result : null
  const pred =
    predResult.status === "fulfilled" ? predResult.value.result : null

  const ctx: MCPCustomerContext = {
    customerId,
    tier: props?.tier ?? props?.customer_tier ?? "standard",
    ltv: props?.lifetime_value ?? props?.ltv ?? 0,
    churnRisk: pred?.churn_risk ?? pred?.risk_level ?? "medium",
    predictionScore: pred?.score ?? pred?.churn_score ?? 0.5,
    totalOrders: props?.total_orders ?? props?.purchase_count ?? 0,
    categoryPreference: props?.preferred_categories ?? [],
    segmentIds: props?.segment_ids ?? [],
    fetchedAt: Date.now(),
    latencyMs: Date.now() - t0,
    cacheHit: false,
    toolsUsed: [
      "get_customer_properties",
      "get_customer_prediction_score",
      "list_customer_events",
    ],
  }

  console.log(`[MCP] Context built in ${ctx.latencyMs}ms:`, {
    tier: ctx.tier,
    ltv: ctx.ltv,
    churnRisk: ctx.churnRisk,
    predictionScore: ctx.predictionScore,
  })

  return ctx
}
