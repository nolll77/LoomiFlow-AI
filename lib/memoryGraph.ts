// lib/memoryGraph.ts
// AI Memory Graph — maps MCP tool calls to decision influence weights (E7 spec)

import { DecisionTrace, AgentMemoryGraph, MemoryNode, MemoryEdge, getAgentOpinionsFromTrace } from "@/core/shared/types"

// ─── BUILDER ──────────────────────────────────────────────────

export function buildAgentMemoryGraph(trace: DecisionTrace): AgentMemoryGraph {
  const { finalDecision, mcpContextSources, confidence, id } = trace
  const { fraud, revenue, cx } = getAgentOpinionsFromTrace(trace)

  const nodes: MemoryNode[] = [
    // ── Event observation
    {
      id: "obs_event",
      type: "observation",
      label: `Commerce Event (${trace.transactionId.slice(0, 8)})`,
      timestamp: trace.timestamp - 5000,
      metadata: { source: "paypal" },
    },

    // ── MCP tool calls (map each tool used to a node)
    ...mcpContextSources.map((tool, i): MemoryNode => ({
      id: `mcp_${i}_${tool.replace(/[^a-z0-9]/gi, "_")}`,
      type: "tool_call",
      label: tool,
      timestamp: trace.timestamp - 4000 + i * 200,
      metadata: {
        mcpTool: tool,
        source: "mcp",
        latencyMs:
          tool === "get_customer_properties"     ? 340
          : tool === "get_customer_prediction_score" ? 480
          : tool === "list_customer_events"      ? 290
          : tool === "execute_analytics"         ? 720
          : 350,
      },
    })),

    // ── Derived states
    {
      id: "state_fraud_score",
      type: "state",
      label: `Fraud Score: ${((fraud.fraudScore ?? 0) * 100).toFixed(0)}%`,
      value: (fraud.fraudScore ?? 0) as number,
      timestamp: trace.timestamp - 2500,
      metadata: { source: "fraud-agent" },
    },
    {
      id: "state_ltv",
      type: "state",
      label: `Customer LTV: €${revenue.customerLTV ?? 0}`,
      value: (revenue.customerLTV ?? 0) as number,
      timestamp: trace.timestamp - 2200,
      metadata: { source: "revenue-agent" },
    },
    {
      id: "state_churn",
      type: "state",
      label: `Churn Risk: ${cx.churnRisk ?? "unknown"}`,
      timestamp: trace.timestamp - 2000,
      metadata: { source: "cx-agent" },
    },

    // ── Agent recommendations
    {
      id: "agent_fraud",
      type: "observation",
      label: `Fraud Agent → ${fraud.recommendation}`,
      value: (fraud.score ?? 0) as number,
      timestamp: trace.timestamp - 1500,
      metadata: { source: "fraud-agent", confidence: (fraud.confidence ?? 0) as number },
    },
    {
      id: "agent_revenue",
      type: "observation",
      label: `Revenue Agent → ${revenue.recommendation}`,
      value: (revenue.score ?? 0) as number,
      timestamp: trace.timestamp - 1400,
      metadata: { source: "revenue-agent", confidence: (revenue.confidence ?? 0) as number },
    },
    {
      id: "agent_cx",
      type: "observation",
      label: `CX Agent → ${cx.recommendation}`,
      value: (cx.score ?? 0) as number,
      timestamp: trace.timestamp - 1300,
      metadata: { source: "cx-agent", confidence: (cx.confidence ?? 0) as number },
    },

    // ── Final decision
    {
      id: "decision",
      type: "decision",
      label: finalDecision,
      timestamp: trace.timestamp,
      metadata: { confidence },
    },
  ]

  // ── Build edges with influence weights
  const edges: MemoryEdge[] = [
    // Event → MCP tools
    ...mcpContextSources.map((tool, i): MemoryEdge => ({
      from: "obs_event",
      to: `mcp_${i}_${tool.replace(/[^a-z0-9]/gi, "_")}`,
      weight: 0.85,
      reason: `${tool} enrichment triggered by event`,
    })),

    // MCP tools → states
    ...(mcpContextSources.includes("get_customer_properties")
      ? [{ from: `mcp_0_get_customer_properties`, to: "state_ltv", weight: 1.0, reason: "LTV extracted from properties" }]
      : []),
    ...(mcpContextSources.includes("get_customer_prediction_score")
      ? [{ from: `mcp_${mcpContextSources.indexOf("get_customer_prediction_score")}_get_customer_prediction_score`, to: "state_churn", weight: 1.0, reason: "Churn score from prediction tool" }]
      : []),

    // States → Agent results
    { from: "state_fraud_score", to: "agent_fraud",   weight: 0.95, reason: "Fraud score directly drives fraud agent" },
    { from: "state_ltv",         to: "agent_revenue",  weight: 0.88, reason: "LTV determines revenue priority" },
    { from: "state_churn",       to: "agent_cx",       weight: 0.90, reason: "Churn risk shapes CX recommendation" },

    // Agent results → Decision (consensus weights from E6)
    { from: "agent_fraud",   to: "decision", weight: 0.62, reason: "Fraud agent weight: 62% (safety-first)" },
    { from: "agent_revenue", to: "decision", weight: 0.23, reason: "Revenue agent weight: 23%" },
    { from: "agent_cx",      to: "decision", weight: 0.15, reason: "CX agent weight: 15%" },

    // Event directly → Decision
    { from: "obs_event", to: "decision", weight: 0.60, reason: "Raw event signals (type, value, paypal fraud)" },
  ]

  return {
    agentId: "fraud-revenue-cx-orchestrator",
    decisionId: id,
    nodes,
    edges,
    timestamp: trace.timestamp,
  }
}

// ─── EXPLAINABILITY QUERY ─────────────────────────────────────

export interface DecisionExplanation {
  decision: string
  topDrivers: Array<{
    node: string
    influence: string
    isMCP: boolean
    sourceType: string
  }>
  mcpToolsUsed: string[]
  confidenceSummary: string
}

export function explainAgentDecision(graph: AgentMemoryGraph, decisionLabel: string): DecisionExplanation {
  // Sum outgoing influence weights per source node
  const influence = graph.edges.reduce((acc, e) => {
    acc[e.from] = (acc[e.from] ?? 0) + e.weight
    return acc
  }, {} as Record<string, number>)

  const topDrivers = Object.entries(influence)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([nodeId, score]) => {
      const node = graph.nodes.find(n => n.id === nodeId)
      return {
        node: node?.label ?? nodeId,
        influence: score.toFixed(2),
        isMCP: node?.metadata?.source === "mcp",
        sourceType: node?.metadata?.source ?? node?.type ?? "unknown",
      }
    })

  const mcpToolsUsed = graph.nodes
    .filter(n => n.type === "tool_call")
    .map(n => n.metadata?.mcpTool ?? n.label)
    .filter(Boolean)

  const confidence = graph.nodes.find(n => n.type === "decision")?.metadata?.confidence ?? 0
  const confidenceSummary = `${(confidence * 100).toFixed(0)}% orchestrator confidence — top driver: ${topDrivers[0]?.node ?? "N/A"}`

  return { decision: decisionLabel, topDrivers, mcpToolsUsed, confidenceSummary }
}

// ─── NODE COLOR HELPERS ───────────────────────────────────────

export const MEMORY_NODE_COLORS: Record<string, string> = {
  observation: "#4DA3FF",
  tool_call:   "#A78BFA",
  state:       "#34D399",
  decision:    "#F59E0B",
  mcp:         "#A78BFA",
}

export function getNodeColor(type: string): string {
  return MEMORY_NODE_COLORS[type] ?? "#6B7280"
}
