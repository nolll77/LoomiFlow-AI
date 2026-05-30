// core/shared/types.ts
// MASTER TYPE DEFINITIONS — toutes les interfaces du projet

export type CommerceEventType =
  | "payment_failed"
  | "cart_abandonment"
  | "checkout_initiated"
  | "conversion_anomaly"
  | "fraud_detected"
  | "vip_at_risk"

export interface CommerceEvent {
  id: string
  type: CommerceEventType
  timestamp: number
  customerId: string
  value?: number
  currency?: string
  fraudScore?: number
  mcpContext?: MCPCustomerContext
  paypalData?: PayPalEventData
  metadata?: Record<string, any>
}

export interface MCPCustomerContext {
  customerId: string
  tier?: "VIP" | "premium" | "standard" | "new"
  ltv?: number
  churnRisk?: "low" | "medium" | "high"
  predictionScore?: number
  totalOrders?: number
  categoryPreference?: string[]
  currentScenario?: string
  segmentIds?: string[]
  availableVouchers?: string[]
  fetchedAt: number
  latencyMs?: number
  cacheHit?: boolean
  toolsUsed?: string[]
  error?: string
}

export interface PayPalEventData {
  transactionId: string
  status: "COMPLETED" | "DECLINED" | "PENDING" | "VOIDED"
  declineReason?: string
  fraudSignals?: {
    velocityAnomaly: boolean
    deviceMismatch: boolean
    geoInconsistency: boolean
    riskScore?: number
  }
  amount: { value: number; currency: string }
  buyerAccountId?: string
  merchantAccountId?: string
}

// ─── AGENT OUTPUTS ───────────────────────────────────────────

export interface AgentOutput {
  agentName: "fraud" | "cx" | "revenue"
  score: number
  confidence: number
  recommendation: "BLOCK" | "ALLOW" | "HOLD" | "STEP_UP_AUTH" | "THROTTLE"
  reasons: string[]
  mcpSourcesUsed: string[]
  latencyMs?: number
}

export interface FraudAgentOutput extends AgentOutput {
  agentName: "fraud"
  fraudScore: number
  signals: string[]
  blockPayment: boolean
}

export interface RevenueAgentOutput extends AgentOutput {
  agentName: "revenue"
  revenueAtRisk: number
  customerLTV: number
  discountRecommendation?: string
  revenueRecoveryProbability?: number
  priority: "low" | "medium" | "high" | "critical"
}

export interface CXAgentOutput extends AgentOutput {
  agentName: "cx"
  churnRisk: "low" | "medium" | "high"
  friction: "low" | "medium" | "high"
  customerMessage?: string
  escalateToSupport: boolean
}

export interface OrchestratorDecision {
  finalDecision: "BLOCK" | "ALLOW" | "HOLD" | "STEP_UP_AUTH" | "THROTTLE"
  confidence: number
  severity: "low" | "medium" | "high" | "critical"
  reasoning: string[]
  actions: string[]
  customerMessage?: string
  consensusWeights: { fraud: number; revenue: number; cx: number }
  tradeoffResolved?: string
  revenueAtRisk?: number
}

// ─── DECISION TRACE ──────────────────────────────────────────

export interface TraceEntry {
  time: string
  label: string
  type: "event" | "agent" | "consensus" | "decision" | "mcp" | "write"
  durationMs?: number
}

export interface WriteActionResult {
  type: "update_customer_property" | "trigger_scenario" | "track_event"
  status: "success" | "failed" | "pending"
  details?: Record<string, any>
  timestamp: number
}

export interface DecisionTrace {
  id: string
  transactionId: string
  timeline: TraceEntry[]
  agents: {
    fraud: FraudAgentOutput
    revenue: RevenueAgentOutput
    cx: CXAgentOutput
  }
  orchestrator: OrchestratorDecision
  consensusWeights: { fraud: number; revenue: number; cx: number }
  finalDecision: string
  confidence: number
  reasoning: string[]
  mcpContextSources: string[]
  paypalData?: PayPalEventData
  writeActions?: WriteActionResult[]
  timestamp: number
  /** SRE observability: token cost + latency breakdown + anomaly flags */
  observability?: ObservabilityEnvelope
  /** AI memory graph: node/edge influence map for explainability */
  memoryGraph?: AgentMemoryGraph
}

// ─── ORDER BOOK ───────────────────────────────────────────────

export interface AgentOrder {
  agent: "fraud" | "revenue" | "cx"
  side: "BUY"
  decision: "BLOCK" | "HOLD" | "ALLOW"
  size: number
  timestamp: number
  transactionId: string
}

export interface OrderBook {
  BLOCK: number
  HOLD: number
  ALLOW: number
  total: number
  dominantDecision: "BLOCK" | "HOLD" | "ALLOW"
  marketSentiment: "FRAUD_DOMINANT" | "REVENUE_DOMINANT" | "BALANCED" | "VOLATILE"
  midPrice: {
    blockPressure: number
    holdPressure: number
    allowPressure: number
  }
}

// ─── HEATMAP ──────────────────────────────────────────────────

export interface HeatmapEvent {
  id: string
  timestamp: number
  type: CommerceEventType
  fraudScore: number
  revenueImpact: number
  customerId?: string
  label?: string
}

// ─── LOAD TEST ────────────────────────────────────────────────

export type LoadTestScenario =
  | "LOW_FRAUD"
  | "BURST"
  | "FRAUD_STORM"
  | "LATENCY_ATTACK"
  | "CHAOS_MIX"

export interface LoadProfile {
  rps: number
  fraudRate: number
  latencySpike: number
  errorRate: number
}

export interface LoadTestReport {
  totalEvents: number
  avgLatency: number
  maxFraudDetected: number
  rollbackTriggered: boolean
  systemStabilityScore: number
  scenarioUsed: LoadTestScenario
}

// ─── TRAFFIC ──────────────────────────────────────────────────

export interface TrafficSplit {
  prod: number
  canary: number
  shadow: number
}

// ─── OBSERVABILITY ────────────────────────────────────────────

export interface ObservabilityEnvelope {
  traceId: string
  tokens: { input: number; output: number; total: number; costUsd: number }
  latency: {
    totalMs: number
    breakdown: {
      mcp: number
      llm: number
      agents: number
      decision: number
    }
    bottleneck: "mcp" | "llm" | "agents" | "decision"
  }
  mcp: {
    toolCalls: number
    successRate: number
    avgLatencyMs: number
    toolsUsed: string[]
    cacheHits: number
  }
  anomalies: (
    | "HIGH_LATENCY"
    | "HIGH_COST"
    | "MCP_FAILURES"
    | "LOW_CONFIDENCE"
  )[]
}

// ─── MEMORY GRAPH ─────────────────────────────────────────────

export type MemoryNodeType =
  | "observation"
  | "tool_call"
  | "state"
  | "decision"
  | "mcp"

export interface MemoryNode {
  id: string
  type: MemoryNodeType
  label: string
  timestamp: number
  value?: number
  metadata?: {
    source?: string
    mcpTool?: string
    latencyMs?: number
    confidence?: number
  }
}

export interface MemoryEdge {
  from: string
  to: string
  weight: number
  reason?: string
}

export interface AgentMemoryGraph {
  agentId: string
  decisionId: string
  nodes: MemoryNode[]
  edges: MemoryEdge[]
  timestamp: number
}

// ─── SYSTEM STATE ─────────────────────────────────────────────

export type SystemMode =
  | "normal"
  | "high_load"
  | "fraud_spike"
  | "canary"
  | "demo"
  | "explainability"

export type HeartbeatState = "idle" | "active" | "busy" | "critical"
export type ConnectionMode = "websocket" | "firebase" | "disconnected"

export interface CockpitState {
  lastEvent: CommerceEvent | null
  lastDecision: DecisionTrace | null
  events: CommerceEvent[]
  connected: boolean
  connectionMode: ConnectionMode
  systemMode: SystemMode
  heartbeatState: HeartbeatState
  heartbeatScore: number
}
