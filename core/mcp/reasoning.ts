// core/mcp/reasoning.ts
// MCP context → structured reasoning for agents
// Maps raw MCP tool outputs to agent-consumable signals

import { MCPCustomerContext } from "@/core/shared/types"

function reasonLog(step: string, d?: any) {
  console.log(`[MCP][REASONING][${step}] ${d ? JSON.stringify(d).slice(0,150) : ""}`)
}

export interface MCPReasoning {
  riskLevel: "low" | "medium" | "high" | "critical"
  protectCustomer: boolean
  blockPayment: boolean
  signals: string[]
  confidence: number
  recommendedAction: "BLOCK" | "ALLOW" | "STEP_UP_AUTH" | "HOLD"
  contextQuality: "rich" | "partial" | "minimal" | "none"
}

export function buildMCPReasoning(ctx: MCPCustomerContext | null): MCPReasoning {
  if (!ctx) {
    reasonLog("NO_CONTEXT")
    return {
      riskLevel: "medium",
      protectCustomer: false,
      blockPayment: false,
      signals: ["No MCP context available — using defaults"],
      confidence: 0.4,
      recommendedAction: "HOLD",
      contextQuality: "none",
    }
  }

  const signals: string[] = []
  let riskScore = 0

  // LTV signals
  if (ctx.ltv && ctx.ltv > 2000) { signals.push(`High-value customer (LTV €${ctx.ltv})`); riskScore -= 0.2 }
  else if (ctx.ltv && ctx.ltv > 500) { signals.push(`Mid-value customer (LTV €${ctx.ltv})`); riskScore -= 0.1 }

  // Tier signals
  if (ctx.tier === "VIP") { signals.push("VIP tier — recovery prioritized"); riskScore -= 0.15 }
  else if (ctx.tier === "new") { signals.push("New customer — limited history"); riskScore += 0.1 }

  // Churn signals
  if (ctx.churnRisk === "high") { signals.push(`High churn risk (score: ${ctx.predictionScore?.toFixed(2)})`); riskScore += 0.15 }
  if (ctx.churnRisk === "low") { signals.push("Low churn risk — customer is engaged") }

  // Order history
  if (ctx.totalOrders && ctx.totalOrders > 10) signals.push(`${ctx.totalOrders} previous orders — trusted customer`)
  if (ctx.totalOrders === 0) { signals.push("No order history"); riskScore += 0.1 }

  // MCP latency quality
  const contextQuality: MCPReasoning["contextQuality"] =
    ctx.toolsUsed && ctx.toolsUsed.length >= 3 ? "rich" :
    ctx.toolsUsed && ctx.toolsUsed.length >= 1 ? "partial" : "minimal"

  const normalizedRisk = Math.max(0, Math.min(1, 0.5 + riskScore))
  const riskLevel: MCPReasoning["riskLevel"] =
    normalizedRisk > 0.75 ? "critical" :
    normalizedRisk > 0.55 ? "high" :
    normalizedRisk > 0.35 ? "medium" : "low"

  const protectCustomer = ctx.tier === "VIP" || (ctx.ltv ?? 0) > 1000 || ctx.churnRisk === "high"
  const blockPayment = riskLevel === "critical" && !protectCustomer

  const recommendedAction: MCPReasoning["recommendedAction"] =
    blockPayment ? "BLOCK" :
    protectCustomer && riskLevel !== "low" ? "STEP_UP_AUTH" :
    riskLevel === "low" ? "ALLOW" : "HOLD"

  reasonLog("BUILT", { riskLevel, recommendedAction, contextQuality, signalCount: signals.length })

  return {
    riskLevel,
    protectCustomer,
    blockPayment,
    signals,
    confidence: contextQuality === "rich" ? 0.88 : contextQuality === "partial" ? 0.72 : 0.55,
    recommendedAction,
    contextQuality,
  }
}
