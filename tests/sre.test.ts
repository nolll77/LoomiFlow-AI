import { describe, it, expect } from "vitest"
import { evaluateRollback, getCanaryPhase } from "@/core/sre/rollback"
import { computeTrafficSplit, routeRequest, mcpTrafficController, getFraudSpikeScenario, getTrafficVisualConfig } from "@/core/sre/trafficController"

describe("Rollback SRE Logic", () => {
  it("should trigger critical rollback if error rate > 5%", () => {
    const res = evaluateRollback({ errorRate: 0.08, latencyP95Ms: 150, fraudRate: 0.1, availabilityPct: 99.9 })
    expect(res.shouldRollback).toBe(true)
    expect(res.severity).toBe("critical")
    expect(res.actions).toContain("Stop canary promotion")
  })

  it("should trigger critical rollback if fraud rate > 80%", () => {
    const res = evaluateRollback({ errorRate: 0.01, latencyP95Ms: 200, fraudRate: 0.85, availabilityPct: 99.8 })
    expect(res.shouldRollback).toBe(true)
    expect(res.severity).toBe("critical")
    expect(res.actions).toContain("Activate fraud storm mode")
  })

  it("should output warning for high latency", () => {
    const res = evaluateRollback({ errorRate: 0.01, latencyP95Ms: 2500, fraudRate: 0.1, availabilityPct: 99.8 })
    expect(res.shouldRollback).toBe(false)
    expect(res.severity).toBe("warning")
    expect(res.actions).toContain("Throttle canary traffic")
  })

  it("should output warning for low availability", () => {
    const res = evaluateRollback({ errorRate: 0.01, latencyP95Ms: 200, fraudRate: 0.1, availabilityPct: 99.2 })
    expect(res.shouldRollback).toBe(false)
    expect(res.severity).toBe("warning")
    expect(res.actions).toContain("Reduce canary load")
  })

  it("should return correct canary phase names", () => {
    expect(getCanaryPhase({ prod: 0.96, canary: 0.02 })).toBe("IDLE")
    expect(getCanaryPhase({ prod: 0.90, canary: 0.08 })).toBe("OBSERVE (5%)")
    expect(getCanaryPhase({ prod: 0.75, canary: 0.20 })).toBe("EXPAND (25%)")
    expect(getCanaryPhase({ prod: 0.45, canary: 0.50 })).toBe("SCALING (50%)")
    expect(getCanaryPhase({ prod: 0.10, canary: 0.85 })).toBe("INCIDENT MODE")
  })
})

describe("Traffic Controller SRE Logic", () => {
  it("should compute splits depending on risk", () => {
    const split = computeTrafficSplit({ fraudScore: 0.1, errorRate: 0.01, latencyMs: 200, revenueImpact: 100 })
    expect(split.prod).toBeGreaterThan(0.5)
    expect(split.canary + split.prod + split.shadow).toBeCloseTo(1, 2)
  })

  it("should route requests stochastically", () => {
    const split = { prod: 0.6, canary: 0.3, shadow: 0.1 }
    const routes = new Array(100).fill(0).map(() => routeRequest(split))
    expect(routes.includes("PROD")).toBe(true)
  })

  it("should adjust split based on MCP controller inputs", () => {
    const { split, riskScore, reasoning } = mcpTrafficController({ fraudScore: 0.95, errorRate: 0.1, anomalyScore: 0.1, geoRisk: true })
    expect(riskScore).toBeGreaterThan(0.5)
    expect(split.prod).toBeLessThan(0.5)
    expect(reasoning.length).toBeGreaterThan(0)
  })

  it("should load the fraud spike preset scenario", () => {
    const split = getFraudSpikeScenario()
    expect(split.prod).toBeLessThan(0.4)
  })

  it("should yield visual config parameters", () => {
    const visual = getTrafficVisualConfig({ prod: 0.2, canary: 0.6, shadow: 0.2 })
    expect(visual.alertLevel).toBe("critical")
    expect(visual.prodColor).toBe("#FF9F1C")
    expect(visual.canaryColor).toBe("#FF3B3B")
  })
})
