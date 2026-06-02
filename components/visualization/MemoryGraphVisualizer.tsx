// components/visualization/MemoryGraphVisualizer.tsx
"use client"
import { useMemo, useState, useEffect } from "react"
import { DecisionTrace, MemoryNode, MemoryEdge } from "@/core/shared/types"
import { getNodeColor } from "@/lib/memoryGraph"

export default function MemoryGraphVisualizer({ decision }: { decision: DecisionTrace | null }) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  // simple particle animation state
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let animationFrame: number
    const animate = () => {
      setTick(t => t + 1)
      animationFrame = requestAnimationFrame(animate)
    }
    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [])

  const graph = decision?.memoryGraph
  
  const layout = useMemo(() => {
    if (!graph) return null

    // Determine layers
    const layers: MemoryNode[][] = [[], [], [], [], []]
    
    graph.nodes.forEach(n => {
      if (n.id === "obs_event") layers[0].push(n)
      else if (n.type === "tool_call") layers[1].push(n)
      else if (n.type === "state") layers[2].push(n)
      else if (n.type === "observation" && n.id.startsWith("agent_")) layers[3].push(n)
      else if (n.type === "decision") layers[4].push(n)
      else layers[0].push(n) // fallback
    })

    const width = 900
    const height = 500
    const paddingX = 80
    const paddingY = 60
    
    const layerWidth = (width - paddingX * 2) / 4

    const nodePositions = new Map<string, { x: number, y: number }>()

    layers.forEach((layerNodes, layerIndex) => {
      const x = paddingX + layerIndex * layerWidth
      const spacing = (height - paddingY * 2) / Math.max(1, layerNodes.length)
      const startY = layerNodes.length === 1 
        ? height / 2 
        : paddingY + spacing / 2

      layerNodes.forEach((node, nodeIndex) => {
        const y = layerNodes.length === 1 ? startY : startY + nodeIndex * spacing
        nodePositions.set(node.id, { x, y })
      })
    })

    return { nodePositions, width, height }
  }, [graph])

  if (!graph || !layout) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] border border-white/10 rounded-2xl bg-black/20">
        <div className="text-[14px] text-gray-500 font-mono">No Memory Graph available for this decision.</div>
      </div>
    )
  }

  const { nodePositions, width, height } = layout

  // Highlight logic
  const isHighlighted = (edge: MemoryEdge) => {
    if (!hoveredNode) return false
    return edge.from === hoveredNode || edge.to === hoveredNode
  }

  const isNodeHighlighted = (nodeId: string) => {
    if (!hoveredNode) return false
    if (nodeId === hoveredNode) return true
    return graph.edges.some(e => 
      (e.from === hoveredNode && e.to === nodeId) || 
      (e.to === hoveredNode && e.from === nodeId)
    )
  }

  return (
    <div className="relative w-full overflow-x-auto rounded-3xl border border-slate-200/50 bg-white/50 shadow-sm backdrop-blur-xl">
      <div className="p-5 border-b border-slate-100/50 flex justify-between items-center">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Causal AI Memory Graph</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Visualize the exact influence weights that led to the <span className="font-bold text-sky-500">{decision.finalDecision}</span> decision.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1">Layers</div>
          <div className="flex gap-2 text-[9px] font-mono text-slate-500">
            <span>EVENT</span>›<span>MCP</span>›<span>STATE</span>›<span>AGENT</span>›<span>DECISION</span>
          </div>
        </div>
      </div>

      <div className="relative min-w-[900px]">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
          {/* Base Grid / Background (optional) */}
          <defs>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
            <filter id="blur">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          {/* Edges */}
          {graph.edges.map((edge, i) => {
            const p1 = nodePositions.get(edge.from)
            const p2 = nodePositions.get(edge.to)
            if (!p1 || !p2) return null

            const highlight = isHighlighted(edge)
            const dim = hoveredNode && !highlight
            
            // Bézier curve
            const controlOffset = Math.abs(p2.x - p1.x) * 0.4
            const pathData = `M ${p1.x} ${p1.y} C ${p1.x + controlOffset} ${p1.y}, ${p2.x - controlOffset} ${p2.y}, ${p2.x} ${p2.y}`

            const strokeWidth = highlight ? Math.max(2, edge.weight * 5) : Math.max(1, edge.weight * 3)
            const strokeOpacity = dim ? 0.05 : highlight ? 0.8 : edge.weight * 0.4 + 0.1

            return (
              <g key={`edge-${i}`}>
                <path
                  d={pathData}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                  className="transition-all duration-300"
                />
                
                {/* Moving Particles on active edges */}
                {(!hoveredNode || highlight) && (
                  <circle r={highlight ? 3 : 2} fill="#38bdf8" opacity={highlight ? 0.8 : 0.3}>
                    <animateMotion
                      dur={`${2 + (1 - edge.weight) * 2}s`}
                      repeatCount="indefinite"
                      path={pathData}
                      keyPoints="0;1"
                      keyTimes="0;1"
                      calcMode="linear"
                    />
                  </circle>
                )}
                
                {/* Edge Label on Hover */}
                {highlight && (
                  <g transform={`translate(${(p1.x + p2.x) / 2}, ${(p1.y + p2.y) / 2 - 10})`}>
                    <rect x="-40" y="-12" width="80" height="16" fill="white" rx="4" stroke="#e2e8f0" />
                    <text textAnchor="middle" y="0" fontSize="8" fill="#475569" className="font-mono">
                      wt: {edge.weight.toFixed(2)}
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          {/* Nodes */}
          {graph.nodes.map(node => {
            const pos = nodePositions.get(node.id)
            if (!pos) return null

            const color = getNodeColor(node.type)
            const highlight = isNodeHighlighted(node.id)
            const dim = hoveredNode && !highlight
            const isDecision = node.type === "decision"
            
            const radius = isDecision ? 24 : 16
            
            return (
              <g 
                key={node.id} 
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer transition-all duration-300"
                style={{ opacity: dim ? 0.3 : 1 }}
              >
                {/* Glow */}
                {(highlight || isDecision) && (
                  <circle r={radius * 1.8} fill={color} filter="url(#blur)" opacity="0.15" />
                )}
                
                {/* Node Background */}
                <circle 
                  r={radius} 
                  fill="white" 
                  stroke={color} 
                  strokeWidth={highlight ? 3 : 1.5}
                  className="transition-all duration-300 shadow-sm"
                />
                
                {/* Inner Icon or Letter */}
                <text 
                  textAnchor="middle" 
                  y={4} 
                  fontSize={isDecision ? "14" : "10"} 
                  fontWeight="bold" 
                  fill={color}
                  className="font-mono"
                >
                  {isDecision ? "★" : node.type.charAt(0).toUpperCase()}
                </text>

                {/* Node Label Box */}
                <g transform={`translate(0, ${radius + 14})`}>
                  <rect 
                    x={-50} 
                    y={-10} 
                    width={100} 
                    height={36} 
                    fill="white" 
                    stroke="#f1f5f9"
                    rx="6" 
                    className="shadow-sm"
                  />
                  <text textAnchor="middle" y="2" fontSize="9" fontWeight="600" fill="#334155" className="font-sans">
                    {node.label.length > 18 ? node.label.slice(0, 16) + "..." : node.label}
                  </text>
                  <text textAnchor="middle" y="14" fontSize="8" fill="#64748b" className="font-mono">
                    {node.value !== undefined ? (typeof node.value === "number" ? node.value.toFixed(2) : String(node.value)) : node.id}
                  </text>
                  
                  {/* Additional Metadata tooltip on hover */}
                  {highlight && (
                    <g transform="translate(0, 24)">
                      <rect x={-60} y={0} width={120} height={18} fill="#1e293b" rx="4" />
                      <text textAnchor="middle" y="12" fontSize="8" fill="#cbd5e1">
                        {node.metadata?.source || node.type} {node.metadata?.latencyMs ? `(${node.metadata.latencyMs}ms)` : ""}
                      </text>
                    </g>
                  )}
                </g>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
