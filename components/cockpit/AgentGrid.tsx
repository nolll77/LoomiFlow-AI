"use client"
import { DecisionTrace, SystemMode } from "@/core/shared/types"
import AgentCard from "./AgentCard"

const DECISION_COLORS: Record<string, string> = {
  BLOCK: "#FF3B3B", ALLOW: "#2EE59D", HOLD: "#FF9F1C", STEP_UP_AUTH: "#4DA3FF", THROTTLE: "#8B5CF6"
}

export default function AgentGrid({ decision, systemMode }: { decision: DecisionTrace | null; systemMode: SystemMode }) {
  const o = decision?.orchestrator
  return (
    <div className="space-y-2">
      {/* 3 agent cards */}
      <div className="grid grid-cols-3 gap-2">
        <AgentCard agent={decision?.agents.fraud ?? null} active={systemMode !== "normal"} />
        <AgentCard agent={decision?.agents.revenue ?? null} active={systemMode !== "normal"} />
        <AgentCard agent={decision?.agents.cx ?? null} active={systemMode !== "normal"} />
      </div>

      {/* Orchestrator */}
      {o && (
        <div className="panel-glass rounded-xl p-4" style={{ borderColor: `${DECISION_COLORS[o.finalDecision] ?? "#fff"}22` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-300">⚡ ORCHESTRATOR</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">confidence</span>
              <span className="text-white font-bold">{(o.confidence * 100).toFixed(0)}%</span>
              <span className={`text-xs px-2 py-0.5 rounded font-bold`} style={{ background: `${DECISION_COLORS[o.finalDecision]}22`, color: DECISION_COLORS[o.finalDecision] }}>
                {o.finalDecision}
              </span>
            </div>
          </div>

          {/* Consensus weights bar */}
          <div className="flex h-2 rounded-full overflow-hidden gap-px mb-2">
            <div className="bg-[#FF3B3B] transition-all" style={{ width: `${o.consensusWeights.fraud * 100}%` }} title={`Fraud ${(o.consensusWeights.fraud*100).toFixed(0)}%`} />
            <div className="bg-[#FF9F1C] transition-all" style={{ width: `${o.consensusWeights.revenue * 100}%` }} title={`Revenue ${(o.consensusWeights.revenue*100).toFixed(0)}%`} />
            <div className="bg-[#2EE59D] transition-all" style={{ width: `${o.consensusWeights.cx * 100}%` }} title={`CX ${(o.consensusWeights.cx*100).toFixed(0)}%`} />
          </div>

          {/* Reasoning */}
          <div className="space-y-1">
            {o.reasoning.slice(0, 3).map((r, i) => (
              <div key={i} className="text-[10px] text-gray-400 flex gap-1">
                <span className="text-gray-600">›</span>{r}
              </div>
            ))}
          </div>

          {/* Actions */}
          {o.actions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5">
              {o.actions.slice(0, 2).map((a, i) => (
                <div key={i} className="text-[10px] text-green-400/80 flex gap-1">
                  <span>✓</span>{a}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
