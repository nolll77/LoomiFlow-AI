// components/cockpit/ObservabilityMiniPanel.tsx
// SRE observability panel — tokens, cost, latency breakdown, anomaly flags
"use client"
import { DecisionTrace } from "@/core/shared/types"
import { formatCost, formatLatency, ANOMALY_LABELS } from "@/lib/observabilityEnvelope"
import type { ContextQualityReport } from "@/lib/contextQualityScorer"
import { gradeColor, impactLabel } from "@/lib/contextQualityScorer"

const ANOMALY_COLORS: Record<string, string> = {
  HIGH_LATENCY:   "#F59E0B",
  HIGH_COST:      "#EF4444",
  MCP_FAILURES:   "#A78BFA",
  LOW_CONFIDENCE: "#6B7280",
}

export default function ObservabilityMiniPanel({ decision }: { decision: DecisionTrace | null }) {
  if (!decision) return null

  const obs = decision.observability
  const totalMs = decision.timeline.reduce((a, e) => a + (e.durationMs ?? 0), 0)
  const mcpCount = decision.mcpContextSources.length
  const writeCount = decision.writeActions?.length ?? 0
  const writeOk = decision.writeActions?.filter(a => a.status === "success").length ?? 0
  const cq = decision.contextQuality as ContextQualityReport | undefined

  return (
    <div className="panel-glass rounded-2xl p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-300">OBSERVABILITY</span>
        {obs && obs.anomalies.length > 0 && (
          <span className="text-[9px] font-bold text-yellow-400 animate-pulse">
            ⚠ {obs.anomalies.length} ANOMAL{obs.anomalies.length > 1 ? "IES" : "Y"}
          </span>
        )}
      </div>

      {/* MCP Context Quality Badge */}
      {cq && (
        <div
          className="flex items-center justify-between rounded-lg px-2.5 py-2 border"
          style={{
            borderColor: gradeColor(cq.grade) + "40",
            background:  gradeColor(cq.grade) + "0f",
          }}
        >
          <div className="flex items-center gap-2">
            {/* Grade ring */}
            <span
              className="text-[13px] font-black font-mono w-6 text-center"
              style={{ color: gradeColor(cq.grade) }}
            >
              {cq.grade}
            </span>
            <div className="flex flex-col leading-none">
              <span className="text-[9px] text-gray-500 uppercase tracking-widest">MCP Context</span>
              <span
                className="text-[10px] font-mono font-bold"
                style={{ color: gradeColor(cq.grade) }}
              >
                {cq.overallScore}/100
                {cq.missingFields.length > 0 && (
                  <span className="text-gray-500 font-normal">
                    {" — "}{cq.missingFields.length} field{cq.missingFields.length > 1 ? "s" : ""} missing
                  </span>
                )}
              </span>
            </div>
          </div>
          {cq.impactOnDecision !== "NONE" && (
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{
                color:      gradeColor(cq.grade),
                background: gradeColor(cq.grade) + "20",
              }}
            >
              {impactLabel(cq.impactOnDecision)}
            </span>
          )}
        </div>
      )}

      {/* Grid: core metrics */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="space-y-0.5">
          <div className="text-gray-500">Pipeline</div>
          <div className="text-white font-mono">{obs ? formatLatency(obs.latency.totalMs) : `${totalMs}ms`}</div>
          <div className="text-gray-500">{decision.timeline.length} spans</div>
        </div>
        <div className="space-y-0.5">
          <div className="text-gray-500">MCP Tools</div>
          <div className="text-purple-400 font-mono">{mcpCount}/5 calls</div>
          {decision.mcpSavedMs ? (
            <div className="text-green-400 font-mono text-[9px]">
              saved ~{decision.mcpSavedMs}ms
            </div>
          ) : obs ? (
            <div className="text-gray-500">
              {(obs.mcp.successRate * 100).toFixed(0)}% success
            </div>
          ) : null}
        </div>
        <div className="space-y-0.5">
          <div className="text-gray-500">Writes</div>
          <div className={`font-mono ${writeOk === writeCount && writeCount > 0 ? "text-green-400" : "text-gray-400"}`}>
            {writeOk}/{writeCount} ok
          </div>
        </div>
        <div className="space-y-0.5">
          <div className="text-gray-500">Confidence</div>
          <div className="text-white font-mono">{(decision.confidence * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* Token cost (only when obs available) */}
      {obs && (
        <div className="border border-white/5 rounded-lg p-2 space-y-1.5 text-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">LLM Tokens</span>
            <span className="text-cyan-400 font-mono">{obs.tokens.total.toLocaleString()} tok</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Cost/call</span>
            <span className="text-green-400 font-mono">{formatCost(obs.tokens.costUsd)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">in / out</span>
            <span className="text-gray-400 font-mono">{obs.tokens.input} / {obs.tokens.output}</span>
          </div>
        </div>
      )}

      {/* Latency breakdown bars */}
      {obs && (
        <div className="space-y-1 text-[9px]">
          <div className="text-gray-600 uppercase tracking-widest">Latency Breakdown</div>
          {(Object.entries(obs.latency.breakdown) as [string, number][]).map(([key, ms]) => {
            const pct = obs.latency.totalMs > 0 ? (ms / obs.latency.totalMs) * 100 : 0
            const isBottleneck = obs.latency.bottleneck === key
            return (
              <div key={key} className="flex items-center gap-2">
                <span className={`w-14 shrink-0 ${isBottleneck ? "text-yellow-400 font-bold" : "text-gray-500"}`}>
                  {key.toUpperCase()}
                </span>
                <div className="flex-1 bg-white/5 rounded-full h-1">
                  <div
                    className={`h-full rounded-full transition-all ${isBottleneck ? "bg-yellow-400" : "bg-blue-500"}`}
                    style={{ width: `${pct.toFixed(0)}%` }}
                  />
                </div>
                <span className="text-gray-500 w-10 text-right font-mono">{formatLatency(ms)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Anomaly flags */}
      {obs && obs.anomalies.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {obs.anomalies.map(a => (
            <span
              key={a}
              className="text-[9px] px-1.5 py-0.5 rounded font-mono"
              style={{
                color: ANOMALY_COLORS[a] ?? "#9CA3AF",
                background: (ANOMALY_COLORS[a] ?? "#9CA3AF") + "22",
              }}
            >
              {ANOMALY_LABELS[a] ?? a}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
