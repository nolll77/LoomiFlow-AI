"use client"
import { CommerceEvent, DecisionTrace } from "@/core/shared/types"

const EVENT_COLOR: Record<string, string> = {
  payment_failed: "#FF3B3B", cart_abandonment: "#FF9F1C", conversion_anomaly: "#4DA3FF",
  fraud_detected: "#FF3B3B", vip_at_risk: "#8B5CF6", checkout_initiated: "#2EE59D",
}
const EVENT_ICON: Record<string, string> = {
  payment_failed: "💳", cart_abandonment: "🛒", conversion_anomaly: "📊",
  fraud_detected: "⚠️", vip_at_risk: "👑", checkout_initiated: "✓",
}

export default function EventStream({ events, lastDecision }: { events: CommerceEvent[]; lastDecision: DecisionTrace | null }) {
  return (
    <div className="panel-glass rounded-xl p-3 flex-1 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-gray-300">EVENT STREAM</span>
        <span className="text-[10px] text-gray-500">{events.length} events</span>
      </div>
      <div className="space-y-1.5 overflow-y-auto max-h-[340px]">
        {events.length === 0 ? (
          <div className="text-[11px] text-gray-600 text-center py-8">Waiting for events...</div>
        ) : (
          events.map((e, i) => (
            <div key={e.id + i} className={`flex items-start gap-2 text-[10px] p-2 rounded transition-all ${i === 0 ? "bg-white/5" : ""}`}>
              <span>{EVENT_ICON[e.type] ?? "◆"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span style={{ color: EVENT_COLOR[e.type] ?? "#fff" }} className="font-medium">{e.type.replace(/_/g, " ")}</span>
                  {e.value && <span className="text-gray-500">€{e.value.toFixed(0)}</span>}
                </div>
                <div className="text-gray-600 truncate">{e.customerId}</div>
              </div>
              {e.fraudScore && e.fraudScore > 0.5 && (
                <span className="text-red-400 text-[9px]">⚠ {(e.fraudScore * 100).toFixed(0)}%</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
