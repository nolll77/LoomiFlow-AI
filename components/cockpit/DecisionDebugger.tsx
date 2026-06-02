// components/cockpit/DecisionDebugger.tsx
// Drawer with full decision trace, WHY button, Memory Graph tabs, audio alerts
"use client"
import { useState, useEffect } from "react"
import { DecisionTrace } from "@/core/shared/types"
import { buildTraceGraph } from "@/core/mcp/traceGraph"
import { explainAgentDecision, getNodeColor } from "@/lib/memoryGraph"
import { reconstructIncidentFromTrace } from "@/lib/incidentReconstructor"
import { formatCost, formatLatency, ANOMALY_LABELS } from "@/lib/observabilityEnvelope"
import { generateCounterfactuals } from "@/lib/counterfactualEngine"
import { detectDisagreements, extractOpinionsFromTrace } from "@/lib/disagreementDetector"
import { simulateAlternatives } from "@/lib/scenarioSimulator"
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"

type Tab = "timeline" | "memory" | "agents" | "tensions" | "scenarios" | "mcp" | "graph" | "writes" | "counterfactual"

const DECISION_COLORS: Record<string, string> = {
  BLOCK: "#FF3B3B", ALLOW: "#2EE59D", HOLD: "#FF9F1C",
  STEP_UP_AUTH: "#4DA3FF", THROTTLE: "#8B5CF6",
}

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  FRAUD_SPIKE:    "🔴 Fraud Spike",
  MCP_LATENCY:    "🟡 MCP Latency",
  PAYPAL_FAILURE: "🟠 PayPal Failure",
  AGENT_CONFLICT: "🟣 Agent Conflict",
  UNKNOWN:        "⚪ Unknown",
}

export default function DecisionDebugger({ decision }: { decision: DecisionTrace | null }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("timeline")
  const [muted, setMuted] = useState(false)

  // Play audio on new decisions
  useEffect(() => {
    if (!decision || muted) return
    import("@/lib/audioEngine").then(({ playForEvent, unlockAudio }) => {
      unlockAudio().then(() => {
        const event = decision.finalDecision as any
        if (["ALLOW","BLOCK","HOLD","STEP_UP_AUTH","THROTTLE"].includes(event)) {
          playForEvent(event)
        }
      })
    }).catch(() => {})
  }, [decision?.id, muted])

  if (!decision) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agents = decision.agents as any

  const mcpCtx = decision.mcpContextSources.length > 0 ? {
    customerId: "", fetchedAt: Date.now(),
    toolsUsed: decision.mcpContextSources,
    tier: (agents?.revenue?.customerLTV ?? 0) > 1000 ? "VIP" as const : "standard" as const,
    ltv: (agents?.revenue?.customerLTV ?? 0) as number,
    churnRisk: ((agents?.cx?.churnRisk ?? "low") as "low" | "medium" | "high"),
    predictionScore: (agents?.cx?.score ?? 0) as number,
  } : null
  const graph = buildTraceGraph(mcpCtx, decision)

  const decisionColor = DECISION_COLORS[decision.finalDecision] ?? "#fff"

  // Build memory explanation
  const memExplanation = decision.memoryGraph
    ? explainAgentDecision(decision.memoryGraph, decision.finalDecision)
    : null

  // Build incident report
  const incident = reconstructIncidentFromTrace(decision)

  const tabs: { key: Tab; label: string }[] = [
    { key: "timeline",       label: "TIMELINE" },
    { key: "memory",         label: "⊕ MEMORY" },
    { key: "agents",         label: "AGENTS" },
    { key: "tensions",       label: "⚡ TENSIONS" },
    { key: "scenarios",      label: "▦ SCENARIOS" },
    { key: "counterfactual", label: "WHY NOT?" },
    { key: "mcp",            label: "MCP" },
    { key: "graph",          label: "GRAPH" },
    { key: "writes",         label: "WRITES" },
  ]

  return (
    <>
      {/* Trigger button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="flex-1 text-[10px] py-1.5 px-3 rounded border border-white/10 text-gray-400 hover:border-blue-400/40 hover:text-blue-300 transition-all text-left"
        >
          🔍 Inspect Decision — {decision.finalDecision}
        </button>
        <button
          onClick={() => setMuted(m => !m)}
          className="text-[10px] px-2 py-1.5 rounded border border-white/10 text-gray-500 hover:text-gray-300 transition-all"
          title={muted ? "Unmute alerts" : "Mute alerts"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* Drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-3xl max-h-[85vh] bg-[#0B0F1A] border border-[#1C2333] rounded-t-2xl overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1C2333] shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold" style={{ color: decisionColor }}>
                  {decision.finalDecision}
                </span>
                <span className="text-[11px] text-gray-500">
                  {(decision.confidence * 100).toFixed(0)}% confidence
                </span>
                <span className="text-[10px] text-gray-600">
                  {decision.mcpContextSources.length} MCP tools
                </span>
                {decision.observability?.anomalies.length ? (
                  <span className="text-[9px] text-yellow-400 animate-pulse font-bold">
                    ⚠ {decision.observability.anomalies.length} anomaly
                  </span>
                ) : null}
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#1C2333] px-4 shrink-0 overflow-x-auto">
              {tabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`text-[11px] px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
                    tab === t.key ? "border-blue-400 text-blue-300" : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 text-[11px]">

              {/* ─── TIMELINE ─── */}
              {tab === "timeline" && (
                <div className="space-y-3">
                  {/* Incident report banner */}
                  {incident && (
                    <div className="border border-yellow-400/20 rounded-lg p-3 bg-yellow-400/5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-yellow-400">{INCIDENT_TYPE_LABELS[incident.type]}</span>
                        <span className="text-[10px] text-gray-500">Severity: {incident.severity}/100</span>
                      </div>
                      <p className="text-gray-300 text-[10px] leading-relaxed">{incident.narrative}</p>
                      {incident.rootCause && (
                        <div className="text-[10px] text-gray-500 font-mono">
                          Root span: <span className="text-yellow-400">{incident.rootCause.name}</span> in {incident.rootCause.service} ({incident.rootCause.latencyMs}ms)
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-[10px] text-gray-500">
                    Total pipeline: {decision.timeline.reduce((a,e)=>a+(e.durationMs??0),0)}ms · {decision.timeline.length} spans
                  </div>
                  {decision.timeline.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-gray-600 w-16 shrink-0">{entry.time}</span>
                      <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                        entry.type === "event" ? "bg-blue-400" :
                        entry.type === "mcp" ? "bg-purple-400" :
                        entry.type === "agent" ? "bg-yellow-400" :
                        entry.type === "consensus" ? "bg-green-400" :
                        entry.type === "write" ? "bg-cyan-400" : "bg-white"
                      }`} />
                      <div>
                        <span className="text-gray-200">{entry.label}</span>
                        {entry.durationMs && (
                          <span className="ml-2 text-gray-500">{entry.durationMs}ms</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ─── MEMORY GRAPH ─── */}
              {tab === "memory" && (
                <div className="space-y-3">
                  <div className="text-gray-500">AI memory graph — influence weights per signal</div>

                  {/* Top drivers */}
                  {memExplanation && (
                    <div className="border border-blue-400/20 rounded-lg p-3 bg-blue-400/5 space-y-2">
                      <div className="text-blue-400 font-bold text-[11px]">Top Decision Drivers</div>
                      {memExplanation.topDrivers.map((d, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-gray-400 text-[10px] flex-1 truncate">{d.node}</span>
                          {d.isMCP && (
                            <span className="text-[9px] text-purple-400 bg-purple-400/10 rounded px-1">MCP</span>
                          )}
                          <div className="w-24 bg-white/5 rounded-full h-1.5 shrink-0">
                            <div
                              className="h-full rounded-full bg-blue-400 transition-all"
                              style={{ width: `${Math.min(100, parseFloat(d.influence) * 100).toFixed(0)}%` }}
                            />
                          </div>
                          <span className="text-gray-400 font-mono text-[10px] w-8 text-right">{d.influence}</span>
                        </div>
                      ))}
                      <div className="text-[10px] text-gray-500 pt-1">{memExplanation.confidenceSummary}</div>
                    </div>
                  )}

                  {/* All nodes */}
                  {decision.memoryGraph && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">All Memory Nodes</div>
                      {decision.memoryGraph.nodes.map(n => (
                        <div key={n.id} className="flex items-center gap-3 p-2 rounded border border-white/5">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: getNodeColor(n.type) }} />
                          <span className="text-[10px] text-gray-500 w-20 shrink-0">{n.type}</span>
                          <span className="text-gray-200 flex-1 truncate">{n.label}</span>
                          {n.value != null && (
                            <span className="text-gray-500 text-[10px] font-mono">{typeof n.value === "number" ? n.value.toFixed(2) : n.value}</span>
                          )}
                          {n.metadata?.latencyMs && (
                            <span className="text-gray-600 text-[9px]">{n.metadata.latencyMs}ms</span>
                          )}
                        </div>
                      ))}
                      <div className="mt-2 text-gray-600 text-[10px]">
                        {decision.memoryGraph.edges.length} influence edges
                      </div>
                    </div>
                  )}

                  {!decision.memoryGraph && (
                    <div className="text-gray-500">No memory graph available for this decision.</div>
                  )}
                </div>
              )}

              {/* ─── AGENTS ─── */}
              {tab === "agents" && (
                <div className="space-y-4">
                  {[agents?.fraud, agents?.revenue, agents?.cx].filter(Boolean).map((a: any) => (
                    <div key={a.agentName} className="border border-white/10 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-200 uppercase">{a.agentName} Agent</span>
                        <span className="px-2 py-0.5 rounded text-[10px]" style={{
                          background: DECISION_COLORS[a.recommendation] + "22",
                          color: DECISION_COLORS[a.recommendation],
                        }}>{a.recommendation}</span>
                      </div>
                      <div className="text-gray-500 mb-2">
                        Score: {(a.score * 100).toFixed(0)}% · Confidence: {(a.confidence * 100).toFixed(0)}% · {a.latencyMs}ms
                      </div>
                      <div className="space-y-1">
                        {(a.reasons ?? []).map((r: string, i: number) => (
                          <div key={i} className="text-gray-400 flex gap-1">
                            <span className="text-gray-600">›</span>{r}
                          </div>
                        ))}
                      </div>
                      {a.mcpSourcesUsed.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(a.mcpSourcesUsed ?? []).map((t: string) => (
                            <span key={t} className="text-[9px] text-purple-400/80 bg-purple-400/10 rounded px-1.5 py-0.5">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* WHY button */}
                  <div className="border border-blue-400/20 rounded-lg p-3 bg-blue-400/5">
                    <div className="text-blue-400 font-bold mb-2">WHY {decision.finalDecision}?</div>
                    {decision.reasoning.map((r, i) => (
                      <div key={i} className="text-gray-300 flex gap-2 mb-1">
                        <span className="text-blue-400">{i + 1}.</span>{r}
                      </div>
                    ))}
                    {decision.orchestrator.tradeoffResolved && (
                      <div className="mt-2 text-[10px] text-gray-500">
                        Tradeoff resolved: {decision.orchestrator.tradeoffResolved}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── TENSIONS ─── */}
              {tab === "tensions" && (() => {
                const councils = (decision as any).councils as Record<string, { memberOpinions: any[] }> | undefined
                const market   = (decision as any).marketDecision as { utilityScores?: Record<string, number> } | undefined
                const revenueAtRisk = (agents?.revenue as any)?.revenueAtRisk ?? 0
                const customerLtv   = (agents?.revenue as any)?.customerLTV ?? 0

                const opinions = extractOpinionsFromTrace({ councils })
                const disagreements = detectDisagreements(opinions, revenueAtRisk, customerLtv)

                const SEVERITY_STYLE: Record<string, { border: string; bg: string; badge: string; icon: string }> = {
                  CRITICAL: { border: "border-red-500/40",    bg: "bg-red-500/8",    badge: "bg-red-500/20 text-red-400",    icon: "🚨" },
                  HIGH:     { border: "border-orange-500/40", bg: "bg-orange-500/8", badge: "bg-orange-500/20 text-orange-400", icon: "⚡" },
                  MEDIUM:   { border: "border-yellow-500/40", bg: "bg-yellow-500/8", badge: "bg-yellow-500/20 text-yellow-400", icon: "⚠" },
                  LOW:      { border: "border-slate-500/30",  bg: "bg-slate-800/40", badge: "bg-slate-700 text-slate-400",     icon: "·" },
                }

                return (
                  <div className="space-y-3">
                    <div className="text-gray-500 text-[10px] mb-2">
                      {disagreements.length === 0
                        ? "No significant tensions detected — agents are in consensus."
                        : `${disagreements.length} tension${disagreements.length > 1 ? "s" : ""} detected across ${opinions.length} active agents.`}
                    </div>

                    {/* Utility scores bar (Opinion Market output) */}
                    {market?.utilityScores && (
                      <div className="border border-white/5 rounded-lg p-3 space-y-1.5">
                        <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Opinion Market — Utility Scores</div>
                        {Object.entries(market.utilityScores).map(([council, score]) => (
                          <div key={council} className="flex items-center gap-2">
                            <span className="text-[10px] font-mono w-16 text-gray-500">{council}</span>
                            <div className="flex-1 bg-white/5 rounded-full h-1.5">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${(score * 100).toFixed(0)}%`,
                                  background: council === "risk" ? "#ef4444" : council === "revenue" ? "#10b981" : "#3b82f6",
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-gray-400 w-10 text-right">{(score * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {disagreements.map((d, i) => {
                      const style = SEVERITY_STYLE[d.severity]
                      return (
                        <div key={i} className={`border rounded-lg p-3 space-y-2 ${style.border} ${style.bg}`}>
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${style.badge}`}>
                              {style.icon} {d.severity} TENSION
                            </span>
                            <span className="text-[10px] font-mono text-gray-500">
                              tension score: {(d.tensionScore * 100).toFixed(0)}%
                            </span>
                          </div>

                          {/* Agent pair */}
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-gray-200">{d.agents[0]}</span>
                            <span className="text-gray-500">
                              ({(d.confidences[0] * 100).toFixed(0)}%)
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px]"
                              style={{
                                background: (DECISION_COLORS[d.recommendations[0]] ?? "#888") + "33",
                                color: DECISION_COLORS[d.recommendations[0]] ?? "#aaa",
                              }}
                            >
                              {d.recommendations[0]}
                            </span>

                            <span className="text-gray-600 text-xs">←→</span>

                            <span className="text-gray-200">{d.agents[1]}</span>
                            <span className="text-gray-500">
                              ({(d.confidences[1] * 100).toFixed(0)}%)
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px]"
                              style={{
                                background: (DECISION_COLORS[d.recommendations[1]] ?? "#888") + "33",
                                color: DECISION_COLORS[d.recommendations[1]] ?? "#aaa",
                              }}
                            >
                              {d.recommendations[1]}
                            </span>
                          </div>

                          {/* Tension bar */}
                          <div>
                            <div className="flex justify-between text-[9px] text-gray-600 mb-0.5">
                              <span>{d.recommendations[0]}</span>
                              <span>{d.recommendations[1]}</span>
                            </div>
                            <div className="relative h-1.5 rounded-full overflow-hidden bg-white/5">
                              <div
                                className="absolute left-0 h-full rounded-l-full"
                                style={{
                                  width: `${(d.confidences[0] / (d.confidences[0] + d.confidences[1])) * 100}%`,
                                  background: DECISION_COLORS[d.recommendations[0]] ?? "#888",
                                  opacity: 0.7,
                                }}
                              />
                              <div
                                className="absolute right-0 h-full rounded-r-full"
                                style={{
                                  width: `${(d.confidences[1] / (d.confidences[0] + d.confidences[1])) * 100}%`,
                                  background: DECISION_COLORS[d.recommendations[1]] ?? "#888",
                                  opacity: 0.7,
                                }}
                              />
                            </div>
                          </div>

                          {/* Stake + narrative */}
                          <div className="text-[10px] text-gray-500">
                            <span className="text-yellow-400 font-mono">€{d.businessStake.toFixed(0)} at stake</span>
                          </div>
                          <p className="text-[10px] text-gray-300 leading-relaxed italic">
                            &ldquo;{d.narrativeConflict}&rdquo;
                          </p>
                        </div>
                      )
                    })}

                    {disagreements.length === 0 && opinions.length > 0 && (
                      <div className="border border-emerald-500/20 rounded-lg p-3 bg-emerald-500/5">
                        <div className="text-emerald-400 font-mono text-[11px] font-bold mb-1">✓ Consensus reached</div>
                        <div className="text-gray-500 text-[10px]">
                          All {opinions.length} agents aligned on {decision.finalDecision}.
                          No significant opposing signals detected.
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* ─── SCENARIOS ─── */}
              {tab === "scenarios" && (() => {
                const state = (decision as any).commerceState as CommerceKnowledgeState | undefined
                if (!state) {
                  return (
                    <div className="text-gray-500 text-[11px]">
                      Scenario data not available — trigger a new event to populate.
                    </div>
                  )
                }

                const scenarios = simulateAlternatives(decision.finalDecision, state)

                const VERDICT_STYLE: Record<string, { color: string; bg: string }> = {
                  OPTIMAL:      { color: "text-emerald-400", bg: "bg-emerald-500/15" },
                  RISKY:        { color: "text-red-400",     bg: "bg-red-500/15" },
                  CONSERVATIVE: { color: "text-blue-400",    bg: "bg-blue-500/15" },
                  SUBOPTIMAL:   { color: "text-yellow-400",  bg: "bg-yellow-500/15" },
                }

                const METRIC_LABELS = [
                  { key: "probability",      label: "Best choice",   fmt: (v: number) => `${(v*100).toFixed(0)}%`,   color: "#a78bfa" },
                  { key: "expectedRevenue",  label: "Exp. Revenue",  fmt: (v: number) => `€${v.toFixed(0)}`,         color: "#10b981" },
                  { key: "fraudRisk",        label: "Fraud Risk",    fmt: (v: number) => `${(v*100).toFixed(0)}%`,   color: "#ef4444" },
                  { key: "churnRisk",        label: "Churn Risk",    fmt: (v: number) => `${(v*100).toFixed(0)}%`,   color: "#f97316" },
                  { key: "customerFriction", label: "Friction",      fmt: (v: number) => `${(v*100).toFixed(0)}%`,   color: "#60a5fa" },
                ] as const

                return (
                  <div className="space-y-4">
                    <div className="text-gray-500 text-[10px]">
                      Predictive simulation — what would have happened with each alternative decision.
                    </div>

                    {/* Comparative cards */}
                    <div className="space-y-2">
                      {scenarios.map((s, i) => {
                        const vs = VERDICT_STYLE[s.verdict]
                        return (
                          <div
                            key={i}
                            className={`rounded-lg border p-3 space-y-2 ${
                              s.isActual
                                ? "border-blue-400/50 bg-blue-400/8 ring-1 ring-blue-400/30"
                                : "border-white/8 bg-white/3"
                            }`}
                          >
                            {/* Decision header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span
                                  className="font-mono font-bold text-[11px] px-2 py-0.5 rounded"
                                  style={{
                                    background: (DECISION_COLORS[s.decision] ?? "#888") + "25",
                                    color: DECISION_COLORS[s.decision] ?? "#ccc",
                                  }}
                                >
                                  {s.decision}
                                </span>
                                {s.isActual && (
                                  <span className="text-[9px] font-mono text-blue-400 bg-blue-400/15 px-1.5 py-0.5 rounded">
                                    CHOSEN
                                  </span>
                                )}
                              </div>
                              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${vs.bg} ${vs.color}`}>
                                {s.verdict}
                              </span>
                            </div>

                            {/* Probability bar */}
                            <div>
                              <div className="flex justify-between text-[9px] text-gray-600 mb-0.5">
                                <span>Best choice probability</span>
                                <span className="text-gray-400 font-mono">{(s.probability * 100).toFixed(0)}%</span>
                              </div>
                              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${s.probability * 100}%`,
                                    background: s.isActual ? "#60a5fa" : "#6366f1",
                                    opacity: s.isActual ? 1 : 0.5,
                                  }}
                                />
                              </div>
                            </div>

                            {/* 5-metric mini-grid */}
                            <div className="grid grid-cols-5 gap-1 pt-1">
                              {METRIC_LABELS.map(m => {
                                const raw = s[m.key] as number
                                return (
                                  <div key={m.key} className="flex flex-col items-center gap-0.5">
                                    <span className="text-[8px] text-gray-600 text-center leading-tight">{m.label}</span>
                                    <span
                                      className="text-[10px] font-mono font-bold"
                                      style={{ color: m.color }}
                                    >
                                      {m.fmt(raw)}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>

                            {/* CI band (only for revenue > 0) */}
                            {s.expectedRevenue > 0 && (
                              <div className="text-[9px] text-gray-600 font-mono">
                                90% CI: [€{s.confidenceInterval[0].toFixed(0)} — €{s.confidenceInterval[1].toFixed(0)}]
                              </div>
                            )}

                            {/* Reasoning */}
                            <p className="text-[10px] text-gray-400 italic leading-relaxed">
                              {s.reasoning}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* ─── COUNTERFACTUALS ─── */}
              {tab === "counterfactual" && (
                <div className="space-y-4">
                  <div className="text-gray-500 mb-2">Counterfactual Engine — What would have changed the decision?</div>
                  {(() => {
                    const cfs = generateCounterfactuals(decision)
                    if (cfs.length === 0) {
                      return <div className="text-gray-600">No available counterfactuals for this decision.</div>
                    }
                    return cfs.map((cf, i) => (
                      <div key={i} className="border border-white/10 rounded-lg p-4 bg-[#111622] space-y-3 relative overflow-hidden">
                        {/* Background subtle glow based on new decision */}
                        <div className="absolute top-0 right-0 w-32 h-32 blur-3xl opacity-10 rounded-full" style={{ background: DECISION_COLORS[cf.newDecision] || "#ffffff" }} />
                        
                        <div className="flex items-center justify-between relative z-10">
                          <span className="font-mono text-gray-400 text-[10px]">CF{i+1}</span>
                          <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded" style={{
                            background: (DECISION_COLORS[cf.newDecision] || "#fff") + "22",
                            color: DECISION_COLORS[cf.newDecision] || "#fff"
                          }}>→ {cf.newDecision}</span>
                        </div>
                        
                        <div className="relative z-10 space-y-1">
                          <div className="text-gray-300">
                            If <span className="font-mono text-blue-400">{cf.variable}</span> changed from
                          </div>
                          <div className="flex items-center gap-2 text-sm font-mono text-gray-200 bg-black/40 rounded px-3 py-2 w-fit">
                            <span>{cf.currentValue.toFixed(2)}</span>
                            <span className="text-gray-600">→</span>
                            <span className={cf.deltaRequired > 0 ? "text-green-400" : "text-red-400"}>
                              {cf.thresholdValue.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-gray-500 ml-2">
                              ({cf.deltaRequired > 0 ? "+" : ""}{cf.deltaRequired.toFixed(2)})
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/5 relative z-10">
                          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                            <span>Probability of occurrence</span>
                            <span>{(cf.probability * 100).toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1">
                            <div 
                              className="h-full rounded-full transition-all bg-gradient-to-r from-blue-500 to-indigo-400"
                              style={{ width: `${Math.min(100, cf.probability * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              )}

              {/* ─── MCP CONTEXT ─── */}
              {tab === "mcp" && (
                <div className="space-y-3">
                  <div className="text-gray-500 mb-2">
                    {decision.mcpContextSources.length} MCP tools used to enrich this decision
                  </div>

                  {/* Observability cost row */}
                  {decision.observability && (
                    <div className="flex gap-3 text-[10px] border border-white/5 rounded-lg p-2">
                      <div>
                        <span className="text-gray-500">Avg MCP latency: </span>
                        <span className="text-purple-400 font-mono">{formatLatency(decision.observability.mcp.avgLatencyMs)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Success: </span>
                        <span className="text-green-400 font-mono">{(decision.observability.mcp.successRate * 100).toFixed(0)}%</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Cache hits: </span>
                        <span className="text-cyan-400 font-mono">{decision.observability.mcp.cacheHits}</span>
                      </div>
                    </div>
                  )}

                  {decision.mcpContextSources.map((tool, i) => (
                    <div key={i} className="border border-purple-400/20 rounded-lg p-3 bg-purple-400/5">
                      <div className="text-purple-400 font-mono text-[11px]">{tool}</div>
                      <div className="text-gray-500 mt-1 text-[10px]">
                        {tool === "get_customer_properties" && "→ customer tier, LTV, order history, preferences"}
                        {tool === "get_customer_prediction_score" && "→ churn probability, engagement score"}
                        {tool === "list_customer_events" && "→ recent behavior, purchase patterns"}
                        {tool === "get_scenario" && "→ active journey state in Bloomreach"}
                        {tool === "get_api_trigger" && "→ trigger URL for write-back operation"}
                        {tool === "execute_analytics" && "→ real-time funnel metrics and anomalies"}
                      </div>
                    </div>
                  ))}
                  {decision.mcpContextSources.length === 0 && (
                    <div className="text-gray-500">No MCP context — decision made with event data only</div>
                  )}
                </div>
              )}

              {/* ─── CAUSAL GRAPH ─── */}
              {tab === "graph" && (
                <div className="space-y-2">
                  <div className="text-gray-500 mb-3">Causal influence graph — what drove the decision</div>
                  <div className="space-y-1">
                    {graph.nodes.map(n => (
                      <div key={n.id} className="flex items-center gap-3 p-2 rounded border border-white/5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: n.color ?? "#fff" }} />
                        <span className="text-[10px] text-gray-500 w-16 shrink-0">{n.type}</span>
                        <span className="text-gray-200">{n.label}</span>
                        {n.value && <span className="text-gray-500 ml-auto text-[10px]">{String(n.value)}</span>}
                        {n.latencyMs && <span className="text-gray-600 text-[9px]">{n.latencyMs}ms</span>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-gray-600 text-[10px]">
                    {graph.edges.length} causal edges · Total latency: {graph.totalLatencyMs}ms
                  </div>
                </div>
              )}

              {/* ─── WRITE ACTIONS ─── */}
              {tab === "writes" && (
                <div className="space-y-3">
                  <div className="text-gray-500 mb-2">Bloomreach write operations executed post-decision</div>
                  {(!decision.writeActions || decision.writeActions.length === 0) ? (
                    <div className="text-gray-600">
                      No writes executed.
                      {!process.env.NEXT_PUBLIC_APP_URL?.includes("localhost") ? "" : " BLOOMREACH_API_TOKEN may not be set."}
                    </div>
                  ) : (
                    decision.writeActions.map((w, i) => (
                      <div key={i} className={`border rounded-lg p-3 ${
                        w.status === "success" ? "border-green-400/20 bg-green-400/5" : "border-red-400/20 bg-red-400/5"
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={w.status === "success" ? "text-green-400" : "text-red-400"}>
                            {w.status === "success" ? "✓" : "✗"}
                          </span>
                          <span className="text-gray-200 font-mono">{w.type.replace(/_/g, " ")}</span>
                          <span className="text-gray-500 ml-auto text-[10px]">
                            {new Date(w.timestamp).toISOString().split("T")[1].replace("Z", "")}
                          </span>
                        </div>
                        {w.details && (
                          <div className="text-gray-500 text-[10px] font-mono">
                            {JSON.stringify(w.details).slice(0, 100)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div className="mt-3 border border-white/5 rounded-lg p-3 text-[10px] text-gray-500">
                    <div className="text-gray-400 mb-1">Paul Edwards (Bloomreach) confirmed write pattern:</div>
                    <div>1. updateCustomerProperty → marks recovery_initiated</div>
                    <div>2. trackCustomerEvent → fires Bloomreach scenario</div>
                    <div>3. Scenario → Mailgun sends recovery email</div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  )
}
