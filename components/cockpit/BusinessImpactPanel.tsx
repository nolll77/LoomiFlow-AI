"use client"
// components/cockpit/BusinessImpactPanel.tsx
// V4 — La pièce maîtresse de la démo : décision → argent sauvé
// Évolution A : Commerce Narrative Engine — news ticker en haut du panel

import { useEffect, useRef, useState } from "react"
import type { BusinessImpactSummary } from "@/core/orchestration/types"

interface Props {
  impact:          BusinessImpactSummary
  executiveSummary: string
  decision:        string
  councilWinner:   string
  /** Narrative générée par narrativeEngine.ts — optionnel pour compat */
  narrative?:      string
}

// ─── KPI CARD ─────────────────────────────────────────────────

type KpiColor = "red" | "yellow" | "emerald" | "blue" | "purple" | "slate"

const KPI_COLORS: Record<KpiColor, string> = {
  red:     "border-red-500/30 bg-red-900/20 text-red-400",
  yellow:  "border-yellow-500/30 bg-yellow-900/20 text-yellow-400",
  emerald: "border-emerald-500/30 bg-emerald-900/20 text-emerald-400",
  blue:    "border-blue-500/30 bg-blue-900/20 text-blue-400",
  purple:  "border-purple-500/30 bg-purple-900/20 text-purple-400",
  slate:   "border-slate-500/30 bg-slate-800/50 text-slate-400",
}

function KpiCard({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: string
  color: KpiColor
  icon:  string
}) {
  return (
    <div className={`border rounded p-2 ${KPI_COLORS[color]}`}>
      <div className="text-xs font-mono opacity-70">{icon} {label}</div>
      <div className="text-sm font-bold font-mono">{value}</div>
    </div>
  )
}

// ─── DECISION BADGE ───────────────────────────────────────────

function decisionBadgeClass(decision: string): string {
  if (decision === "BLOCK")        return "bg-red-900/50 text-red-400 border border-red-500/30"
  if (decision === "STEP_UP_AUTH") return "bg-yellow-900/50 text-yellow-400 border border-yellow-500/30"
  if (decision === "HOLD")         return "bg-orange-900/50 text-orange-400 border border-orange-500/30"
  return "bg-emerald-900/50 text-emerald-400 border border-emerald-500/30"
}

// ─── NARRATIVE TICKER ─────────────────────────────────────────
// Affiche le texte lettre par lettre, façon terminal qui "tape"
// Puis scroll horizontalement en boucle si le texte dépasse.

function NarrativeTicker({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone]           = useState(false)
  const prevText                  = useRef("")
  const intervalRef               = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (text === prevText.current) return
    prevText.current = text
    setDisplayed("")
    setDone(false)

    let i = 0
    if (intervalRef.current) clearInterval(intervalRef.current)

    intervalRef.current = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        setDone(true)
        clearInterval(intervalRef.current!)
      }
    }, 18)  // ~18ms par caractère ≈ 55 chars/s — lisible en démo

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [text])

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-emerald-500/40 bg-black/60 px-3 py-2"
      style={{ minHeight: "3rem" }}
    >
      {/* Glow line on top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

      {/* Label */}
      <div className="mb-1 flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-emerald-500 uppercase">
          Commerce Narrative
        </span>
      </div>

      {/* Typewriter text */}
      <p className="font-mono text-xs leading-relaxed text-emerald-100">
        {displayed}
        {/* Blinking cursor while typing */}
        {!done && (
          <span className="ml-0.5 inline-block w-[7px] h-[13px] align-text-bottom bg-emerald-400 animate-[blink_0.7s_step-end_infinite]" />
        )}
      </p>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────

export function BusinessImpactPanel({
  impact,
  executiveSummary,
  decision,
  councilWinner,
  narrative,
}: Props) {
  const totalPositive =
    impact.fraudPrevented + impact.revenueProtected + impact.revenueGained

  // ROI bar segments (% of totalPositive)
  const fraudPct = totalPositive > 0 ? (impact.fraudPrevented   / totalPositive) * 100 : 0
  const protPct  = totalPositive > 0 ? (impact.revenueProtected / totalPositive) * 100 : 0
  const gainPct  = totalPositive > 0 ? (impact.revenueGained    / totalPositive) * 100 : 0

  // Use narrative if provided, otherwise fall back to executiveSummary
  const tickerText = narrative ?? executiveSummary

  return (
    <div className="panel-glass border border-emerald-500/30 rounded-xl p-4 flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-emerald-400 font-mono text-sm font-bold tracking-widest uppercase">
          Business Impact
        </h3>
        <span className={`text-xs font-mono px-2 py-0.5 rounded ${decisionBadgeClass(decision)}`}>
          {decision} — {councilWinner.toUpperCase()} COUNCIL
        </span>
      </div>

      {/* Commerce Narrative Ticker — LE MOMENT QUI FAIT DÉCROCHER LES MÂCHOIRES */}
      {tickerText && <NarrativeTicker text={tickerText} />}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2">
        {impact.fraudPrevented > 0 && (
          <KpiCard
            label="Fraud Prevented"
            value={`€${impact.fraudPrevented.toFixed(0)}`}
            color="red"
            icon="🛡️"
          />
        )}
        {impact.revenueProtected > 0 && (
          <KpiCard
            label="Revenue Protected"
            value={`€${impact.revenueProtected.toFixed(0)}`}
            color="yellow"
            icon="🔒"
          />
        )}
        {impact.revenueGained > 0 && (
          <KpiCard
            label="Revenue Recovered"
            value={`€${impact.revenueGained.toFixed(0)}`}
            color="emerald"
            icon="💰"
          />
        )}
        {impact.retentionGain > 0 && (
          <KpiCard
            label="Retention Gain"
            value={`+${(impact.retentionGain * 100).toFixed(0)}%`}
            color="blue"
            icon="❤️"
          />
        )}
        {impact.conversionUplift > 0 && (
          <KpiCard
            label="Conversion Uplift"
            value={`+${(impact.conversionUplift * 100).toFixed(0)}%`}
            color="purple"
            icon="📈"
          />
        )}
        <KpiCard
          label="Decision Cost"
          value={`$${impact.costOfDecision.toFixed(4)}`}
          color="slate"
          icon="⚡"
        />
      </div>

      {/* ROI stacked bar */}
      {totalPositive > 0 && (
        <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
          {fraudPct > 0 && (
            <div className="bg-red-500/70 rounded-full" style={{ width: `${fraudPct}%` }} title={`Fraud: €${impact.fraudPrevented.toFixed(0)}`} />
          )}
          {protPct > 0 && (
            <div className="bg-yellow-500/70 rounded-full" style={{ width: `${protPct}%` }} title={`Protected: €${impact.revenueProtected.toFixed(0)}`} />
          )}
          {gainPct > 0 && (
            <div className="bg-emerald-500/70 rounded-full" style={{ width: `${gainPct}%` }} title={`Gained: €${impact.revenueGained.toFixed(0)}`} />
          )}
        </div>
      )}

      {/* Total ROI + Multiple */}
      <div className="border-t border-emerald-500/20 pt-2 flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-xs font-mono">TOTAL ROI</span>
          <span className="text-emerald-400 text-lg font-bold font-mono">
            €{impact.totalROI.toFixed(0)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500 text-xs font-mono">ROI Multiple</span>
          <span className={`text-sm font-mono font-bold ${
            impact.roiMultiple > 500 ? "text-emerald-300" :
            impact.roiMultiple > 100 ? "text-emerald-400" : "text-slate-400"
          }`}>
            {impact.roiMultiple > 9999 ? ">9999x" : `${impact.roiMultiple.toFixed(0)}x`}
          </span>
        </div>
      </div>
    </div>
  )
}
