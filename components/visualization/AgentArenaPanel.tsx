// components/visualization/AgentArenaPanel.tsx
// Real-time competitive AI arena — 3 agents as competing force fields
// Visual: colored "storms" that grow/shrink based on agent weight
"use client"
import { useEffect, useRef, useState } from "react"
import { DecisionTrace } from "@/core/shared/types"
import { ArenaFraudAgent, ArenaSREAgent, ArenaRevenueAgent } from "@/core/agents/arenaAgents"
import { resolveArena, updateArenaWeights, computeArenaRewards } from "@/core/agents/arenaEngine"
import { arenaToForceFields } from "@/lib/gpuDecisionMapping"

interface ForceField {
  x: number
  y: number
  radius: number
  color: string
  intensity: number
  label: string
  weight: number
  lastVote: string
}

export default function AgentArenaPanel({ lastDecision }: { lastDecision: DecisionTrace | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>()
  const [arenaResult, setArenaResult] = useState<any>(null)

  useEffect(() => {
    if (!lastDecision) return

    // Run arena with latest event data
    const syntheticEvent = {
      id: lastDecision.transactionId,
      type: "payment_failed" as const,
      timestamp: lastDecision.timestamp,
      customerId: "arena_test",
      fraudScore: lastDecision.agents.fraud.fraudScore,
      value: lastDecision.agents.revenue.revenueAtRisk,
      mcpContext: { customerId: "", fetchedAt: Date.now() },
    }

    const result = resolveArena(syntheticEvent as any)
    const rewards = computeArenaRewards(result)
    updateArenaWeights(rewards)
    setArenaResult(result)

    console.log("[ARENA PANEL] Result:", result.finalDecision, "Consensus:", result.consensus.toFixed(2))
  }, [lastDecision])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const fields = arenaToForceFields(
      ArenaFraudAgent.weight,
      ArenaRevenueAgent.weight,
      ArenaSREAgent.weight
    )

    const W = canvas.width
    const H = canvas.height

    const forceFields: ForceField[] = [
      {
        x: W * 0.25, y: H * 0.35,
        radius: fields.fraud.radius,
        color: "#FF3B3B",
        intensity: fields.fraud.intensity,
        label: "FRAUD",
        weight: ArenaFraudAgent.weight,
        lastVote: arenaResult?.votes?.find((v: any) => v.agent === "fraud")?.vote ?? "—",
      },
      {
        x: W * 0.75, y: H * 0.35,
        radius: fields.revenue.radius,
        color: "#2EE59D",
        intensity: fields.revenue.intensity,
        label: "REVENUE",
        weight: ArenaRevenueAgent.weight,
        lastVote: arenaResult?.votes?.find((v: any) => v.agent === "revenue")?.vote ?? "—",
      },
      {
        x: W * 0.50, y: H * 0.72,
        radius: fields.sre.radius,
        color: "#4DA3FF",
        intensity: fields.sre.intensity,
        label: "SRE",
        weight: ArenaSREAgent.weight,
        lastVote: arenaResult?.votes?.find((v: any) => v.agent === "sre")?.vote ?? "—",
      },
    ]

    let frame = 0
    const animate = () => {
      ctx.clearRect(0, 0, W, H)

      // Draw force fields
      for (const f of forceFields) {
        const pulseRadius = f.radius * (1 + Math.sin(frame * 0.05 + forceFields.indexOf(f)) * 0.08)

        // Outer glow
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, pulseRadius)
        grad.addColorStop(0, f.color + "40")
        grad.addColorStop(0.5, f.color + "18")
        grad.addColorStop(1, f.color + "00")
        ctx.beginPath()
        ctx.arc(f.x, f.y, pulseRadius, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        // Core
        ctx.beginPath()
        ctx.arc(f.x, f.y, 12 + f.intensity * 15, 0, Math.PI * 2)
        ctx.fillStyle = f.color + "33"
        ctx.strokeStyle = f.color
        ctx.lineWidth = 1.5
        ctx.fill()
        ctx.stroke()

        // Label
        ctx.font = "bold 9px monospace"
        ctx.fillStyle = f.color
        ctx.textAlign = "center"
        ctx.fillText(f.label, f.x, f.y - 22)
        ctx.font = "8px monospace"
        ctx.fillStyle = "rgba(255,255,255,0.6)"
        ctx.fillText(f.lastVote, f.x, f.y)
        ctx.fillText(`w=${f.weight.toFixed(2)}`, f.x, f.y + 10)
      }

      // Conflict lines between fields (when weights differ)
      for (let i = 0; i < forceFields.length; i++) {
        for (let j = i + 1; j < forceFields.length; j++) {
          const a = forceFields[i], b = forceFields[j]
          const conflict = Math.abs(a.intensity - b.intensity)
          if (conflict > 0.1) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(255,255,255,${conflict * 0.15 + Math.sin(frame * 0.1) * 0.05})`
            ctx.lineWidth = conflict * 2
            ctx.setLineDash([4, 6])
            ctx.stroke()
            ctx.setLineDash([])
          }
        }
      }

      // Arena consensus indicator (center)
      if (arenaResult) {
        const cx = W * 0.5, cy = H * 0.5
        const consensusColor = arenaResult.consensus > 0.6 ? "#FF3B3B" : arenaResult.consensus > 0.4 ? "#FF9F1C" : "#2EE59D"
        ctx.font = "bold 10px monospace"
        ctx.fillStyle = consensusColor
        ctx.textAlign = "center"
        ctx.fillText(arenaResult.finalDecision, cx, cy - 6)
        ctx.font = "8px monospace"
        ctx.fillStyle = "rgba(255,255,255,0.4)"
        ctx.fillText(`consensus ${(arenaResult.consensus * 100).toFixed(0)}%`, cx, cy + 8)
      }

      frame++
      animRef.current = requestAnimationFrame(animate)
    }

    animate()
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [arenaResult])

  return (
    <div className="panel-glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <span className="text-[11px] font-bold text-gray-300">AGENT ARENA</span>
        <div className="flex items-center gap-2 text-[10px]">
          {arenaResult && (
            <>
              <span className={arenaResult.conflictDetected ? "text-red-400" : "text-green-400"}>
                {arenaResult.conflictDetected ? "⚡ CONFLICT" : "✓ CONSENSUS"}
              </span>
            </>
          )}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: 160, display: "block" }}
      />
      {/* Weight evolution bars */}
      <div className="px-3 pb-3 grid grid-cols-3 gap-1">
        {[
          { label: "F", weight: ArenaFraudAgent.weight,   color: "#FF3B3B" },
          { label: "R", weight: ArenaRevenueAgent.weight, color: "#2EE59D" },
          { label: "S", weight: ArenaSREAgent.weight,     color: "#4DA3FF" },
        ].map(a => (
          <div key={a.label}>
            <div className="flex justify-between text-[9px] mb-0.5">
              <span style={{ color: a.color }}>{a.label}</span>
              <span className="text-gray-500">{a.weight.toFixed(2)}</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(a.weight / 2, 1) * 100}%`, background: a.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
