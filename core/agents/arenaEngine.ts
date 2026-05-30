// core/agents/arenaEngine.ts
import { CommerceEvent } from "@/core/shared/types"
import { ArenaAgent, ArenaDecision, ArenaFraudAgent, ArenaSREAgent, ArenaRevenueAgent } from "./arenaAgents"

const agents: ArenaAgent[] = [ArenaFraudAgent, ArenaSREAgent, ArenaRevenueAgent]

export interface ArenaResult {
  finalDecision: ArenaDecision
  votes: { agent: string; score: number; vote: ArenaDecision; weight: number }[]
  consensus: number
  conflictDetected: boolean
  agentWeights: Record<string, number>
}

export function resolveArena(event: CommerceEvent, systemState?: any): ArenaResult {
  console.log("[ARENA] Resolving with", agents.length, "agents")

  const votes = agents.map(a => ({
    agent: a.name,
    score: a.score(event, systemState) * a.weight,
    vote: a.vote(event, systemState),
    weight: a.weight,
  }))

  const allVotes = votes.map(v => v.vote)
  const conflictDetected = new Set(allVotes).size > 1

  const totalWeight = votes.reduce((acc, v) => acc + v.score, 0)
  const consensus = totalWeight / votes.length

  let finalDecision: ArenaDecision
  if (consensus > 0.75) finalDecision = "BLOCK"
  else if (consensus > 0.55) finalDecision = "STEP_UP_AUTH"
  else if (consensus > 0.4) finalDecision = "THROTTLE"
  else finalDecision = "ALLOW"

  console.log("[ARENA] Consensus:", consensus.toFixed(2), "| Decision:", finalDecision, "| Conflict:", conflictDetected)
  return { finalDecision, votes, consensus, conflictDetected, agentWeights: { fraud: ArenaFraudAgent.weight, sre: ArenaSREAgent.weight, revenue: ArenaRevenueAgent.weight } }
}

export function computeArenaRewards(result: ArenaResult): Record<string, number> {
  return {
    fraud: result.finalDecision === "BLOCK" ? +1 : -0.5,
    sre: result.finalDecision === "ROLLBACK" ? +1 : -0.3,
    revenue: result.finalDecision === "ALLOW" ? +1 : -0.8,
  }
}

export function updateArenaWeights(rewards: Record<string, number>) {
  const clamp = (v: number) => Math.max(0.1, Math.min(2.0, v))
  ArenaFraudAgent.weight = clamp(ArenaFraudAgent.weight + (rewards.fraud ?? 0) * 0.01)
  ArenaSREAgent.weight = clamp(ArenaSREAgent.weight + (rewards.sre ?? 0) * 0.01)
  ArenaRevenueAgent.weight = clamp(ArenaRevenueAgent.weight + (rewards.revenue ?? 0) * 0.01)
  console.log("[ARENA] Updated weights:", { fraud: ArenaFraudAgent.weight.toFixed(3), sre: ArenaSREAgent.weight.toFixed(3), revenue: ArenaRevenueAgent.weight.toFixed(3) })
}
