// core/agents/growthAgents/helpers.ts
// Shared helper for growth agents

import type { AgentOpinion } from "@/core/shared/agentTypes"

export function nullOpinion(agentId: string, reason: string): AgentOpinion {
  return {
    agentId,
    recommendation: "NOT_APPLICABLE",
    confidence: 0,
    dataQuality: 0,
    reasoning: [reason],
    expectedOutcome: {},
    urgency: "low",
    requiredActions: [],
    dataQualityFlags: [reason],
  }
}
