// components/cockpit/DecisionOrderBook.tsx
// Bloomberg-style order book showing agent voting pressure
"use client"
import { useMemo } from "react"
import { DecisionTrace } from "@/core/shared/types"
import { agentsToOrders, buildOrderBook } from "@/lib/orderBookEngine"

const SENTIMENT_CONFIG = {
  FRAUD_DOMINANT:    { color: "#FF3B3B", label: "FRAUD DOMINANT" },
  REVENUE_DOMINANT:  { color: "#2EE59D", label: "REVENUE DOMINANT" },
  BALANCED:          { color: "#4DA3FF", label: "BALANCED" },
  VOLATILE:          { color: "#FF9F1C", label: "VOLATILE" },
}

export default function DecisionOrderBook({ decision }: { decision: DecisionTrace | null }) {
  const book = useMemo(() => {
    if (!decision) return null
    const orders = agentsToOrders(
      decision.agents.fraud,
      decision.agents.revenue,
      decision.agents.cx,
      decision.transactionId
    )
    return buildOrderBook(orders)
  }, [decision])

  if (!book) return (
    <div className="panel-glass rounded-xl p-3 opacity-40">
      <div className="text-[11px] font-bold text-gray-300 mb-2">ORDER BOOK</div>
      <div className="text-[10px] text-gray-600 text-center py-4">Awaiting decision...</div>
    </div>
  )

  const sentiment = SENTIMENT_CONFIG[book.marketSentiment]

  return (
    <div className="panel-glass rounded-xl p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-gray-300">DECISION ORDER BOOK</span>
        <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: sentiment.color + "22", color: sentiment.color }}>
          {sentiment.label}
        </span>
      </div>

      {/* Dominant */}
      <div className="text-center mb-3">
        <div className="text-[10px] text-gray-500">Dominant Decision</div>
        <div className="text-lg font-bold" style={{
          color: book.dominantDecision === "BLOCK" ? "#FF3B3B" : book.dominantDecision === "ALLOW" ? "#2EE59D" : "#FF9F1C"
        }}>{book.dominantDecision}</div>
      </div>

      {/* Pressure bars */}
      <div className="space-y-2">
        {[
          { label: "BLOCK",  value: book.BLOCK,  pressure: book.midPrice.blockPressure,  color: "#FF3B3B" },
          { label: "HOLD",   value: book.HOLD,   pressure: book.midPrice.holdPressure,   color: "#FF9F1C" },
          { label: "ALLOW",  value: book.ALLOW,  pressure: book.midPrice.allowPressure,  color: "#2EE59D" },
        ].map(row => (
          <div key={row.label}>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span style={{ color: row.color }} className="font-mono">{row.label}</span>
              <span className="text-gray-500">{(row.pressure * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${row.pressure * 100}%`, background: row.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Mid price */}
      <div className="mt-3 pt-2 border-t border-white/5 grid grid-cols-3 gap-1 text-center text-[10px] text-gray-500">
        <div>
          <div className="text-red-400">{(book.midPrice.blockPressure * 100).toFixed(0)}%</div>
          <div>Block</div>
        </div>
        <div>
          <div className="text-yellow-400">{(book.midPrice.holdPressure * 100).toFixed(0)}%</div>
          <div>Hold</div>
        </div>
        <div>
          <div className="text-green-400">{(book.midPrice.allowPressure * 100).toFixed(0)}%</div>
          <div>Allow</div>
        </div>
      </div>
    </div>
  )
}
