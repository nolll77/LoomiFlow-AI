// components/cockpit/AIConfidenceMeter.tsx
"use client"
import { DecisionTrace } from "@/core/shared/types"

export default function AIConfidenceMeter({ decision }: { decision: DecisionTrace | null }) {
  if (!decision) return null

  const c = decision.confidence
  const color = c > 0.8 ? "#2EE59D" : c > 0.6 ? "#FF9F1C" : "#FF3B3B"
  const label = c > 0.8 ? "HIGH" : c > 0.6 ? "MEDIUM" : "LOW"

  // Radial gauge: simple SVG arc
  const radius = 28, cx = 36, cy = 36
  const circumference = 2 * Math.PI * radius
  const arc = circumference * c

  return (
    <div className="panel-glass rounded-2xl p-3 flex flex-col items-center">
      <div className="text-[11px] font-bold text-gray-300 mb-2">AI CONFIDENCE</div>
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle cx={cx} cy={cy} r={radius} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={`${arc} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 0.7s ease" }}
        />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="13" fontFamily="monospace" fontWeight="bold">
          {(c * 100).toFixed(0)}%
        </text>
      </svg>
      <div className="text-[10px] mt-1" style={{ color }}>{label} CONFIDENCE</div>
      <div className="text-[9px] text-gray-600 mt-0.5">
        {decision.agents.fraud.agentName ? `Fraud·Revenue·CX consensus` : ""}
      </div>
    </div>
  )
}
