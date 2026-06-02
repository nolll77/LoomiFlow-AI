// components/visualization/ElectricBeams.tsx
// SVG animated paths connecting agents to orchestrator
// Intensity scales with fraud score and decision severity
"use client"
import { useMemo } from "react"
import { DecisionTrace } from "@/core/shared/types"

interface Beam {
  id: string
  d: string         // SVG path
  color: string
  width: number
  dashArray: string
  animDuration: string
  opacity: number
}

export default function ElectricBeams({
  decision,
  width = 400,
  height = 200,
}: {
  decision: DecisionTrace | null
  width?: number
  height?: number
}) {
  const beams = useMemo<Beam[]>(() => {
    if (!decision) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = decision.agents as any
    const fraud   = a?.fraud   ?? {}
    const revenue = a?.revenue ?? {}
    const cx      = a?.cx      ?? {}
    const fraudScore = (fraud.fraudScore ?? fraud.score ?? 0) as number

    // Agent positions (left third)
    const fraudPos  = { x: width * 0.12, y: height * 0.20 }
    const revenuePos = { x: width * 0.12, y: height * 0.50 }
    const cxPos     = { x: width * 0.12, y: height * 0.80 }

    // Orchestrator (center)
    const orchPos = { x: width * 0.50, y: height * 0.50 }

    // Decision (right)
    const decisionPos = { x: width * 0.88, y: height * 0.50 }

    const makeCurve = (
      from: { x: number; y: number },
      to: { x: number; y: number }
    ) => {
      const mx = (from.x + to.x) / 2
      return `M ${from.x} ${from.y} Q ${mx} ${from.y} ${to.x} ${to.y}`
    }

    const AGENT_COLORS: Record<string, string> = {
      BLOCK:        "#FF3B3B",
      ALLOW:        "#2EE59D",
      STEP_UP_AUTH: "#4DA3FF",
      HOLD:         "#FF9F1C",
      THROTTLE:     "#8B5CF6",
    }

    return [
      // Fraud → Orchestrator
      {
        id: "fraud-orch",
        d: makeCurve(fraudPos, orchPos),
        color: AGENT_COLORS[fraud.recommendation] ?? "#FF3B3B",
        width: 1 + fraud.score * 2,
        dashArray: fraudScore > 0.6 ? "4 2" : "8 4",
        animDuration: fraudScore > 0.6 ? "0.8s" : "1.5s",
        opacity: 0.4 + fraud.score * 0.6,
      },
      // Revenue → Orchestrator
      {
        id: "revenue-orch",
        d: makeCurve(revenuePos, orchPos),
        color: AGENT_COLORS[revenue.recommendation] ?? "#FF9F1C",
        width: 1 + revenue.score * 2,
        dashArray: "6 3",
        animDuration: "1.2s",
        opacity: 0.4 + revenue.score * 0.5,
      },
      // CX → Orchestrator
      {
        id: "cx-orch",
        d: makeCurve(cxPos, orchPos),
        color: AGENT_COLORS[cx.recommendation] ?? "#2EE59D",
        width: 1 + cx.score * 1.5,
        dashArray: "5 4",
        animDuration: "1.4s",
        opacity: 0.3 + cx.score * 0.5,
      },
      // Orchestrator → Decision (thicker, solid)
      {
        id: "orch-decision",
        d: makeCurve(orchPos, decisionPos),
        color: AGENT_COLORS[decision.finalDecision] ?? "#fff",
        width: 2.5,
        dashArray: "0",
        animDuration: "1.0s",
        opacity: 0.9,
      },
    ]
  }, [decision, width, height])

  if (!decision) return null

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: "visible" }}
    >
      <defs>
        {beams.map(b => (
          <filter key={`glow-${b.id}`} id={`glow-${b.id}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>

      {beams.map(b => (
        <g key={b.id}>
          {/* Glow layer */}
          <path
            d={b.d}
            stroke={b.color}
            strokeWidth={b.width * 3}
            fill="none"
            opacity={b.opacity * 0.2}
            filter={`url(#glow-${b.id})`}
          />
          {/* Main beam */}
          <path
            d={b.d}
            stroke={b.color}
            strokeWidth={b.width}
            fill="none"
            opacity={b.opacity}
            strokeDasharray={b.dashArray === "0" ? undefined : b.dashArray}
          >
            {b.dashArray !== "0" && (
              <animate
                attributeName="stroke-dashoffset"
                from="100"
                to="0"
                dur={b.animDuration}
                repeatCount="indefinite"
              />
            )}
          </path>
        </g>
      ))}

      {/* Agent dots */}
      {decision && [
        { pos: { x: width * 0.12, y: height * 0.20 }, color: "#FF3B3B", label: "F" },
        { pos: { x: width * 0.12, y: height * 0.50 }, color: "#FF9F1C", label: "R" },
        { pos: { x: width * 0.12, y: height * 0.80 }, color: "#2EE59D", label: "C" },
        { pos: { x: width * 0.50, y: height * 0.50 }, color: "#ffffff", label: "O" },
        { pos: { x: width * 0.88, y: height * 0.50 }, color: "#4DA3FF", label: "D" },
      ].map(n => (
        <g key={n.label}>
          <circle cx={n.pos.x} cy={n.pos.y} r="8" fill={n.color + "22"} stroke={n.color} strokeWidth="1" />
          <text x={n.pos.x} y={n.pos.y + 1} textAnchor="middle" dominantBaseline="middle"
            fill={n.color} fontSize="8" fontFamily="monospace">{n.label}</text>
        </g>
      ))}
    </svg>
  )
}
