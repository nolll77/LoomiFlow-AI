// lib/orderBookEngine.ts
import { AgentOrder, OrderBook, FraudAgentOutput, RevenueAgentOutput, CXAgentOutput } from "@/core/shared/types"

export function agentsToOrders(
  fraud: any,
  revenue: any,
  cx: any,
  transactionId: string
): AgentOrder[] {
  const fraudDecision = fraud.fraudScore > 0.7 ? "BLOCK" : fraud.fraudScore > 0.4 ? "HOLD" : "ALLOW"
  const revenueDecision = revenue.priority === "critical" || revenue.priority === "high" ? "ALLOW" : "HOLD"
  const cxDecision = cx.churnRisk === "high" ? "HOLD" : "ALLOW"

  return [
    { agent: "fraud", side: "BUY", decision: fraudDecision, size: fraud.fraudScore, timestamp: Date.now(), transactionId },
    { agent: "revenue", side: "BUY", decision: revenueDecision, size: Math.min(1, revenue.revenueAtRisk / 500), timestamp: Date.now(), transactionId },
    { agent: "cx", side: "BUY", decision: cxDecision, size: cx.churnRisk === "high" ? 0.72 : 0.4, timestamp: Date.now(), transactionId },
  ]
}

export function buildOrderBook(orders: AgentOrder[]): OrderBook {
  const book = { BLOCK: 0, HOLD: 0, ALLOW: 0 }
  for (const o of orders) book[o.decision] += o.size
  const total = book.BLOCK + book.HOLD + book.ALLOW || 1

  const dominant = (Object.entries(book).sort((a, b) => b[1] - a[1])[0][0]) as "BLOCK" | "HOLD" | "ALLOW"
  const blockPct = book.BLOCK / total
  const sentiment: OrderBook["marketSentiment"] =
    blockPct > 0.5 ? "FRAUD_DOMINANT" :
    book.ALLOW / total > 0.5 ? "REVENUE_DOMINANT" :
    Math.abs(book.BLOCK / total - book.ALLOW / total) < 0.1 ? "BALANCED" : "VOLATILE"

  return {
    ...book,
    total,
    dominantDecision: dominant,
    marketSentiment: sentiment,
    midPrice: { blockPressure: book.BLOCK / total, holdPressure: book.HOLD / total, allowPressure: book.ALLOW / total },
  }
}
