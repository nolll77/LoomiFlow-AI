"use client"
// components/cockpit/StatusBar.tsx
// Evolution E : Commerce Pulse indicator — speedometer circulaire SVG permanent

import { ConnectionMode, HeartbeatState, SystemMode, OrchestratorDecision } from "@/core/shared/types"
import type { CommercePulse } from "@/lib/commercePulse"
import { getPulseColor, getTrendSymbol } from "@/lib/commercePulse"

const HEARTBEAT_LABELS: Record<HeartbeatState, string> = {
  idle: "IDLE", active: "ACTIVE", busy: "BUSY", critical: "🚨 CRITICAL",
}
const MODE_COLORS: Record<SystemMode, string> = {
  normal:          "text-emerald-600",
  high_load:       "text-amber-600",
  fraud_spike:     "text-red-600",
  canary:          "text-sky-600",
  demo:            "text-violet-600",
  explainability:  "text-cyan-600",
}

// ─── CIRCULAR PULSE GAUGE ─────────────────────────────────────

function PulseGauge({ pulse }: { pulse: CommercePulse }) {
  const R      = 18           // radius
  const CX     = 22           // center x
  const CY     = 22           // center y
  const SIZE   = 44           // viewBox
  const STROKE = 4
  const CIRCUMFERENCE = 2 * Math.PI * R

  // Only use ~270° of the circle (bottom gap = 90°)
  const ARC_FRACTION = 0.75
  const dashArray     = CIRCUMFERENCE * ARC_FRACTION
  const fillFraction  = (pulse.score / 100) * ARC_FRACTION
  const dashOffset    = CIRCUMFERENCE * ARC_FRACTION * (1 - fillFraction / ARC_FRACTION)

  const color    = getPulseColor(pulse.score)
  const symbol   = getTrendSymbol(pulse.trend)
  const isPulse  = pulse.score < 40  // animate red

  // Rotation: start arc at ~225° (bottom-left), go clockwise
  const ROTATION = 135

  return (
    <div className="flex items-center gap-2 select-none">
      {/* SVG gauge */}
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Track */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="#1e293b"
            strokeWidth={STROKE}
            strokeDasharray={`${dashArray} ${CIRCUMFERENCE}`}
            strokeLinecap="round"
            transform={`rotate(${ROTATION} ${CX} ${CY})`}
          />
          {/* Fill */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeDasharray={`${dashArray} ${CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(${ROTATION} ${CX} ${CY})`}
            style={{
              transition: "stroke-dashoffset 0.8s ease, stroke 0.5s ease",
              filter: `drop-shadow(0 0 3px ${color}80)`,
            }}
          />
          {/* Score text */}
          <text
            x={CX} y={CY + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fontWeight="bold"
            fontFamily="monospace"
            fill={color}
          >
            {pulse.score}
          </text>
        </svg>

        {/* Pulse ring when critical */}
        {isPulse && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: color }}
          />
        )}
      </div>

      {/* Text label */}
      <div className="flex flex-col leading-none">
        <span className="text-[10px] font-mono font-bold text-slate-700 tracking-widest uppercase">
          Commerce Health
        </span>
        <span
          className="text-[11px] font-mono font-bold"
          style={{ color }}
        >
          {pulse.score}/100 {symbol} {pulse.trend}
        </span>
        {pulse.alerts.length > 0 && (
          <span className="text-[9px] font-mono text-red-500 animate-pulse truncate max-w-[140px]">
            {pulse.alerts[0]}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────

interface Props {
  connected:       boolean
  connectionMode:  ConnectionMode
  systemMode:      SystemMode
  heartbeatState:  HeartbeatState
  eventCount:      number
  adaptiveStats?:  OrchestratorDecision["adaptiveStats"]
  pulse?:          CommercePulse | null
}

export default function StatusBar({
  connected,
  connectionMode,
  systemMode,
  heartbeatState,
  eventCount,
  adaptiveStats,
  pulse,
}: Props) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/90 px-6 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        {/* Left: brand + tags */}
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-semibold tracking-[0.2em] text-slate-900">LOOMIFLOW AI</span>
          <span className="text-sm text-slate-500">ACOA v2.0</span>
          <span className="text-sm text-slate-500">Track 6 — Cross‑MCP Orchestration</span>

          {adaptiveStats?.adaptationActive && (
            <span className="ml-2 text-orange-500 font-mono text-[11px] px-2 py-1 bg-orange-500/10 rounded-full flex items-center gap-1 border border-orange-500/20">
              ⚡ ADAPTIVE — BLOCK THRESHOLD: {adaptiveStats.thresholds.fraudBlockThreshold.toFixed(2)}
              {adaptiveStats.avgFraudScore > 0.70
                ? <span className="ml-1 text-red-500 animate-pulse font-bold">🔴 ATTACK MODE</span>
                : ""}
            </span>
          )}
        </div>

        {/* Right: pulse + system stats */}
        <div className="flex flex-wrap items-center gap-5">

          {/* Commerce Pulse gauge — visible in all tabs */}
          {pulse ? (
            <PulseGauge pulse={pulse} />
          ) : (
            <div className="flex items-center gap-2 opacity-40">
              <svg width={44} height={44} viewBox="0 0 44 44">
                <circle cx={22} cy={22} r={18} fill="none" stroke="#334155" strokeWidth={4}
                  strokeDasharray={`${2 * Math.PI * 18 * 0.75} ${2 * Math.PI * 18}`}
                  strokeLinecap="round" transform="rotate(135 22 22)" />
                <text x={22} y={23} textAnchor="middle" dominantBaseline="middle"
                  fontSize="8" fontFamily="monospace" fill="#64748b">—</text>
              </svg>
              <div className="flex flex-col leading-none">
                <span className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">Commerce Health</span>
                <span className="text-[11px] font-mono text-slate-500">Waiting…</span>
              </div>
            </div>
          )}

          {/* System stats */}
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
    </div>
  )
}
