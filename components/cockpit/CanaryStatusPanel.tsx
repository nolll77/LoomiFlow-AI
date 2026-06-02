// components/cockpit/CanaryStatusPanel.tsx
// Real-time canary rollback visualization
"use client"
import { useState, useEffect } from "react"
import { computeTrafficSplit, getTrafficVisualConfig } from "@/core/sre/trafficController"
import { evaluateRollback, getCanaryPhase } from "@/core/sre/rollback"
import { DecisionTrace } from "@/core/shared/types"

export default function CanaryStatusPanel({ lastDecision }: { lastDecision: DecisionTrace | null }) {
  const [split, setSplit] = useState({ prod: 0.85, canary: 0.10, shadow: 0.05 })
  const [rollback, setRollback] = useState<any>(null)
  const [phase, setPhase] = useState("OBSERVE (5%)")

  useEffect(() => {
    if (!lastDecision) return

    const fraudScore = lastDecision.agents.fraud.fraudScore
    const newSplit = computeTrafficSplit({
      fraudScore,
      errorRate: fraudScore > 0.7 ? 0.04 : 0.005,
      latencyMs: fraudScore > 0.7 ? 1800 : 200,
      revenueImpact: lastDecision.agents.revenue.revenueAtRisk,
    })
    setSplit(newSplit)

    const rb = evaluateRollback({
      errorRate: fraudScore > 0.8 ? 0.06 : 0.005,
      latencyP95Ms: fraudScore > 0.7 ? 1800 : 200,
      fraudRate: fraudScore,
      availabilityPct: 99.8,
    })
    setRollback(rb)
    setPhase(getCanaryPhase(newSplit))
  }, [lastDecision])

  const visual = getTrafficVisualConfig(split)

  return (
    <div className="panel-glass rounded-2xl p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-gray-300">CANARY STATUS</span>
        <span className="text-[10px]" style={{
          color: visual.alertLevel === "critical" ? "#FF3B3B" : visual.alertLevel === "warning" ? "#FF9F1C" : "#2EE59D"
        }}>
          {phase}
        </span>
      </div>

      {/* Traffic lanes */}
      <div className="space-y-2 mb-3">
        {[
          { label: "PROD",   value: split.prod,   color: visual.prodColor,   icon: "🟢" },
          { label: "CANARY", value: split.canary, color: visual.canaryColor, icon: "🟠" },
          { label: "SHADOW", value: split.shadow, color: visual.shadowColor, icon: "⚫" },
        ].map(lane => (
          <div key={lane.label}>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="flex items-center gap-1">
                <span>{lane.icon}</span>
                <span className="text-gray-400">{lane.label}</span>
              </span>
              <span style={{ color: lane.color }}>{(lane.value * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${lane.value * 100}%`, background: lane.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Rollback status */}
      {rollback && (
        <div className={`rounded-lg p-2 text-[10px] ${
          rollback.shouldRollback ? "bg-red-400/10 border border-red-400/30" : "bg-white/5"
        }`}>
          <div className={`font-bold mb-1 ${rollback.shouldRollback ? "text-red-400" : "text-green-400"}`}>
            {rollback.shouldRollback ? "🚨 ROLLBACK TRIGGERED" : "✅ SLO NOMINAL"}
          </div>
          <div className="text-gray-400">{rollback.reason}</div>
          {rollback.actions.slice(0, 2).map((a: string, i: number) => (
            <div key={i} className="text-gray-500 mt-0.5">› {a}</div>
          ))}
        </div>
      )}
    </div>
  )
}
