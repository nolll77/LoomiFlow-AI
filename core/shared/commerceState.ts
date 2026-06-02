// core/shared/commerceState.ts
// V4 — Shared Commerce State : cerveau central partagé par tous les agents

import type { CommerceEvent } from "./types"
import type { BehavioralFingerprint } from "@/core/mcp/behaviorAnalyzer"

// ─── CUSTOMER ─────────────────────────────────────────────────

export interface CustomerState {
  customerId: string
  tier: "VIP" | "PREMIUM" | "STANDARD" | "NEW"
  ltv: number
  churnScore: number          // 0-1, issu MCP prediction
  engagementScore: number     // 0-1
  purchaseFrequency: number   // achats / 30 jours
  lastPurchaseDaysAgo: number
  emailOpenRate: number       // 0-1
  supportTicketsOpen: number
  segments: string[]
  journeyState: "browsing" | "evaluating" | "converting" | "churning" | "dormant"
  behavioralFingerprint: BehavioralFingerprint
}

// ─── REVENUE ──────────────────────────────────────────────────

export interface RevenueState {
  revenueAtRisk: number       // valeur de la transaction en cours
  cartValue: number
  recoveryPotential: number   // estimé sur base historique
  campaignROI: number         // ROI dernier campaign
  conversionRate: number      // taux actuel du funnel
  aov: number                 // average order value historique
  forecastedLTV: number       // LTV projetée sur 12 mois
}

// ─── FRAUD ────────────────────────────────────────────────────

export interface FraudState {
  fraudScore: number          // 0-1, base MCP
  enrichedFraudScore: number  // après behavioral fingerprint
  velocityScore: number
  deviceChangeDetected: boolean
  unusualHour: boolean
  signals: string[]
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}

// ─── CATALOG ──────────────────────────────────────────────────

export interface CatalogState {
  topUnderperformingProducts: string[]
  conversionByCategory: Record<string, number>
  stockAlerts: string[]           // produits < 10 unités
  trendingProducts: string[]
  searchQualityScore: number      // 0-1
  rankingDrift: number            // écart entre ranking et performance
}

// ─── CAMPAIGN ─────────────────────────────────────────────────

export interface CampaignState {
  activeCampaigns: number
  campaignPerformance: "above_target" | "on_target" | "below_target"
  underperformingSegments: string[]
  untappedSegments: string[]
  abTestsRunning: number
  nextBestAction: string          // suggestion LLM
}

// ─── SESSION LEARNING ─────────────────────────────────────────

export interface AdaptedThresholds {
  fraudBlockThreshold: number
  fraudStepThreshold: number
  allowRevenueMin: number
}

export interface SessionStats {
  totalDecisions: number
  blockRate: number
  avgFraudScore: number
  avgConfidence: number
  adaptationActive: boolean
}

// ─── MASTER STATE ─────────────────────────────────────────────

export interface CommerceKnowledgeState {
  // Domaines métier
  customer: CustomerState
  revenue: RevenueState
  fraud: FraudState
  catalog: CatalogState
  campaign: CampaignState

  // Méta
  event: CommerceEvent
  mcpToolsUsed: string[]
  contextFetchLatencyMs: number
  stateBuiltAt: number

  // Session learning (V3 adaptive thresholds réutilisés)
  sessionThresholds: AdaptedThresholds
  sessionLedgerStats: SessionStats
}
