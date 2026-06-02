// components/visualization/TrafficSplitPanel.tsx
// Live traffic split visualization: PROD / CANARY / SHADOW
// Driven by mcpTrafficController feedback loop
"use client"
import { useEffect, useRef, useState } from "react"
import { DecisionTrace, getAgentOpinionsFromTrace } from "@/core/shared/types"
import { mcpTrafficController } from "@/core/sre/trafficController"
import { getCanaryPhase } from "@/core/sre/rollback"
import { trafficSplitToVisual } from "@/lib/gpuDecisionMapping"

interface TrafficHistory { prod: number; canary: number; shadow: number; ts: number }

export default function TrafficSplitPanel({ lastDecision }: { lastDecision: DecisionTrace | null }) {
  const [split, setSplit] = useState({ prod: 0.85, canary: 0.10, shadow: 0.05 })
  const [history, setHistory] = useState<TrafficHistory[]>([])
  const [reasoning, setReasoning] = useState<string[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!lastDecision) return
    const { fraud, revenue } = getAgentOpinionsFromTrace(lastDecision)
    const orch   = lastDecision.orchestrator

    const result = mcpTrafficController({
      fraudScore:    (fraud?.fraudScore  ?? 0) as number,
      anomalyScore:  (fraud?.confidence  ?? 0) as number,
      geoRisk:       !!lastDecision.paypalData?.fraudSignals?.geoInconsistency,
      errorRate:     orch?.severity === "critical" ? 0.06 : 0.005,
      latencyMs:     (fraud?.latencyMs   ?? 200) as number,
      revenueImpact: (revenue?.revenueAtRisk ?? 0) as number,
    })

    setSplit(result.split)
    setReasoning(result.reasoning)
    setHistory(prev => [...prev.slice(-29), { ...result.split, ts: Date.now() }])

    console.log("[TRAFFIC SPLIT] Updated:", result.split, "Risk:", result.riskScore.toFixed(2))
  }, [lastDecision])

  // Draw history sparkline
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || history.length < 2) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const W = canvas.width, H = canvas.height
    const step = W / (history.length - 1)

    const drawLine = (key: "prod" | "canary" | "shadow", color: string) => {
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      history.forEach((h, i) => {
        const x = i * step
        const y = H - h[key] * H
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.stroke()
    }

    drawLine("prod",   "#2EE59D")
    drawLine("canary", "#FF9F1C")
    drawLine("shadow", "#4DA3FF")
  }, [history])

  const visual = trafficSplitToVisual(split)
  const phase = getCanaryPhase(split)

  return (
    <div className="panel-glass rounded-2xl p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-gray-300">TRAFFIC SPLIT</span>
        <span className="text-[10px]" style={{
          color: visual.alertLevel === "critical" ? "#FF3B3B" :
                 visual.alertLevel === "warning"  ? "#FF9F1C" : "#2EE59D"
        }}>{phase}</span>
      </div>

      {/* Live bars */}
      <div className="space-y-2 mb-3">
        {[
          { label: "🟢 PROD",   value: split.prod,   color: visual.prodColor,   pct: visual.prodWidth },
          { label: "🟠 CANARY", value: split.canary, color: visual.canaryColor, pct: visual.canaryWidth },
          { label: "⚫ SHADOW", value: split.shadow, color: visual.shadowColor, pct: visual.shadowWidth },
        ].map(lane => (
          <div key={lane.label}>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-gray-400">{lane.label}</span>
              <span style={{ color: lane.color }} className="font-mono">{(lane.value * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${lane.pct}%`, background: lane.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Sparkline history */}
      {history.length > 2 && (
        <div className="mb-2">
          <div className="text-[9px] text-gray-600 mb-1">History (last 30s)</div>
          <canvas ref={canvasRef} className="w-full rounded" style={{ height: 40, background: "rgba(255,255,255,0.02)" }} />
        </div>
      )}

      {/* Reasoning */}
      {reasoning.length > 0 && (
        <div className="space-y-0.5">
          {reasoning.slice(0, 2).map((r, i) => (
            <div key={i} className="text-[9px] text-gray-500 flex gap-1">
              <span className="text-gray-700">›</span>{r}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
