// core/sre/trafficController.ts
// Dynamic traffic split driven by MCP risk signals
// Replaces static canary (5%→25%→100%) with continuous AI-driven allocation

import { TrafficSplit } from "@/core/shared/types"
import { info } from "@/lib/logger"

function sreLog(step: string, data?: any) {
  info(`SRE Traffic ${step}`, data)
  try {
    const msg = `[SRE][TRAFFIC][${step}][${new Date().toISOString()}] ${
      data ? JSON.stringify(data).slice(0, 200) : ""
    }`
    const fs = require("fs"), path = require("path")
    const dir = path.join(process.cwd(), "local-prints")
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, "sre-decisions.log"), msg + "\n")
  } catch {}
}

export interface TrafficPolicyInput {
  fraudScore: number        // 0–1 from Fraud Agent
  errorRate: number         // 0–1 from system metrics
  latencyMs: number         // current p95 latency
  revenueImpact: number     // EUR at risk
  mcpAnomalyScore?: number  // from execute_analytics
}

// ─── CORE SPLIT COMPUTATION ───────────────────────────────────
// Closed-loop control system:
// high risk → protect PROD → push traffic to canary/shadow
// low risk → PROD gets more → canary observes passively

export function computeTrafficSplit(input: TrafficPolicyInput): TrafficSplit {
  const risk =
    input.fraudScore * 0.50 +
    input.errorRate  * 0.30 +
    Math.min(1, input.latencyMs / 3000) * 0.20

  sreLog("COMPUTE", { risk: risk.toFixed(3), input })

  const safety = Math.max(0, 1 - risk)

  const prod   = Math.max(0.10, safety)
  const canary = Math.min(0.70, risk * 0.80)
  const shadow = Math.max(0, 1 - prod - canary)

  const split = normalize({ prod, canary, shadow })
  sreLog("SPLIT", split)
  return split
}

function normalize(s: TrafficSplit): TrafficSplit {
  const sum = s.prod + s.canary + s.shadow
  if (sum === 0) return { prod: 1, canary: 0, shadow: 0 }
  return {
    prod:   Math.round((s.prod   / sum) * 1000) / 1000,
    canary: Math.round((s.canary / sum) * 1000) / 1000,
    shadow: Math.round((s.shadow / sum) * 1000) / 1000,
  }
}

export function routeRequest(split: TrafficSplit): "PROD" | "CANARY" | "SHADOW" {
  const r = Math.random()
  if (r < split.prod) return "PROD"
  if (r < split.prod + split.canary) return "CANARY"
  return "SHADOW"
}

// ─── MCP CONTROL LAYER (closed-loop brain) ────────────────────
// Called every ~5s with latest event + MCP analytics

export function mcpTrafficController(event: {
  fraudScore?: number
  anomalyScore?: number
  geoRisk?: boolean
  errorRate?: number
  latencyMs?: number
  revenueImpact?: number
}): { split: TrafficSplit; riskScore: number; reasoning: string[] } {

  const riskScore =
    (event.fraudScore    ?? 0) * 0.5 +
    (event.anomalyScore  ?? 0) * 0.3 +
    (event.geoRisk ? 0.2 : 0)

  const split = computeTrafficSplit({
    fraudScore:    event.fraudScore    ?? 0,
    errorRate:     event.errorRate     ?? 0,
    latencyMs:     event.latencyMs     ?? 0,
    revenueImpact: event.revenueImpact ?? 0,
    mcpAnomalyScore: event.anomalyScore,
  })

  const reasoning: string[] = []
  if ((event.fraudScore ?? 0) > 0.6) reasoning.push(`High fraud signal (${((event.fraudScore ?? 0) * 100).toFixed(0)}%) → reduce PROD exposure`)
  if ((event.errorRate ?? 0) > 0.02) reasoning.push(`Error rate ${((event.errorRate ?? 0) * 100).toFixed(1)}% → shift to canary`)
  if ((event.latencyMs ?? 0) > 1000) reasoning.push(`Latency ${event.latencyMs}ms → observe in shadow`)
  if (reasoning.length === 0) reasoning.push("Nominal conditions — PROD serving majority")

  return { split, riskScore, reasoning }
}

// ─── FRAUD SPIKE SCENARIO ─────────────────────────────────────
// Input: fraudScore = 0.92
// Output: prod=0.25, canary=0.60, shadow=0.15
// GPU: red tint, fragmented flow, cluster isolation

export function getFraudSpikeScenario(): TrafficSplit {
  return computeTrafficSplit({
    fraudScore: 0.92,
    errorRate: 0.08,
    latencyMs: 1800,
    revenueImpact: 500,
  })
}

// ─── VISUAL METADATA ──────────────────────────────────────────

export function getTrafficVisualConfig(split: TrafficSplit): {
  prodColor: string
  canaryColor: string
  shadowColor: string
  alertLevel: "none" | "warning" | "critical"
} {
  const alertLevel =
    split.canary > 0.5 ? "critical" :
    split.canary > 0.3 ? "warning" : "none"

  return {
    prodColor:   split.prod   > 0.6 ? "#2EE59D" : "#FF9F1C",
    canaryColor: split.canary > 0.4 ? "#FF3B3B" : "#FF9F1C",
    shadowColor: "#4DA3FF",
    alertLevel,
  }
}
