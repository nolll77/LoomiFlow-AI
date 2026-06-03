// app/cockpit/page.tsx — FINAL with visualization layer
"use client"
import { useCockpit } from "@/hooks/useCockpit"
import { useState } from "react"
import StatusBar from "@/components/cockpit/StatusBar"
import EventStream from "@/components/cockpit/EventStream"
import AgentGrid from "@/components/cockpit/AgentGrid"
import ActionPanel from "@/components/cockpit/ActionPanel"
import TimeHeatmap from "@/components/cockpit/TimeHeatmap"
import LoadTestPanel from "@/components/cockpit/LoadTestPanel"
import ObservabilityMiniPanel from "@/components/cockpit/ObservabilityMiniPanel"
import DecisionDebugger from "@/components/cockpit/DecisionDebugger"
import DecisionOrderBook from "@/components/cockpit/DecisionOrderBook"
import CanaryStatusPanel from "@/components/cockpit/CanaryStatusPanel"
import MCPStatusCard from "@/components/cockpit/MCPStatusCard"
import AIConfidenceMeter from "@/components/cockpit/AIConfidenceMeter"
import AgentArenaPanel from "@/components/visualization/AgentArenaPanel"
import TrafficSplitPanel from "@/components/visualization/TrafficSplitPanel"
import MCPTraceGraph from "@/components/visualization/MCPTraceGraph"
import MemoryGraphVisualizer from "@/components/visualization/MemoryGraphVisualizer"
import { CouncilsPanel } from "@/components/cockpit/CouncilsPanel"
import { BusinessImpactPanel } from "@/components/cockpit/BusinessImpactPanel"
import { LearningPanel } from "@/components/cockpit/LearningPanel"
import { ConfidenceHeatmap } from "@/components/cockpit/ConfidenceHeatmap"
import type { BusinessImpactSummary } from "@/core/orchestration/types"
import type { LearningInsights } from "@/core/agents/learningAgent"
import SequenceDiagramPanel from "@/components/visualization/SequenceDiagramPanel"
import IntegrationLogsPanel from "@/components/cockpit/IntegrationLogsPanel"

type ViewMode = "cockpit" | "v4" | "arena" | "trace" | "traffic" | "memory" | "sequence"

const VIEW_LABELS: Record<ViewMode, string> = {
  cockpit:  "Cockpit",
  v4:       "V4 Brain",
  arena:    "Arena",
  trace:    "Trace",
  traffic:  "Traffic",
  memory:   "Memory",
  sequence: "Sequence",
}

export default function CockpitPage() {
  const { state, heatmapRows, pulse, triggerScenario, injectEvent } = useCockpit()
  const [viewMode, setViewMode] = useState<ViewMode>("cockpit")

  return (
    <div className="min-h-screen pb-10" style={{ background: "radial-gradient(circle at top, rgba(59,130,246,0.16), transparent 32%), linear-gradient(180deg, #f8fbff 0%, #eef3f8 100%)" }}>
      <div className="mx-auto max-w-[1600px] px-6 pt-6">
        <StatusBar
          connected={state.connected}
          connectionMode={state.connectionMode}
          systemMode={state.systemMode}
          heartbeatState={state.heartbeatState}
          eventCount={state.events.length}
          adaptiveStats={state.lastDecision?.orchestrator?.adaptiveStats}
          pulse={pulse}
        />

        <div className="mt-6 rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.09)] backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            {/* V4 Executive Summary strip */}
          {state.lastDecision?.executiveSummary && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 flex items-center gap-3">
              <span className="shrink-0 text-xs font-bold text-emerald-600 font-mono uppercase tracking-widest">Brain</span>
              <p className="text-xs font-mono text-emerald-800 truncate">{state.lastDecision.executiveSummary}</p>
            </div>
          )}

            <div className="grid gap-3 sm:grid-flow-col sm:auto-cols-max">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">Events</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{state.events.length}</div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">Last Decision</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{state.lastDecision ? state.lastDecision.orchestrator.finalDecision : "None"}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {(["cockpit", "v4", "arena", "trace", "traffic", "memory", "sequence"] as ViewMode[]).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${viewMode === mode ? "border-slate-900 bg-slate-950 text-white shadow-lg shadow-slate-200/40" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"}`}>
                {VIEW_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-12 gap-5">
          {viewMode === "v4" && (
            <>
              <div className="col-span-12 xl:col-span-5 flex flex-col gap-5">
                <CouncilsPanel trace={state.lastDecision} />
              </div>
              <div className="col-span-12 xl:col-span-4 flex flex-col gap-5">
                {state.lastDecision?.businessImpact && state.lastDecision?.executiveSummary ? (
                  <BusinessImpactPanel
                    impact={state.lastDecision.businessImpact as BusinessImpactSummary}
                    executiveSummary={state.lastDecision.executiveSummary}
                    decision={state.lastDecision.finalDecision}
                    councilWinner={state.lastDecision.marketDecision?.winningCouncil ?? "risk"}
                    narrative={state.lastDecision.narrative}
                  />
                ) : (
                  <div className="panel-glass rounded-xl p-4 border border-slate-700 text-slate-500 text-xs font-mono">
                    Trigger an event to see Business Impact.
                  </div>
                )}
              </div>
              <div className="col-span-12 xl:col-span-3 flex flex-col gap-5">
                <LearningPanel insights={state.lastDecision?.learningInsights as LearningInsights ?? { ready: false }} />
                <ConfidenceHeatmap data={heatmapRows} />
                <LoadTestPanel onEvent={(e) => injectEvent(e as any)} triggerScenario={triggerScenario} />
              </div>
            </>
          )}

          {viewMode === "cockpit" && (
            <>
              <div className="col-span-12 xl:col-span-4 flex flex-col gap-5">
                <EventStream events={state.events} lastDecision={state.lastDecision} />
                <IntegrationLogsPanel decision={state.lastDecision} />
                <LoadTestPanel onEvent={(e) => injectEvent(e as any)} triggerScenario={triggerScenario} />
                <MCPStatusCard />
              </div>

              <div className="col-span-12 xl:col-span-5 flex flex-col gap-5">
                <AgentGrid decision={state.lastDecision} systemMode={state.systemMode} />
                <TimeHeatmap events={state.events} />
                <CanaryStatusPanel lastDecision={state.lastDecision} />
                <DecisionDebugger decision={state.lastDecision} />
              </div>

              <div className="col-span-12 xl:col-span-3 flex flex-col gap-5">
                <AIConfidenceMeter decision={state.lastDecision} />
                <ActionPanel decision={state.lastDecision} event={state.lastEvent} />
                <DecisionOrderBook decision={state.lastDecision} />
                <ObservabilityMiniPanel decision={state.lastDecision} />
                {/* V4 panels — apparaissent automatiquement quand le Brain est actif */}
                {(() => {
                  const impact = state.lastDecision?.businessImpact as BusinessImpactSummary | undefined
                  const summary = state.lastDecision?.executiveSummary
                  const winner = state.lastDecision?.marketDecision?.winningCouncil ?? "risk"
                  if (!impact || !summary) return null
                  return (
                    <BusinessImpactPanel
                      impact={impact}
                      executiveSummary={summary}
                      decision={state.lastDecision!.finalDecision}
                      councilWinner={winner}
                      narrative={state.lastDecision?.narrative}
                    />
                  )
                })()}
                <LearningPanel insights={state.lastDecision?.learningInsights as LearningInsights ?? { ready: false }} />
                <ConfidenceHeatmap data={heatmapRows} />
              </div>
            </>
          )}

          {viewMode === "arena" && (
            <>
              <div className="col-span-12 xl:col-span-8">
                <AgentArenaPanel lastDecision={state.lastDecision} />
              </div>
              <div className="col-span-12 xl:col-span-4 flex flex-col gap-5">
                <AIConfidenceMeter decision={state.lastDecision} />
                <DecisionOrderBook decision={state.lastDecision} />
                <LoadTestPanel onEvent={(e) => injectEvent(e as any)} triggerScenario={triggerScenario} />
              </div>
            </>
          )}

          {viewMode === "trace" && (
            <>
              <div className="col-span-12 xl:col-span-8">
                <MCPTraceGraph decision={state.lastDecision} />
              </div>
              <div className="col-span-12 xl:col-span-4 flex flex-col gap-5">
                <DecisionDebugger decision={state.lastDecision} />
                <ObservabilityMiniPanel decision={state.lastDecision} />
              </div>
            </>
          )}

          {viewMode === "traffic" && (
            <>
              <div className="col-span-12 xl:col-span-8">
                <TrafficSplitPanel lastDecision={state.lastDecision} />
              </div>
              <div className="col-span-12 xl:col-span-4 flex flex-col gap-5">
                <CanaryStatusPanel lastDecision={state.lastDecision} />
                <MCPStatusCard />
              </div>
            </>
          )}

          {viewMode === "memory" && (
            <>
              <div className="col-span-12 xl:col-span-8">
                <MemoryGraphVisualizer decision={state.lastDecision} />
              </div>
              <div className="col-span-12 xl:col-span-4 flex flex-col gap-5">
                <DecisionDebugger decision={state.lastDecision} />
                <ObservabilityMiniPanel decision={state.lastDecision} />
              </div>
            </>
          )}

          {viewMode === "sequence" && (
            <>
              <div className="col-span-12 xl:col-span-8">
                <SequenceDiagramPanel lastDecision={state.lastDecision} />
              </div>
              <div className="col-span-12 xl:col-span-4 flex flex-col gap-5">
                <DecisionDebugger decision={state.lastDecision} />
                <ObservabilityMiniPanel decision={state.lastDecision} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
