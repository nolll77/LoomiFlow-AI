"use client"
import { DecisionTrace, CommerceEvent } from "@/core/shared/types"

const DECISION_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  BLOCK:        { color: "#FF3B3B", icon: "🚫", label: "BLOCKED" },
  ALLOW:        { color: "#2EE59D", icon: "✅", label: "ALLOWED" },
  HOLD:         { color: "#FF9F1C", icon: "⏸", label: "HELD" },
  STEP_UP_AUTH: { color: "#4DA3FF", icon: "🔐", label: "STEP-UP AUTH" },
  THROTTLE:     { color: "#8B5CF6", icon: "🔄", label: "THROTTLED" },
}

export default function ActionPanel({ decision, event }: { decision: DecisionTrace | null; event: CommerceEvent | null }) {
  if (!decision) return (
    <div className="panel-glass rounded-xl p-4 text-center opacity-40">
      <span className="text-xs text-gray-500">No decision yet</span>
    </div>
  )

  const o = decision.orchestrator
  const cfg = DECISION_CONFIG[o.finalDecision] ?? DECISION_CONFIG["HOLD"]

  return (
    <div className="panel-glass rounded-xl p-4 space-y-3">
      <div className="text-[11px] font-bold text-gray-300">ACTION PANEL</div>

      {/* Final decision hero */}
      <div className="text-center py-3 rounded-lg" style={{ background: `${cfg.color}11`, border: `1px solid ${cfg.color}33` }}>
        <div className="text-2xl mb-1">{cfg.icon}</div>
        <div className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label}</div>
        <div className="text-[10px] text-gray-500 mt-1">
          {(o.confidence * 100).toFixed(0)}% confidence · {o.severity} severity
        </div>
      </div>

      {/* Customer message */}
      {o.customerMessage && (
        <div className="bg-blue-400/5 border border-blue-400/20 rounded-lg p-3">
          <div className="text-[10px] text-blue-400 mb-1">✉ CUSTOMER MESSAGE</div>
          <div className="text-[11px] text-gray-300 leading-relaxed">{o.customerMessage}</div>
        </div>
      )}

      {/* Write actions */}
      {decision.writeActions && decision.writeActions.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-gray-500">BLOOMREACH WRITES</div>
          {decision.writeActions.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span className={a.status === "success" ? "text-green-400" : a.status === "failed" ? "text-red-400" : "text-yellow-400"}>
                {a.status === "success" ? "✓" : a.status === "failed" ? "✗" : "⏳"}
              </span>
              <span className="text-gray-400">{a.type.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      )}

      {/* MCP sources */}
      {decision.mcpContextSources.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 mb-1">MCP INTELLIGENCE USED</div>
          <div className="flex flex-wrap gap-1">
            {decision.mcpContextSources.map(t => (
              <span key={t} className="text-[9px] text-purple-400/80 bg-purple-400/10 rounded px-1.5 py-0.5">
                {t.replace("get_", "").replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
