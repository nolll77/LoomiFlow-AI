"use client"
import { ConnectionMode, HeartbeatState, SystemMode } from "@/core/shared/types"

const HEARTBEAT_LABELS: Record<HeartbeatState, string> = { idle: "IDLE", active: "ACTIVE", busy: "BUSY", critical: "🚨 CRITICAL" }
const MODE_COLORS: Record<SystemMode, string> = {
  normal: "text-emerald-600",
  high_load: "text-amber-600",
  fraud_spike: "text-red-600",
  canary: "text-sky-600",
  demo: "text-violet-600",
  explainability: "text-cyan-600",
}

import { OrchestratorDecision } from "@/core/shared/types"

export default function StatusBar({ connected, connectionMode, systemMode, heartbeatState, eventCount, adaptiveStats }: { connected: boolean; connectionMode: ConnectionMode; systemMode: SystemMode; heartbeatState: HeartbeatState; eventCount: number; adaptiveStats?: OrchestratorDecision["adaptiveStats"] }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/90 px-6 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-semibold tracking-[0.2em] text-slate-900">LOOMIFLOW AI</span>
          <span className="text-sm text-slate-500">ACOA v2.0</span>
          <span className="text-sm text-slate-500">Track 6 — Cross‑MCP Orchestration</span>
          
          {adaptiveStats && adaptiveStats.adaptationActive && (
            <span className="ml-2 text-orange-500 font-mono text-[11px] px-2 py-1 bg-orange-500/10 rounded-full flex items-center gap-1 border border-orange-500/20">
              ⚡ ADAPTIVE — BLOCK THRESHOLD: {adaptiveStats.thresholds.fraudBlockThreshold.toFixed(2)}
              {adaptiveStats.avgFraudScore > 0.70 ? <span className="ml-1 text-red-500 animate-pulse font-bold">🔴 ATTACK MODE</span> : ""}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <span className={MODE_COLORS[systemMode]}>{systemMode.toUpperCase()}</span>
          <span className={heartbeatState === "critical" ? "text-red-600 animate-pulse" : "text-slate-500"}>
            ♥ {HEARTBEAT_LABELS[heartbeatState]}
          </span>
          <span>{eventCount} events</span>
          <span className={connected ? "text-emerald-600" : "text-red-600"}>
            {connected ? "● WS" : "○ DISC"}
          </span>
        </div>
      </div>
    </div>
  )
}
