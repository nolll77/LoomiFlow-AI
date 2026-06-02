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
    <div className="panel-glass rounded-2xl p-4 opacity-40 min-h-[160px] flex items-center justify-center">
      <span className="text-xs text-gray-500">Waiting for event...</span>
    </div>
  )

  return (
    <div className={`panel-glass rounded-[28px] p-5 transition-all duration-300 ${active ? "ring-1 ring-slate-200" : ""}`} style={{ borderColor: `${meta.color}22` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">{meta.icon}</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500" style={{ color: meta.color }}>{meta.label} Agent</span>
        </div>
        <span className={`text-[11px] px-2.5 py-1 rounded-full font-mono ${DECISION_BADGE[agent.recommendation] ?? "badge-hold"}`}>
          {agent.recommendation}
        </span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-slate-500 mb-2">
          <span>Risk score</span>
          <span style={{ color: meta.color }}>{(agent.score * 100).toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${agent.score * 100}%`, background: meta.color }} />
        </div>
      </div>

      <div className="text-sm text-slate-600 mb-4">
        Confidence: <span className="font-semibold text-slate-900">{(agent.confidence * 100).toFixed(0)}%</span>
        {agent.latencyMs && <span className="ml-2 text-slate-500">{agent.latencyMs}ms</span>}
      </div>

      <div className="space-y-3">
        {agent.reasons.slice(0, 2).map((r, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
            <span className="text-slate-400 mt-0.5">›</span>
            <span>{r}</span>
          </div>
        ))}
      </div>

      {agent.mcpSourcesUsed.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {agent.mcpSourcesUsed.slice(0, 2).map(t => (
            <span key={t} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700">{t.replace("get_", "")}</span>
          ))}
        </div>
      )}
    </div>
  )
}
