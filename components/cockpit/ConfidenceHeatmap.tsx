"use client"
// components/cockpit/ConfidenceHeatmap.tsx
// Evolution B — Decision Confidence Heatmap
// Grid 20 colonnes × 3 lignes (councils) — couleur = f(confidence), ring = winner

import { useState } from "react"
import type { HeatmapRow } from "@/lib/confidenceHeatmap"

// ─── CONSTANTS ────────────────────────────────────────────────

const COUNCIL_COLORS: Record<"risk" | "revenue" | "customer", string> = {
  risk:     "#ef4444",
  revenue:  "#10b981",
  customer: "#3b82f6",
}

const COUNCIL_LABELS: Record<"risk" | "revenue" | "customer", string> = {
  risk:     "Risk",
  revenue:  "Rev.",
  customer: "Cust.",
}

const COUNCILS = ["risk", "revenue", "customer"] as const

// ─── DECISION COLOR ───────────────────────────────────────────

function decisionColor(d: string): string {
  if (d === "BLOCK")        return "text-red-400"
  if (d === "STEP_UP_AUTH") return "text-yellow-400"
  if (d === "ALLOW")        return "text-emerald-400"
  return "text-slate-500"
}

// ─── TOOLTIP ──────────────────────────────────────────────────

interface TooltipData {
  x: number
  y: number
  label: string
}

// ─── MAIN COMPONENT ───────────────────────────────────────────

interface Props {
  data: HeatmapRow[]
}

export function ConfidenceHeatmap({ data }: Props) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  const emptySlots = Math.max(0, MAX_COLS - data.length)

  return (
    <div className="panel-glass rounded-xl p-3 border border-slate-700 relative select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-slate-400 font-mono text-xs font-bold tracking-widest uppercase">
          Confidence Heatmap
        </h3>
        <span className="text-[10px] font-mono text-slate-600">
          {data.length}/{MAX_COLS} decisions
        </span>
      </div>

      {data.length === 0 ? (
        <p className="text-slate-600 text-xs font-mono py-3 text-center">
          Trigger events to populate the heatmap.
        </p>
      ) : (
        <div className="space-y-1">
          {/* Council rows */}
          {COUNCILS.map(council => (
            <div key={council} className="flex items-center gap-1.5">
              {/* Council label */}
              <span
                className="text-[10px] font-mono w-10 shrink-0 text-right"
                style={{ color: COUNCIL_COLORS[council] }}
              >
                {COUNCIL_LABELS[council]}
              </span>

              {/* Cells */}
              <div className="flex gap-[2px]">
                {data.map((row, i) => {
                  const conf     = row.councils[council]
                  const isWinner = row.winner === council
                  const opacity  = 0.12 + conf * 0.88   // min 12% even at conf=0

                  return (
                    <div
                      key={i}
                      className={`relative rounded-[2px] cursor-pointer transition-transform hover:scale-y-125 ${
                        isWinner ? "ring-1 ring-white/50 z-10" : ""
                      }`}
                      style={{
                        width:           "10px",
                        height:          "20px",
                        backgroundColor: COUNCIL_COLORS[council],
                        opacity,
                      }}
                      onMouseEnter={e => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setTooltip({
                          x:     rect.left + rect.width / 2,
                          y:     rect.top - 8,
                          label: `${row.decision} · ${COUNCIL_LABELS[council]} ${(conf * 100).toFixed(0)}%${isWinner ? " 🏆" : ""}`,
                        })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )
                })}

                {/* Empty slots (grey) */}
                {Array.from({ length: emptySlots }).map((_, i) => (
                  <div
                    key={`e-${i}`}
                    className="rounded-[2px] bg-slate-800/40"
                    style={{ width: "10px", height: "20px" }}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Decision initials row */}
          <div className="flex gap-[2px] ml-[3.25rem]">
            {data.map((row, i) => (
              <div
                key={i}
                className="flex items-center justify-center"
                style={{ width: "10px" }}
                title={row.decision}
              >
                <span
                  className={`font-mono font-bold ${decisionColor(row.decision)}`}
                  style={{ fontSize: "7px" }}
                >
                  {row.decision[0]}
                </span>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-800">
            <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">Legend</span>
            {COUNCILS.map(c => (
              <div key={c} className="flex items-center gap-1">
                <div
                  className="w-2 h-2 rounded-[1px]"
                  style={{ backgroundColor: COUNCIL_COLORS[c], opacity: 0.85 }}
                />
                <span className="text-[9px] font-mono text-slate-500">{COUNCIL_LABELS[c]}</span>
              </div>
            ))}
            <div className="flex items-center gap-1 ml-auto">
              <div className="w-2 h-2 rounded-[1px] ring-1 ring-white/50 bg-slate-600" />
              <span className="text-[9px] font-mono text-slate-500">Winner</span>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-200 pointer-events-none whitespace-nowrap shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  )
}

const MAX_COLS = 20
