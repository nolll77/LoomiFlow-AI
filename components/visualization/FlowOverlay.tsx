// components/visualization/FlowOverlay.tsx
// MCP→LLM→Tools particle flow animation
// Shows data flowing from MCP → Agent reasoning → Decision
"use client"
import { useEffect, useRef } from "react"
import { DecisionTrace } from "@/core/shared/types"

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
  stage: "mcp" | "llm" | "decision"
}

const STAGE_COLORS = {
  mcp:      "#8B5CF6",   // purple = Loomi Connect
  llm:      "#4DA3FF",   // blue = reasoning
  decision: "#2EE59D",   // green = resolved
}

export default function FlowOverlay({
  active,
  decision,
}: {
  active: boolean
  decision: DecisionTrace | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>()
  const particlesRef = useRef<Particle[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const spawnParticle = (stage: Particle["stage"]): Particle => {
      const w = canvas.width
      const h = canvas.height
      // Flow left→right: MCP left, LLM center, Decision right
      const x = stage === "mcp" ? 0 : stage === "llm" ? w * 0.33 : w * 0.66
      return {
        x,
        y: h * 0.2 + Math.random() * h * 0.6,
        vx: 1.5 + Math.random() * 2.5,
        vy: (Math.random() - 0.5) * 0.8,
        life: 0,
        maxLife: 60 + Math.random() * 40,
        color: STAGE_COLORS[stage],
        size: 1.5 + Math.random() * 2,
        stage,
      }
    }

    let frame = 0
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Spawn particles
      if (active && frame % 3 === 0) {
        particlesRef.current.push(spawnParticle("mcp"))
        if (frame % 6 === 0) particlesRef.current.push(spawnParticle("llm"))
        if (frame % 9 === 0) particlesRef.current.push(spawnParticle("decision"))
      }

      // Update + draw
      particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife)
      for (const p of particlesRef.current) {
        p.x += p.vx
        p.y += p.vy
        p.life++
        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.8
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color + Math.round(alpha * 255).toString(16).padStart(2, "0")
        ctx.fill()
      }

      // Stage labels
      if (active) {
        ctx.font = "10px monospace"
        ctx.fillStyle = "rgba(255,255,255,0.15)"
        ctx.fillText("MCP", 8, canvas.height * 0.15)
        ctx.fillText("AGENTS", canvas.width * 0.33, canvas.height * 0.15)
        ctx.fillText("DECISION", canvas.width * 0.66, canvas.height * 0.15)
      }

      frame++
      animRef.current = requestAnimationFrame(animate)
    }

    animate()
    return () => {
      window.removeEventListener("resize", resize)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: active ? 0.6 : 0.15, transition: "opacity 0.5s" }}
    />
  )
}
