// core/agents/arenaAgents.ts — Multi-agent adversarial arena
import { CommerceEvent } from "@/core/shared/types"

export type ArenaDecision = "BLOCK" | "ALLOW" | "THROTTLE" | "ROLLBACK" | "STEP_UP_AUTH"

export interface ArenaAgent {
  name: "fraud" | "sre" | "revenue"
  weight: number
  color: string
  score: (event: CommerceEvent, state?: any) => number
  vote: (event: CommerceEvent, state?: any) => ArenaDecision
}

export const ArenaFraudAgent: ArenaAgent = {
  name: "fraud",
  weight: 1.0,
  color: "#FF3B3B",
  score(event) {
    const s = event.fraudScore ?? 0
    const pp = event.paypalData?.fraudSignals
    return Math.min(1,
      s * 0.5 +
      (pp?.velocityAnomaly ? 0.2 : 0) +
      (pp?.deviceMismatch ? 0.15 : 0) +
      (pp?.geoInconsistency ? 0.15 : 0)
    )
  },
  vote(event) { return (event.fraudScore ?? 0) > 0.6 ? "BLOCK" : "THROTTLE" },
}

export const ArenaSREAgent: ArenaAgent = {
  name: "sre",
  weight: 0.8,
  color: "#4DA3FF",
  score(_, state) {
    return (state?.errorRate ?? 0) * 0.5 + Math.min(1, (state?.latencyMs ?? 0) / 3000) * 0.5
  },
  vote(_, state) {
    return (state?.errorRate ?? 0) > 0.05 ? "ROLLBACK" : "THROTTLE"
  },
}

export const ArenaRevenueAgent: ArenaAgent = {
  name: "revenue",
  weight: 0.6,
  color: "#2EE59D",
  score(event) {
    const value = event.value ?? 0
    const ctx = event.mcpContext
    const ltv = ctx?.ltv ?? 0
    return Math.min(1, (value / 500) * 0.4 + (ltv / 3000) * 0.6)
  },
  vote() { return "ALLOW" },
}
