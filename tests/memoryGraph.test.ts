import { describe, it, expect } from "vitest"
import { buildAgentMemoryGraph, explainAgentDecision, getNodeColor } from "@/lib/memoryGraph"
import type { DecisionTrace } from "@/core/shared/types"

describe("Memory Graph Unit Tests", () => {
  const mockTrace: DecisionTrace = {
    id: "trace_123",
    transactionId: "trans_123",
    timestamp: Date.now(),
    timeline: [],
    finalDecision: "BLOCK",
    confidence: 0.85,
    mcpContextSources: ["get_customer_properties", "list_customer_events"],
    writeActions: [],
    agents: {
      fraud: { latencyMs: 900 } as any,
      revenue: { latencyMs: 600 } as any,
      cx: { latencyMs: 500 } as any,
    },
    orchestrator: { finalDecision: "BLOCK" } as any,
    consensusWeights: { fraud: 0.6, revenue: 0.25, cx: 0.15 },
    reasoning: [],
  }

  it("should build memory graph from trace", () => {
    const graph = buildAgentMemoryGraph(mockTrace)
    expect(graph.decisionId).toBe("trace_123")
    expect(graph.nodes.length).toBeGreaterThan(0)
    expect(graph.edges.length).toBeGreaterThan(0)

    // Check node properties
    const decisionNode = graph.nodes.find(n => n.type === "decision")
    expect(decisionNode).toBeDefined()
    expect(decisionNode?.label).toBe("BLOCK")
  })

  it("should explain decisions correctly based on graph edges", () => {
    const graph = buildAgentMemoryGraph(mockTrace)
    const explanation = explainAgentDecision(graph, "BLOCK")
    expect(explanation.decision).toBe("BLOCK")
    expect(explanation.topDrivers.length).toBeGreaterThan(0)
    expect(explanation.mcpToolsUsed).toContain("get_customer_properties")
    expect(explanation.confidenceSummary).toContain("orchestrator confidence")
  })

  it("should return correct colors for memory node types", () => {
    expect(getNodeColor("observation")).toBe("#4DA3FF")
    expect(getNodeColor("tool_call")).toBe("#A78BFA")
    expect(getNodeColor("unknown_type")).toBe("#6B7280")
  })
})
