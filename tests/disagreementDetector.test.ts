import { describe, it, expect } from "vitest"
import { detectDisagreements, extractOpinionsFromTrace } from "@/lib/disagreementDetector"
import type { AgentOpinion } from "@/core/shared/agentTypes"

describe("Disagreement Detector Unit Tests", () => {
  it("should return empty disagreements if no opinions are opposed", () => {
    const opinions: any[] = [
      { agentId: "fraud", recommendation: "ALLOW", confidence: 0.9, reasons: [], expectedOutcome: {}, dataQuality: 1, urgency: "medium" },
      { agentId: "revenue", recommendation: "ALLOW", confidence: 0.8, reasons: [], expectedOutcome: {}, dataQuality: 1, urgency: "medium" },
    ]
    const disagreements = detectDisagreements(opinions, 100, 500)
    expect(disagreements.length).toBe(0)
  })

  it("should detect tension between opposed recommendations", () => {
    const opinions: any[] = [
      { agentId: "fraud", recommendation: "BLOCK", confidence: 0.9, reasons: [], expectedOutcome: {}, dataQuality: 1, urgency: "medium" },
      { agentId: "revenue", recommendation: "ALLOW", confidence: 0.8, reasons: [], expectedOutcome: {}, dataQuality: 1, urgency: "medium" },
    ]
    const disagreements = detectDisagreements(opinions, 100, 500)
    expect(disagreements.length).toBe(1)
    expect(disagreements[0].severity).toBe("CRITICAL") // 0.9 * 0.8 * 1.0 = 0.72 > 0.70
    expect(disagreements[0].tensionScore).toBeCloseTo(0.72, 2)
    expect(disagreements[0].businessStake).toBe(100 + 500 * 0.1)
    expect(disagreements[0].narrativeConflict).toContain("fraud wants to block")
  })

  it("should extract opinions correctly from a trace", () => {
    const trace = {
      councils: {
        risk: {
          memberOpinions: [
            { agentId: "fraud", recommendation: "BLOCK", confidence: 0.9, reasons: [], expectedOutcome: {}, dataQuality: 1, urgency: "medium" }
          ]
        },
        revenue: {
          memberOpinions: [
            { agentId: "revenue", recommendation: "ALLOW", confidence: 0.8, reasons: [], expectedOutcome: {}, dataQuality: 1, urgency: "medium" }
          ]
        }
      }
    }
    const opinions = extractOpinionsFromTrace(trace as any)
    expect(opinions.length).toBe(2)
    expect(opinions[0].agentId).toBe("fraud")
    expect(opinions[1].agentId).toBe("revenue")
  })

  it("should filter out non-actionable opinions like NOT_APPLICABLE", () => {
    const opinions: any[] = [
      { agentId: "fraud", recommendation: "BLOCK", confidence: 0.9, reasons: [], expectedOutcome: {}, dataQuality: 1, urgency: "medium" },
      { agentId: "revenue", recommendation: "NOT_APPLICABLE", confidence: 0.8, reasons: [], expectedOutcome: {}, dataQuality: 1, urgency: "medium" },
    ]
    const disagreements = detectDisagreements(opinions, 100, 500)
    expect(disagreements.length).toBe(0)
  })
})
