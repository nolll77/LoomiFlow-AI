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
import HeartbeatBackground from "@/components/cockpit/HeartbeatBackground"
import ObservabilityMiniPanel from "@/components/cockpit/ObservabilityMiniPanel"
import DecisionDebugger from "@/components/cockpit/DecisionDebugger"
import DecisionOrderBook from "@/components/cockpit/DecisionOrderBook"
import CanaryStatusPanel from "@/components/cockpit/CanaryStatusPanel"
import MCPStatusCard from "@/components/cockpit/MCPStatusCard"
import AIConfidenceMeter from "@/components/cockpit/AIConfidenceMeter"
import GPUCockpit from "@/components/visualization/GPUCockpit"
import AgentArenaPanel from "@/components/visualization/AgentArenaPanel"
import TrafficSplitPanel from "@/components/visualization/TrafficSplitPanel"
import MCPTraceGraph from "@/components/visualization/MCPTraceGraph"
import ElectricBeams from "@/components/visualization/ElectricBeams"
import { HEARTBEAT_COLORS } from "@/lib/heartbeat"

type ViewMode = "cockpit" | "arena" | "trace" | "traffic"

export default function CockpitPage() {
  const { state, triggerScenario, injectEvent } = useCockpit()
  const [viewMode, setViewMode] = useState<ViewMode>("cockpit")
  const isBurst = state.heartbeatState === "critical"

  return (
    <div
      className={`min-h-screen flex flex-col relative ${isBurst ? "burst-mode" : ""}`}
      style={{ background: HEARTBEAT_COLORS[state.heartbeatState] }}
    >
      <HeartbeatBackground score={state.heartbeatScore} state={state.heartbeatState} />

      <StatusBar
        connected={state.connected}
        connectionMode={state.connectionMode}
        systemMode={state.systemMode}
        heartbeatState={state.heartbeatState}
        eventCount={state.events.length}
      />

      {/* View mode tabs */}
      <div className="flex gap-1 px-2 pt-1 border-b border-[#1C2333] relative z-20">
        {(["cockpit", "arena", "trace", "traffic"] as ViewMode[]).map(m => (
          <button key={m} onClick={() => setViewMode(m)}
            className={`text-[10px] px-3 py-1.5 rounded-t border-b-2 transition-all ${
              viewMode === m ? "border-blue-400 text-blue-300" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}>
            {m === "cockpit"  && "⚡ COCKPIT"}
            {m === "arena"    && "⚔️ ARENA"}
            {m === "trace"    && "🔗 TRACE"}
            {m === "traffic"  && "🌊 TRAFFIC"}
          </button>
        ))}
      </div>

      <div className="flex-1 relative z-10 p-2">

        {/* GPU always-on background */}
        {state.lastDecision && (
          <div className="absolute top-2 right-2 w-48 z-10 pointer-events-none opacity-60">
            <GPUCockpit decision={state.lastDecision} systemMode={state.systemMode} height={120} />
          </div>
        )}

        {/* ─── COCKPIT VIEW ─── */}
        {viewMode === "cockpit" && (
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-3 flex flex-col gap-2">
              <EventStream events={state.events} lastDecision={state.lastDecision} />
              <LoadTestPanel onEvent={(e) => injectEvent(e as any)} triggerScenario={triggerScenario} />
              <MCPStatusCard />
            </div>
            <div className="col-span-6 flex flex-col gap-2">
              {/* Electric beams overlay */}
              <div className="relative">
                <AgentGrid decision={state.lastDecision} systemMode={state.systemMode} />
                {state.lastDecision && (
                  <div className="absolute inset-0 pointer-events-none">
                    <ElectricBeams decision={state.lastDecision} width={600} height={220} />
                  </div>
                )}
              </div>
              <TimeHeatmap events={state.events} />
              <CanaryStatusPanel lastDecision={state.lastDecision} />
              <DecisionDebugger decision={state.lastDecision} />
            </div>
            <div className="col-span-3 flex flex-col gap-2">
              <AIConfidenceMeter decision={state.lastDecision} />
              <ActionPanel decision={state.lastDecision} event={state.lastEvent} />
              <DecisionOrderBook decision={state.lastDecision} />
              <ObservabilityMiniPanel decision={state.lastDecision} />
            </div>
          </div>
        )}

        {/* ─── ARENA VIEW ─── */}
        {viewMode === "arena" && (
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-8">
              <AgentArenaPanel lastDecision={state.lastDecision} />
            </div>
            <div className="col-span-4 flex flex-col gap-2">
              <AIConfidenceMeter decision={state.lastDecision} />
              <DecisionOrderBook decision={state.lastDecision} />
              <LoadTestPanel onEvent={(e) => injectEvent(e as any)} triggerScenario={triggerScenario} />
            </div>
          </div>
        )}

        {/* ─── TRACE VIEW ─── */}
        {viewMode === "trace" && (
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-8">
              <MCPTraceGraph decision={state.lastDecision} />
            </div>
            <div className="col-span-4 flex flex-col gap-2">
              <DecisionDebugger decision={state.lastDecision} />
              <ObservabilityMiniPanel decision={state.lastDecision} />
            </div>
          </div>
        )}

        {/* ─── TRAFFIC VIEW ─── */}
        {viewMode === "traffic" && (
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-8">
              <TrafficSplitPanel lastDecision={state.lastDecision} />
            </div>
            <div className="col-span-4 flex flex-col gap-2">
              <CanaryStatusPanel lastDecision={state.lastDecision} />
              <MCPStatusCard />
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
