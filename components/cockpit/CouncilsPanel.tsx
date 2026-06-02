"use client"
// components/cockpit/CouncilsPanel.tsx
// V4 — Remplace / complète l'AgentGrid : councils + opinion market

import type { DecisionTrace } from "@/core/shared/types"
import type { CouncilProposal } from "@/core/councils/types"
import type { MarketDecision }  from "@/core/orchestration/types"

// ─── TYPE HELPERS ─────────────────────────────────────────────

function asCouncil(v: unknown): CouncilProposal | null {
  return v && typeof v === "object" && "recommendation" in v ? v as CouncilProposal : null
}

function asMarket(v: unknown): MarketDecision | null {
  return v && typeof v === "object" && "utilityScores" in v ? v as MarketDecision : null
}

// ─── MINI-BADGE ───────────────────────────────────────────────

function RecBadge({ rec, active }: { rec: string; active?: boolean }) {
  const base = active
    ? "bg-yellow-900/40 border-yellow-400/60 text-yellow-300"
    : "bg-slate-900/60 border-slate-700/60 text-slate-400"
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${base}`}>
      {rec}
    </span>
  )
}

// ─── COUNCIL CARD ─────────────────────────────────────────────

type CouncilColor = "red" | "emerald" | "blue"

const COUNCIL_STYLES: Record<CouncilColor, { border: string; title: string; badge: string }> = {
  red:     { border: "border-red-500/20",     title: "text-red-400",     badge: "bg-red-900/30 text-red-400"     },
  emerald: { border: "border-emerald-500/20", title: "text-emerald-400", badge: "bg-emerald-900/30 text-emerald-400" },
  blue:    { border: "border-blue-500/20",    title: "text-blue-400",    badge: "bg-blue-900/30 text-blue-400"    },
}

function CouncilCard({
  label,
  data,
  color,
}: {
  label: string
  data: CouncilProposal
  color: CouncilColor
}) {
  const s = COUNCIL_STYLES[color]

  return (
    <div className={`panel-glass rounded-xl p-3 border ${s.border}`}>

      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h4 className={`${s.title} font-mono text-xs font-bold tracking-wider`}>{label}</h4>
        <span className={`text-xs font-mono px-2 py-0.5 rounded ${s.badge}`}>
          {data.recommendation}
        </span>
      </div>

      {/* Member opinions */}
      <div className="flex gap-1.5 flex-wrap mb-2">
        {data.memberOpinions.map(op => (
          <div key={op.agentId} className="text-xs font-mono bg-slate-900/70 rounded px-2 py-1 flex gap-1 items-center">
            <span className="text-slate-500">{op.agentId}:</span>
            <RecBadge rec={op.recommendation} />
            <span className="text-slate-500">({(op.confidence * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>

      {/* Metrics row */}
      <div className="flex gap-3 text-xs font-mono text-slate-500">
        <span>ROI: <span className="text-slate-300">€{data.businessImpact.totalROI.toFixed(0)}</span></span>
        <span>conf: <span className="text-slate-300">{(data.confidence * 100).toFixed(0)}%</span></span>
        <span>method: <span className="text-slate-300">{data.consensusMethod}</span></span>
      </div>

      {/* Proposed actions count */}
      {data.proposedActions.length > 0 && (
        <div className="mt-1.5 text-xs font-mono text-slate-600">
          {data.proposedActions.length} action{data.proposedActions.length > 1 ? "s" : ""} proposed
          {data.proposedActions.some(a => a.rollbackable) ? " · rollbackable" : ""}
        </div>
      )}
    </div>
  )
}

// ─── OPINION MARKET SUMMARY ───────────────────────────────────

function OpinionMarketCard({ market }: { market: MarketDecision }) {
  const entries = Object.entries(market.utilityScores).sort((a, b) => b[1] - a[1])

  return (
    <div className="panel-glass rounded-xl p-3 border border-yellow-500/30">
      <h3 className="text-yellow-400 font-mono text-xs font-bold mb-2 tracking-widest">
        OPINION MARKET
      </h3>

      <div className="grid grid-cols-3 gap-2 mb-2">
        {entries.map(([council, score]) => {
          const isWinner = market.winningCouncil === council
          return (
            <div
              key={council}
              className={`text-center p-2 rounded border transition-colors ${
                isWinner
                  ? "border-yellow-400/60 bg-yellow-900/30"
                  : "border-slate-700/60 bg-slate-900/50"
              }`}
            >
              <div className="text-xs font-mono text-slate-400 uppercase mb-0.5">{council}</div>
              <div className={`text-base font-bold font-mono ${isWinner ? "text-yellow-300" : "text-slate-500"}`}>
                {score.toFixed(3)}
              </div>
              {isWinner && (
                <div className="text-xs text-yellow-400 mt-0.5">WINNER 🏆</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Utility bar */}
      {entries.length > 0 && (() => {
        const maxScore = Math.max(...entries.map(([, s]) => Math.abs(s)), 0.001)
        return (
          <div className="flex h-1 gap-0.5 mb-2">
            {entries.map(([council, score]) => {
              const pct = (Math.max(score, 0) / maxScore) * 100
              const color = council === "risk" ? "bg-red-500/60" : council === "revenue" ? "bg-emerald-500/60" : "bg-blue-500/60"
              return <div key={council} className={`rounded-full ${color}`} style={{ width: `${pct}%` }} />
            })}
          </div>
        )
      })()}

      <p className="text-slate-400 text-xs font-mono leading-relaxed italic">
        {market.marketNarrative}
      </p>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────

export function CouncilsPanel({ trace }: { trace: DecisionTrace | null }) {
  if (!trace?.councils) return null

  const risk     = asCouncil(trace.councils["risk"])
  const revenue  = asCouncil(trace.councils["revenue"])
  const customer = asCouncil(trace.councils["customer"])
  const market   = asMarket(trace.marketDecision)

  if (!risk || !revenue || !customer || !market) return null

  return (
    <div className="space-y-3">

      {/* Opinion Market */}
      <OpinionMarketCard market={market} />

      {/* Individual Councils */}
      <CouncilCard label="RISK COUNCIL"     data={risk}     color="red"     />
      <CouncilCard label="REVENUE COUNCIL"  data={revenue}  color="emerald" />
      <CouncilCard label="CUSTOMER COUNCIL" data={customer} color="blue"    />
    </div>
  )
}
