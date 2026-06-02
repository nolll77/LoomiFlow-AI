// core/context/stateBuilder.ts
// V4 — Construit le CommerceKnowledgeState depuis MCP + analyzeBehavior
// Branché sur les helpers V3 existants (sessionLedger, behaviorAnalyzer, mcpRouter)

import type { CommerceEvent, MCPCustomerContext } from "@/core/shared/types"
import type {
  CommerceKnowledgeState,
  CustomerState,
  RevenueState,
  FraudState,
  CatalogState,
  CampaignState,
} from "@/core/shared/commerceState"
import { analyzeBehavior, type BehavioralFingerprint } from "@/core/mcp/behaviorAnalyzer"
import { getAdaptedThresholds, getLedgerStats } from "@/lib/sessionLedger"

// ─── MCP TOOL ROUTING ─────────────────────────────────────────
// Réutilise la logique V3 : n'appelle que les tools nécessaires

const MCP_TOOL_MAP: Record<string, string[]> = {
  payment_failed:      ["get_customer_profile", "get_fraud_signals", "list_customer_events", "get_transaction_history"],
  checkout:            ["get_customer_profile", "get_fraud_signals", "list_customer_events"],
  refund_requested:    ["get_customer_profile", "list_customer_events", "get_revenue_metrics"],
  churn_signal:        ["get_customer_profile", "list_customer_events", "get_revenue_metrics"],
  fraud_spike:         ["get_fraud_signals", "get_transaction_history", "list_customer_events"],
  normal_transaction:  ["get_customer_profile", "get_fraud_signals"],
}

function selectMCPTools(eventType: string): string[] {
  return MCP_TOOL_MAP[eventType] ?? ["get_customer_profile", "get_fraud_signals"]
}

// Protection contre le bug ids.cookie sur les profils multi-device ( Tomasz Kuczmarski )
function safeParseCookie(ids: any): string | null {
  if (!ids?.cookie) return null
  if (Array.isArray(ids.cookie)) return ids.cookie[0] ?? null
  return ids.cookie
}

// ─── STATE BUILDERS ───────────────────────────────────────────

function buildCustomerState(
  ctx: MCPCustomerContext | null,
  fingerprint: BehavioralFingerprint
): CustomerState {
  const ltv = ctx?.ltv ?? 0
  const rawTier = ctx?.tier
  const tier: CustomerState["tier"] =
    rawTier === "VIP" ? "VIP" :
    rawTier === "premium" ? "PREMIUM" :
    ltv > 5000 ? "VIP" : ltv > 1000 ? "PREMIUM" : ltv > 0 ? "STANDARD" : "NEW"

  // Extraction sécurisée des cookies
  const rawIds = ctx?.ids ?? ctx?.properties?.ids
  const cookieId = safeParseCookie(rawIds)

  return {
    customerId:          ctx?.customerId ?? "unknown",
    tier,
    ltv,
    churnScore:          ctx?.churnRisk === "high" ? 0.8 : ctx?.churnRisk === "medium" ? 0.5 : 0.2,
    engagementScore:     0.5,   // feed réel via MCP analytics
    purchaseFrequency:   ctx?.totalOrders ? ctx.totalOrders / 30 : 0,
    lastPurchaseDaysAgo: 0,     // feed réel via MCP
    emailOpenRate:       0.3,   // feed réel via MCP
    supportTicketsOpen:  0,     // feed réel via MCP
    segments:            ctx?.segmentIds ?? [],
    journeyState:        fingerprint.journeyState ?? "browsing",
    behavioralFingerprint: fingerprint,
    cookieId,
  }
}

function buildRevenueState(
  ctx: MCPCustomerContext | null,
  event: CommerceEvent
): RevenueState {
  const ltv = ctx?.ltv ?? 0
  const eventValue = event.value ?? 0
  return {
    revenueAtRisk:      eventValue,
    cartValue:          eventValue,
    recoveryPotential:  Math.round(ltv * 0.15),
    campaignROI:        1.4,
    conversionRate:     0.032,
    aov:                ltv / Math.max(1, ctx?.totalOrders ?? 1),
    forecastedLTV:      ltv * 1.2,
  }
}

function buildFraudState(
  ctx: MCPCustomerContext | null,
  fingerprint: BehavioralFingerprint,
  event: CommerceEvent
): FraudState {
  const base = event.fraudScore ?? 0.1
  // Enrichissement behavioral fingerprint (logique V3 réutilisée)
  const enriched = Math.min(1,
    base * 0.6
    + fingerprint.velocityScore * 0.2
    + (fingerprint.deviceChangeDetected ? 0.1 : 0)
    + (fingerprint.unusualHour ? 0.1 : 0)
  )
  const riskLevel: FraudState["riskLevel"] =
    enriched > 0.8 ? "CRITICAL" : enriched > 0.6 ? "HIGH" : enriched > 0.35 ? "MEDIUM" : "LOW"

  const signals: string[] = []
  if (fingerprint.velocityScore > 0.7) signals.push("velocity_anomaly")
  if (fingerprint.deviceChangeDetected)  signals.push("device_change")
  if (fingerprint.unusualHour)           signals.push("unusual_hour")
  if (base > 0.6)                        signals.push("high_base_fraud_score")

  return {
    fraudScore:            base,
    enrichedFraudScore:    enriched,
    velocityScore:         fingerprint.velocityScore,
    deviceChangeDetected:  fingerprint.deviceChangeDetected,
    unusualHour:           fingerprint.unusualHour,
    signals,
    riskLevel,
  }
}

function buildCatalogState(_ctx: MCPCustomerContext | null, toolsUsed: string[]): CatalogState {
  // Détecte si des outils Bloomreach Discovery (recherche/catalogue) sont actifs dans la session
  const hasDiscovery = toolsUsed.some(t =>
    t.includes("search") || t.includes("catalog") || t.includes("product") || t.includes("merch")
  )

  return {
    topUnderperformingProducts: [],
    conversionByCategory:       {},
    stockAlerts:                [],
    trendingProducts:           [],
    searchQualityScore:         hasDiscovery ? 0.75 : null,
    rankingDrift:               hasDiscovery ? 0.12 : 0,
  }
}


function buildCampaignState(_ctx: MCPCustomerContext | null): CampaignState {
  // Données issues MCP campaign — placeholders pour feed réel
  return {
    activeCampaigns:           3,
    campaignPerformance:       "on_target",
    underperformingSegments:   [],
    untappedSegments:          [],
    abTestsRunning:            2,
    nextBestAction:            "send_win_back_email",
  }
}

// ─── MAIN BUILDER ─────────────────────────────────────────────

export async function buildCommerceState(
  event: CommerceEvent,
  ctx: MCPCustomerContext | null,
  toolsUsed: string[]
): Promise<CommerceKnowledgeState> {
  const t0 = Date.now()

  // Smart MCP routing
  const toolsNeeded = selectMCPTools(event.type)

  // Behavioral fingerprint depuis events MCP
  const recentEvents = ctx?.recentEvents ?? []
  const fingerprint  = analyzeBehavior(recentEvents, event)
  const stats        = getLedgerStats()

  const finalTools = toolsUsed.length > 0 ? toolsUsed : toolsNeeded

  return {
    customer:              buildCustomerState(ctx, fingerprint),
    revenue:               buildRevenueState(ctx, event),
    fraud:                 buildFraudState(ctx, fingerprint, event),
    catalog:               buildCatalogState(ctx, finalTools),
    campaign:              buildCampaignState(ctx),
    event,
    mcpToolsUsed:          finalTools,
    contextFetchLatencyMs: Date.now() - t0,

    stateBuiltAt:          Date.now(),
    sessionThresholds:     getAdaptedThresholds(),
    sessionLedgerStats:    {
      totalDecisions:   stats.sessionSize,
      blockRate:        stats.blockRate,
      avgFraudScore:    stats.avgFraudScore,
      avgConfidence:    0.75,
      adaptationActive: stats.adaptationActive,
    },
  }
}
