"use client"
import { AgentOutput } from "@/core/shared/types"

const AGENT_META = {
  fraud:   { label: "FRAUD", color: "#FF3B3B", icon: "🛡" },
  revenue: { label: "REVENUE", color: "#FF9F1C", icon: "💰" },
  cx:      { label: "CX", color: "#2EE59D", icon: "👤" },
}

const DECISION_BADGE: Record<string, string> = {
  BLOCK: "badge-block", ALLOW: "badge-allow", HOLD: "badge-hold", STEP_UP_AUTH: "badge-step", THROTTLE: "badge-hold"
}

export default function AgentCard({ agent, active }: { agent: AgentOutput | null; active: boolean }) {
  const meta = AGENT_META[agent?.agentName ?? "fraud"]
  if (!agent) return (
    <div className="panel-glass rounded-xl p-4 opacity-40 min-h-[160px] flex items-center justify-center">
      <span className="text-xs text-gray-500">Waiting for event...</span>
    </div>
  )

  return (
    <div className={`panel-glass rounded-xl p-4 transition-all duration-300 ${active ? "ring-1 ring-white/20" : ""}`} style={{ borderColor: `${meta.color}22` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>{meta.icon}</span>
          <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label} AGENT</span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${DECISION_BADGE[agent.recommendation] ?? "badge-hold"}`}>
          {agent.recommendation}
        </span>
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>Risk Score</span>
          <span style={{ color: meta.color }}>{(agent.score * 100).toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${agent.score * 100}%`, background: meta.color }} />
        </div>
      </div>

      {/* Confidence */}
      <div className="text-[10px] text-gray-500 mb-2">
        Confidence: <span className="text-white">{(agent.confidence * 100).toFixed(0)}%</span>
        {agent.latencyMs && <span className="ml-2 text-gray-600">{agent.latencyMs}ms</span>}
      </div>

      {/* Reasons */}
      <div className="space-y-1">
        {agent.reasons.slice(0, 2).map((r, i) => (
          <div key={i} className="text-[10px] text-gray-400 flex items-start gap-1">
            <span className="text-gray-600 mt-0.5">›</span>
            <span>{r}</span>
          </div>
        ))}
      </div>

      {/* MCP sources */}
      {agent.mcpSourcesUsed.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.mcpSourcesUsed.slice(0, 2).map(t => (
            <span key={t} className="text-[9px] text-purple-400/70 bg-purple-400/10 rounded px-1 py-0.5">{t.replace("get_", "")}</span>
          ))}
        </div>
      )}
    </div>
  )
}
