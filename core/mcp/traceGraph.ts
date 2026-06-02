// core/mcp/traceGraph.ts
// LangSmith-style causal graph of MCP tool calls → decision
// Shows: which MCP tools were called, what they returned, how they influenced the decision

import { MCPCustomerContext, DecisionTrace } from "@/core/shared/types"

export interface TraceNode {
  id: string
  label: string
  type: "input" | "mcp_tool" | "agent" | "consensus" | "decision" | "write"
  value?: string | number
  latencyMs?: number
  success?: boolean
  color?: string
}

export interface TraceEdge {
  from: string
  to: string
  label?: string
  weight?: number  // 0–1 influence
  color?: string
}

export interface MCPTraceGraph {
  nodes: TraceNode[]
  edges: TraceEdge[]
  decisionId: string
  finalDecision: string
  totalLatencyMs: number
}

const NODE_COLORS = {
  input:     "#4DA3FF",
  mcp_tool:  "#8B5CF6",
  agent:     "#FF9F1C",
  consensus: "#2EE59D",
  decision:  "#FF3B3B",
  write:     "#2EE59D",
}

export function buildTraceGraph(
  ctx: MCPCustomerContext | null,
  trace: DecisionTrace
): MCPTraceGraph {
  console.log("[TRACE GRAPH] Building for decision:", trace.finalDecision)
  const nodes: TraceNode[] = []
  const edges: TraceEdge[] = []

  // ─── INPUT NODE ───────────────────────────────────────────
  nodes.push({
    id: "input",
    label: `${trace.agents.fraud.agentName ? "Commerce Event" : "Event"}`,
    type: "input",
    color: NODE_COLORS.input,
  })

  // ─── MCP TOOL NODES ───────────────────────────────────────
  const toolsUsed = ctx?.toolsUsed ?? trace.mcpContextSources
  const mcpNodeIds: string[] = []

  toolsUsed.forEach((tool, i) => {
    const nodeId = `mcp_${i}`
    mcpNodeIds.push(nodeId)

    let value: string | undefined
    if (tool === "get_customer_properties") value = `tier=${ctx?.tier}, ltv=€${ctx?.ltv}`
    if (tool === "get_customer_prediction_score") value = `churn=${ctx?.churnRisk}, score=${ctx?.predictionScore?.toFixed(2)}`
    if (tool === "list_customer_events") value = `${ctx?.totalOrders ?? "?"} orders`
    if (tool === "get_scenario") value = ctx?.currentScenario ?? "no active scenario"
    if (tool === "get_api_trigger") value = "trigger URL obtained"

    nodes.push({
      id: nodeId,
      label: tool.replace("get_", "").replace(/_/g, " "),
      type: "mcp_tool",
      value,
      latencyMs: ctx?.latencyMs ? Math.round(ctx.latencyMs / toolsUsed.length) : undefined,
      success: !ctx?.error,
      color: NODE_COLORS.mcp_tool,
    })

    edges.push({
      from: "input", to: nodeId,
      label: "enriches",
      weight: 0.8,
      color: NODE_COLORS.mcp_tool,
    })
  })

  // ─── AGENT NODES ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = trace.agents as any
  const agentDefs = [
    { id: "agent_fraud",   label: "Fraud Agent",   rec: a.fraud?.recommendation,   score: a.fraud?.score   ?? 0, color: "#FF3B3B" },
    { id: "agent_revenue", label: "Revenue Agent", rec: a.revenue?.recommendation, score: a.revenue?.score ?? 0, color: "#FF9F1C" },
    { id: "agent_cx",      label: "CX Agent",      rec: a.cx?.recommendation,      score: a.cx?.score      ?? 0, color: "#2EE59D" },
  ]

  agentDefs.forEach(a => {
    nodes.push({ id: a.id, label: a.label, type: "agent", value: `${a.rec} (${(a.score*100).toFixed(0)}%)`, color: a.color })

    // MCP → Agent edges
    mcpNodeIds.forEach(mcpId => {
      edges.push({ from: mcpId, to: a.id, weight: 0.6, color: a.color + "80" })
    })
    if (mcpNodeIds.length === 0) {
      edges.push({ from: "input", to: a.id, weight: 0.5 })
    }
  })

  // ─── CONSENSUS NODE ───────────────────────────────────────
  nodes.push({
    id: "consensus",
    label: "Orchestrator",
    type: "consensus",
    value: `${(trace.confidence * 100).toFixed(0)}% confidence`,
    color: NODE_COLORS.consensus,
  })
  agentDefs.forEach(a => {
    const w = trace.consensusWeights[a.id.split("_")[1] as keyof typeof trace.consensusWeights]
    edges.push({ from: a.id, to: "consensus", label: `w=${w}`, weight: w, color: a.color })
  })

  // ─── DECISION NODE ────────────────────────────────────────
  nodes.push({
    id: "decision",
    label: trace.finalDecision,
    type: "decision",
    color: trace.finalDecision === "BLOCK" ? "#FF3B3B" : trace.finalDecision === "ALLOW" ? "#2EE59D" : "#4DA3FF",
  })
  edges.push({ from: "consensus", to: "decision", weight: 1.0, label: "→", color: NODE_COLORS.decision })

  // ─── WRITE NODES ──────────────────────────────────────────
  if (trace.writeActions && trace.writeActions.length > 0) {
    trace.writeActions.forEach((w, i) => {
      const wId = `write_${i}`
      nodes.push({
        id: wId,
        label: w.type.replace(/_/g, " "),
        type: "write",
        success: w.status === "success",
        color: w.status === "success" ? "#2EE59D" : "#FF3B3B",
      })
      edges.push({ from: "decision", to: wId, weight: 0.9, color: NODE_COLORS.write })
    })
  }

  const totalLatencyMs = trace.timeline.reduce((a, e) => a + (e.durationMs ?? 0), 0)

  console.log(`[TRACE GRAPH] Built: ${nodes.length} nodes, ${edges.length} edges`)
  return { nodes, edges, decisionId: trace.id, finalDecision: trace.finalDecision, totalLatencyMs }
}
