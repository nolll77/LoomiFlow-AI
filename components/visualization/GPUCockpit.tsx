// components/visualization/GPUCockpit.tsx
// WebGL particle system — 10K points driven by agent decisions
// Fallback to Canvas2D if WebGL not available
"use client"
import { useEffect, useRef, useState } from "react"
import { DecisionTrace, SystemMode } from "@/core/shared/types"
import { decisionToGPUState } from "@/lib/gpuDecisionMapping"

export default function GPUCockpit({
  decision,
  systemMode,
  height = 200,
}: {
  decision: DecisionTrace | null
  systemMode: SystemMode
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>()
  const stateRef = useRef(decisionToGPUState(null, "normal", "idle"))
  const [webglAvailable, setWebglAvailable] = useState(true)

  useEffect(() => {
    stateRef.current = decisionToGPUState(
      decision,
      systemMode,
      decision?.orchestrator.severity === "critical" ? "critical" : "active"
    )
    console.log("[GPU] Visual state updated:", {
      decision: decision?.finalDecision,
      turbulence: stateRef.current.turbulence.toFixed(2),
      pointCount: stateRef.current.pointCount,
    })
  }, [decision, systemMode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width  = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    // Try WebGL first
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    if (gl) {
      runWebGL(canvas, gl as WebGLRenderingContext)
    } else {
      setWebglAvailable(false)
      runCanvas2D(canvas)
    }

    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])

  function runCanvas2D(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d")!
    const W = canvas.width, H = canvas.height

    interface Pt { x: number; y: number; vx: number; vy: number; color: string; size: number }
    let points: Pt[] = Array.from({ length: 800 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
      color: "#4DA3FF", size: 1.2 + Math.random(),
    }))

    const animate = () => {
      const s = stateRef.current
      ctx.fillStyle = `rgba(5, 6, 10, ${s.turbulence > 0.5 ? 0.15 : 0.08})`
      ctx.fillRect(0, 0, W, H)

      const [r, g, b] = s.primaryColor
      const color = `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`

      for (const p of points) {
        p.vx += (Math.random() - 0.5) * s.turbulence * 0.3
        p.vy += (Math.random() - 0.5) * s.turbulence * 0.3
        p.vx *= 0.98; p.vy *= 0.98
        p.x = (p.x + p.vx * s.particleSpeed * 2 + W) % W
        p.y = (p.y + p.vy * s.particleSpeed * 2 + H) % H
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = color + (s.redTint > 0 ? "cc" : "88")
        ctx.fill()
      }

      // Red tint overlay for fraud spike
      if (s.redTint > 0) {
        ctx.fillStyle = `rgba(255,0,0,${s.redTint * 0.06})`
        ctx.fillRect(0, 0, W, H)
      }

      // Black hole effect for BLOCK decisions
      if (s.blackHoleActive) {
        const cx = W / 2, cy = H / 2
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60)
        grd.addColorStop(0, "rgba(0,0,0,0.8)")
        grd.addColorStop(1, "rgba(0,0,0,0)")
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.arc(cx, cy, 60, 0, Math.PI * 2)
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(animate)
    }
    animate()
  }

  function runWebGL(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
    // Minimal WebGL point sprite shader
    const vsSource = `
      attribute vec2 a_position;
      attribute float a_size;
      attribute vec3 a_color;
      varying vec3 v_color;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        gl_PointSize = a_size;
        v_color = a_color;
      }
    `
    const fsSource = `
      precision mediump float;
      varying vec3 v_color;
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        float alpha = 1.0 - dist * 2.0;
        gl_FragColor = vec4(v_color, alpha * 0.8);
      }
    `

    const compileShader = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src); gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("[GPU WebGL] Shader error:", gl.getShaderInfoLog(s))
        return null
      }
      return s
    }

    const vs = compileShader(gl.VERTEX_SHADER, vsSource)
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource)
    if (!vs || !fs) { runCanvas2D(canvas); return }

    const program = gl.createProgram()!
    gl.attachShader(program, vs); gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("[GPU WebGL] Link error"); runCanvas2D(canvas); return
    }

    gl.useProgram(program)
    gl.clearColor(0.02, 0.024, 0.04, 1.0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE)

    const N = 3000
    const positions = new Float32Array(N * 2)
    const sizes = new Float32Array(N)
    const colors = new Float32Array(N * 3)
    const velocities = new Float32Array(N * 2)

    for (let i = 0; i < N; i++) {
      positions[i*2]   = (Math.random() - 0.5) * 2
      positions[i*2+1] = (Math.random() - 0.5) * 2
      sizes[i] = 1.5 + Math.random() * 2
      colors[i*3] = 0.3; colors[i*3+1] = 0.64; colors[i*3+2] = 1.0
      velocities[i*2]   = (Math.random() - 0.5) * 0.005
      velocities[i*2+1] = (Math.random() - 0.5) * 0.005
    }

    const posBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW)

    const posLoc = gl.getAttribLocation(program, "a_position")
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const colBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf)
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW)
    const colLoc = gl.getAttribLocation(program, "a_color")
    gl.enableVertexAttribArray(colLoc)
    gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 0, 0)

    const sizeBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf)
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW)
    const sizeLoc = gl.getAttribLocation(program, "a_size")
    gl.enableVertexAttribArray(sizeLoc)
    gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, 0, 0)

    const animate = () => {
      const s = stateRef.current
      gl.clear(gl.COLOR_BUFFER_BIT)

      // Update positions
      for (let i = 0; i < N; i++) {
        velocities[i*2]   += (Math.random()-0.5) * s.turbulence * 0.002
        velocities[i*2+1] += (Math.random()-0.5) * s.turbulence * 0.002
        velocities[i*2]   *= 0.99; velocities[i*2+1] *= 0.99
        positions[i*2]   += velocities[i*2] * s.particleSpeed
        positions[i*2+1] += velocities[i*2+1] * s.particleSpeed
        // Wrap
        if (positions[i*2] >  1.1) positions[i*2] = -1.1
        if (positions[i*2] < -1.1) positions[i*2] =  1.1
        if (positions[i*2+1] >  1.1) positions[i*2+1] = -1.1
        if (positions[i*2+1] < -1.1) positions[i*2+1] =  1.1
        // Apply primary color
        colors[i*3]   = s.primaryColor[0] + s.redTint * 0.5
        colors[i*3+1] = s.primaryColor[1] * (1 - s.redTint * 0.8)
        colors[i*3+2] = s.primaryColor[2] * (1 - s.redTint * 0.6)
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW)
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ARRAY_BUFFER, colBuf)
      gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW)
      gl.vertexAttribPointer(colLoc, 3, gl.FLOAT, false, 0, 0)

      gl.drawArrays(gl.POINTS, 0, N)
      animRef.current = requestAnimationFrame(animate)
    }
    animate()
    console.log("[GPU WebGL] Running with", N, "points")
  }

  return (
    <div className="panel-glass rounded-2xl overflow-hidden relative">
      <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
        <span className="text-[11px] font-bold text-gray-300">GPU COCKPIT</span>
        <span className="text-[9px] text-gray-600">{webglAvailable ? "WebGL" : "Canvas2D"}</span>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ height, background: "#05060A" }}
      />
      {decision && (
        <div className="absolute bottom-2 right-3 text-[9px] font-mono" style={{
          color: decision.finalDecision === "BLOCK" ? "#FF3B3B" :
                 decision.finalDecision === "ALLOW" ? "#2EE59D" : "#4DA3FF"
        }}>
          {decision.finalDecision} · fraud {(decision.agents.fraud.fraudScore * 100).toFixed(0)}%
        </div>
      )}
    </div>
  )
}
