"use client"
import { ConnectionMode, HeartbeatState, SystemMode } from "@/core/shared/types"

const HEARTBEAT_LABELS: Record<HeartbeatState, string> = { idle: "IDLE", active: "ACTIVE", busy: "BUSY", critical: "🚨 CRITICAL" }
const MODE_COLORS: Record<SystemMode, string> = { normal: "text-green-400", high_load: "text-yellow-400", fraud_spike: "text-red-400", canary: "text-blue-400", demo: "text-purple-400", explainability: "text-cyan-400" }

export default function StatusBar({ connected, connectionMode, systemMode, heartbeatState, eventCount }: { connected: boolean; connectionMode: ConnectionMode; systemMode: SystemMode; heartbeatState: HeartbeatState; eventCount: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-[#1C2333] bg-[#0B0F1A] text-[11px] font-mono">
      <div className="flex items-center gap-4">
        <span className="text-white font-bold tracking-wider">LOOMIFLOW AI</span>
        <span className="text-gray-500">ACOA v2.0</span>
        <span className="text-gray-500">Track 6 — Cross-MCP Orchestration</span>
      </div>
      <div className="flex items-center gap-4">
        <span className={MODE_COLORS[systemMode]}>{systemMode.toUpperCase()}</span>
        <span className={heartbeatState === "critical" ? "text-red-400 animate-pulse" : "text-gray-400"}>
          ♥ {HEARTBEAT_LABELS[heartbeatState]}
        </span>
        <span className="text-gray-500">{eventCount} events</span>
        <span className={connected ? "text-green-400" : "text-red-400"}>
          {connected ? "● WS" : "○ DISC"}
        </span>
      </div>
    </div>
  )
}
