// components/visualization/MCPTraceGraph.tsx
// Interactive causal graph — LangSmith-style MCP → Agent → Decision
"use client"
import { useMemo } from "react"
import { DecisionTrace } from "@/core/shared/types"
import { buildTraceGraph } from "@/core/mcp/traceGraph"

export default function MCPTraceGraph({ decision }: { decision: DecisionTrace | null }) {
  const graph = useMemo(() => {
    if (!decision) return null
    return buildTraceGraph(null, decision)
  }, [decision])

  if (!graph) return (
    <div className="panel-glass rounded-xl p-3 opacity-40">
      <div className="text-[11px] font-bold text-gray-300 mb-2">MCP TRACE GRAPH</div>
      <div className="text-[10px] text-gray-600 text-center py-4">No trace yet</div>
    </div>
  )

  const TYPE_ICONS: Record<string, string> = {
    input: "→", mcp_tool: "⬡", agent: "◈", consensus: "⬢", decision: "★", write: "✓"
  }

  return (
    <div className="panel-glass rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-gray-300">MCP TRACE GRAPH</span>
        <span className="text-[10px] text-gray-500">{graph.nodes.length} nodes · {graph.totalLatencyMs}ms</span>
      </div>

      {/* Horizontal flow: input → mcp → agents → consensus → decision → writes */}
      <div className="flex items-start gap-1 overflow-x-auto pb-1">
        {["input", "mcp_tool", "agent", "consensus", "decision", "write"].map(type => {
          const typeNodes = graph.nodes.filter(n => n.type === type)
          if (typeNodes.length === 0) return null
          return (
            <div key={type} className="flex flex-col gap-1 shrink-0">
              <div className="text-[9px] text-gray-600 text-center mb-0.5 uppercase">{type.replace("_", " ")}</div>
              {typeNodes.map(n => (
                <div key={n.id}
                  className="px-2 py-1 rounded border text-[9px] font-mono min-w-[70px] max-w-[90px]"
                  style={{ borderColor: (n.color ?? "#fff") + "44", background: (n.color ?? "#fff") + "08" }}>
                  <div style={{ color: n.color ?? "#fff" }} className="truncate">
                    {TYPE_ICONS[n.type] ?? "○"} {n.label}
                  </div>
                  {n.value !== undefined && (
                    <div className="text-gray-600 truncate text-[8px]">{String(n.value).slice(0, 20)}</div>
                  )}
                  {n.latencyMs && <div className="text-gray-600 text-[8px]">{n.latencyMs}ms</div>}
                </div>
              ))}
            </div>
          )
        }).filter(Boolean)
          .reduce<React.ReactNode[]>((acc, el, i, arr) => {
            acc.push(el)
            if (i < arr.length - 1) {
              acc.push(
                <div key={`arrow-${i}`} className="flex items-center self-center shrink-0 text-gray-600 text-xs">→</div>
              )
            }
            return acc
          }, [])
        }
      </div>

      {/* Edge count + final decision */}
      <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-[9px] text-gray-600">
        <span>{graph.edges.length} causal edges</span>
        <span style={{ color: graph.finalDecision === "BLOCK" ? "#FF3B3B" : graph.finalDecision === "ALLOW" ? "#2EE59D" : "#4DA3FF" }}>
          → {graph.finalDecision}
        </span>
      </div>
    </div>
  )
}
