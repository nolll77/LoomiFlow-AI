"use client"
import { CommerceEvent, DecisionTrace } from "@/core/shared/types"

const EVENT_COLOR: Record<string, string> = {
  payment_failed: "#ef4444", cart_abandonment: "#f59e0b", conversion_anomaly: "#3b82f6",
  fraud_detected: "#ef4444", vip_at_risk: "#8b5cf6", checkout_initiated: "#10b981",
}
const EVENT_ICON: Record<string, string> = {
  payment_failed: "💳", cart_abandonment: "🛒", conversion_anomaly: "📊",
  fraud_detected: "⚠️", vip_at_risk: "👑", checkout_initiated: "✓",
}

export default function EventStream({ events, lastDecision }: { events: CommerceEvent[]; lastDecision: DecisionTrace | null }) {
  return (
    <div className="panel-glass rounded-[28px] p-5 flex-1 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Event stream</span>
        <span className="text-sm text-slate-500">{events.length} events</span>
      </div>
      <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
        {events.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-12">Waiting for events...</div>
        ) : (
          events.map((e, i) => (
            <div key={e.id + i} className={`flex items-start gap-3 rounded-[24px] border border-slate-200/80 bg-white/70 p-4 transition ${i === 0 ? "shadow-sm" : ""}`}>
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-100 text-base text-slate-700">{EVENT_ICON[e.type] ?? "◆"}</div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-900">
                  <span style={{ color: EVENT_COLOR[e.type] ?? "#0f172a" }}>{e.type.replace(/_/g, " ")}</span>
                  {e.value && <span className="text-slate-500">€{e.value.toFixed(0)}</span>}
                </div>
                <div className="text-sm text-slate-500 truncate mt-1">{e.customerId}</div>
              </div>
              {e.fraudScore && e.fraudScore > 0.5 && (
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">⚠ {(e.fraudScore * 100).toFixed(0)}%</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
