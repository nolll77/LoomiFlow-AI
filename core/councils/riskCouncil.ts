// core/councils/riskCouncil.ts
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"
import type { CouncilProposal } from "./types"
import { buildCouncilProposal } from "./helpers"
import { fraudAgent } from "@/core/agents/fraudAgent"
import { revenueAgent } from "@/core/agents/revenueAgent"
import { cxAgent } from "@/core/agents/cxAgent"

export async function riskCouncil(state: CommerceKnowledgeState): Promise<CouncilProposal> {
  const [fraudOp, revenueOp, cxOp] = await Promise.all([
    fraudAgent(state),
    revenueAgent(state),
    cxAgent(state),
  ])

  // Poids dynamiques selon dataQuality × confidence (Agent Confidence Decay V3)
  const rawWeights = {
    fraud:   0.62 * fraudOp.dataQuality   * fraudOp.confidence,
    revenue: 0.23 * revenueOp.dataQuality * revenueOp.confidence,
    cx:      0.15 * cxOp.dataQuality      * cxOp.confidence,
  }
  const total = rawWeights.fraud + rawWeights.revenue + rawWeights.cx || 1
  const w = {
    fraud:   rawWeights.fraud   / total,
    revenue: rawWeights.revenue / total,
    cx:      rawWeights.cx      / total,
  }

  // VETO : fraud BLOCK avec confiance > 0.85 s'impose
  if (fraudOp.recommendation === "BLOCK" && fraudOp.confidence > 0.85) {
    return buildCouncilProposal("risk", "BLOCK", [fraudOp, revenueOp, cxOp], w, "veto")
  }

  // Consensus pondéré
  const scores: Record<string, number> = {}
  for (const { rec, weight } of [
    { rec: fraudOp.recommendation,   weight: w.fraud   },
    { rec: revenueOp.recommendation, weight: w.revenue },
    { rec: cxOp.recommendation,      weight: w.cx      },
  ]) {
    scores[rec] = (scores[rec] ?? 0) + weight
  }
  const winningRec = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]

  // Safety override : BLOCK / STEP_UP_AUTH si un agent le porte avec poids > 0.4
  const safetyOverride = ["BLOCK", "STEP_UP_AUTH"].find(d =>
    [
      { rec: fraudOp.recommendation, weight: w.fraud },
      { rec: revenueOp.recommendation, weight: w.revenue },
    ].some(r => r.rec === d && r.weight > 0.4)
  )

  return buildCouncilProposal(
    "risk",
    safetyOverride ?? winningRec,
    [fraudOp, revenueOp, cxOp],
    { fraud: w.fraud, revenue: w.revenue, cx: w.cx },
    "weighted_avg"
  )
}
