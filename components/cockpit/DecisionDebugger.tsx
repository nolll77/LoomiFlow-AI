// components/cockpit/DecisionDebugger.tsx
// Drawer with full decision trace, WHY button, Memory Graph tabs, audio alerts
"use client"
import { useState, useEffect } from "react"
import { DecisionTrace } from "@/core/shared/types"
import { buildTraceGraph } from "@/core/mcp/traceGraph"
import { explainAgentDecision, getNodeColor } from "@/lib/memoryGraph"
import { reconstructIncidentFromTrace } from "@/lib/incidentReconstructor"
import { formatCost, formatLatency, ANOMALY_LABELS } from "@/lib/observabilityEnvelope"

type Tab = "timeline" | "memory" | "agents" | "mcp" | "graph" | "writes"

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

  const graph = buildTraceGraph(decision.mcpContextSources.length > 0 ? {
    customerId: "", fetchedAt: Date.now(),
    toolsUsed: decision.mcpContextSources,
    tier: decision.agents.revenue.customerLTV > 1000 ? "VIP" : "standard",
    ltv: decision.agents.revenue.customerLTV,
    churnRisk: decision.agents.cx.churnRisk,
    predictionScore: decision.agents.cx.score,
  } : null, decision)

  const decisionColor = DECISION_COLORS[decision.finalDecision] ?? "#fff"

  // Build memory explanation
  const memExplanation = decision.memoryGraph
    ? explainAgentDecision(decision.memoryGraph, decision.finalDecision)
    : null

  // Build incident report
  const incident = reconstructIncidentFromTrace(decision)

  const tabs: { key: Tab; label: string }[] = [
    { key: "timeline", label: "TIMELINE" },
    { key: "memory",   label: "⊕ MEMORY" },
    { key: "agents",   label: "AGENTS" },
    { key: "mcp",      label: "MCP" },
    { key: "graph",    label: "GRAPH" },
    { key: "writes",   label: "WRITES" },
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
                  {[decision.agents.fraud, decision.agents.revenue, decision.agents.cx].map(a => (
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
                        {a.reasons.map((r, i) => (
                          <div key={i} className="text-gray-400 flex gap-1">
                            <span className="text-gray-600">›</span>{r}
                          </div>
                        ))}
                      </div>
                      {a.mcpSourcesUsed.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {a.mcpSourcesUsed.map(t => (
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
