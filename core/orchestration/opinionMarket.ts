// core/orchestration/opinionMarket.ts
// V4 — Cœur de la différenciation : arbitrage utility-based entre Councils

import type { CommerceKnowledgeState } from "@/core/shared/commerceState"
import type { CouncilProposal }        from "@/core/councils/types"
import type { MarketDecision }         from "./types"
import { buildExecutionPlan }          from "./executionPlan"

// ─── COUNCIL BUDGETS ──────────────────────────────────────────

interface CouncilBudget {
  council: "risk" | "revenue" | "customer" | "intelligence"
  baseWeight: number
  performanceMultiplier: number  // ajusté par Learning Agent en session
}

const COUNCIL_BUDGETS: CouncilBudget[] = [
  { council: "risk",         baseWeight: 0.45, performanceMultiplier: 1.0 },
  { council: "revenue",      baseWeight: 0.30, performanceMultiplier: 1.0 },
  { council: "customer",     baseWeight: 0.20, performanceMultiplier: 1.0 },
  { council: "intelligence", baseWeight: 0.05, performanceMultiplier: 1.0 },
]

// In-session Learning Agent will call this to update multipliers
export function adjustCouncilBudget(
  council: CouncilBudget["council"],
  performanceMultiplier: number
) {
  const b = COUNCIL_BUDGETS.find(b => b.council === council)
  if (b) b.performanceMultiplier = Math.max(0.5, Math.min(2.0, performanceMultiplier))
}

/** Nudge a council's baseWeight by delta — used by Learning Agent */
export function adjustCouncilWeight(
  council: CouncilBudget["council"],
  delta: number
): void {
  const b = COUNCIL_BUDGETS.find(b => b.council === council)
  if (b) b.baseWeight = Math.max(0.05, Math.min(0.70, b.baseWeight + delta))
}

/** Returns current effective weights for Learning Agent reporting */
export function getCurrentCouncilWeights(): Record<string, number> {
  return Object.fromEntries(
    COUNCIL_BUDGETS.map(b => [b.council, b.baseWeight * b.performanceMultiplier])
  )
}

function getAdjustedBudgets(): CouncilBudget[] {
  return COUNCIL_BUDGETS
}

// ─── UTILITY FUNCTION ─────────────────────────────────────────

const GAIN_WEIGHT       = 0.4
const RISK_WEIGHT       = 0.4
const CONFIDENCE_WEIGHT = 0.2

function computeUtility(proposal: CouncilProposal, budget: CouncilBudget): number {
  const gain = proposal.businessImpact.totalROI / 1000  // normalisé sur €1000
  const risk =
    proposal.recommendation === "BLOCK"         ? 0.8 :
    proposal.recommendation === "STEP_UP_AUTH"  ? 0.3 : 0.1
  const conf = proposal.confidence

  return budget.baseWeight * budget.performanceMultiplier * (
    GAIN_WEIGHT * gain - RISK_WEIGHT * risk + CONFIDENCE_WEIGHT * conf
  )
}

// ─── NARRATIVE BUILDER ────────────────────────────────────────

function buildMarketNarrative(
  winner: string,
  scores: Record<string, number>,
  proposal: CouncilProposal
): string {
  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([c, s]) => `${c}: ${s.toFixed(3)}`)
    .join(" | ")

  return (
    `${winner.toUpperCase()} Council wins with utility ${scores[winner]?.toFixed(3)}. ` +
    `Decision: ${proposal.recommendation} (confidence: ${(proposal.confidence * 100).toFixed(0)}%). ` +
    `Market scores — ${sorted}.`
  )
}

// ─── MAIN ENTRY POINT ─────────────────────────────────────────

export function runOpinionMarket(
  riskProposal:     CouncilProposal,
  revenueProposal:  CouncilProposal,
  customerProposal: CouncilProposal,
  state:            CommerceKnowledgeState
): MarketDecision {
  const budgets = getAdjustedBudgets()

  const utilityScores: Record<string, number> = {
    risk:     computeUtility(riskProposal,     budgets.find(b => b.council === "risk")!),
    revenue:  computeUtility(revenueProposal,  budgets.find(b => b.council === "revenue")!),
    customer: computeUtility(customerProposal, budgets.find(b => b.council === "customer")!),
  }

  // ── VETO absolu : Risk Council BLOCK avec conf > 0.85 ──────
  if (
    riskProposal.recommendation === "BLOCK" &&
    riskProposal.confidence > 0.85
  ) {
    return {
      winningCouncil:  "risk",
      finalDecision:   "BLOCK",
      utilityScores,
      confidence:      riskProposal.confidence,
      executionPlan:   buildExecutionPlan("BLOCK", riskProposal, revenueProposal, customerProposal, state),
      marketNarrative: `Risk Council VETO: fraud confidence ${(riskProposal.confidence * 100).toFixed(0)}% exceeds threshold. Override active.`,
    }
  }

  // ── Winning council par utilité ────────────────────────────
  const [winnerKey] = Object.entries(utilityScores).sort((a, b) => b[1] - a[1])[0]

  const winningProposal =
    winnerKey === "risk"     ? riskProposal     :
    winnerKey === "revenue"  ? revenueProposal  : customerProposal

  return {
    winningCouncil:  winnerKey,
    finalDecision:   winningProposal.recommendation,
    utilityScores,
    confidence:      winningProposal.confidence,
    executionPlan:   buildExecutionPlan(
      winningProposal.recommendation,
      riskProposal, revenueProposal, customerProposal, state
    ),
    marketNarrative: buildMarketNarrative(winnerKey, utilityScores, winningProposal),
  }
}
