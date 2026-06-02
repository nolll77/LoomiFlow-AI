"use client"
// components/cockpit/LearningPanel.tsx

import type { LearningInsights } from "@/core/agents/learningAgent"

export function LearningPanel({ insights }: { insights: LearningInsights }) {
  if (!insights.ready) {
    return (
      <div className="panel-glass rounded-xl p-3 border border-slate-700">
        <h3 className="text-slate-500 font-mono text-xs">LEARNING AGENT</h3>
        <p className="text-slate-600 text-xs mt-1 font-mono">
          Collecting data... ({insights.sessionSize ?? 0}/8 decisions needed)
        </p>
      </div>
    )
  }

  const decisionDist = insights.decisionDistribution ?? {}
  const total = Object.values(decisionDist).reduce((a, b) => a + b, 0)

  return (
    <div className="panel-glass rounded-xl p-3 border border-violet-500/30">

      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-violet-400 font-mono text-xs font-bold">LEARNING AGENT</h3>
        {insights.adaptationActive && (
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-violet-900/30 text-violet-400 animate-pulse">
            ⚡ ADAPTING
          </span>
        )}
      </div>

      {/* Trend */}
      <div className={`text-xs font-mono mb-2 ${
        insights.trend === "FRAUD_ESCALATING"  ? "text-red-400"     :
        insights.trend === "FRAUD_NORMALIZING" ? "text-emerald-400" : "text-slate-400"
      }`}>
        Trend: {insights.trend} | Session: {insights.sessionSize} decisions
      </div>

      {/* Decision Distribution */}
      <div className="space-y-1 mb-2">
        {Object.entries(decisionDist).map(([dec, count]) => {
          const pct = total > 0 ? ((count / total) * 100).toFixed(0) : "0"
          return (
            <div key={dec} className="flex items-center gap-2">
              <span className="text-slate-500 text-xs font-mono w-28">{dec}</span>
              <div className="flex-1 bg-slate-800 rounded h-1.5">
                <div
                  className="h-1.5 rounded bg-violet-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-slate-400 text-xs font-mono w-8">{pct}%</span>
            </div>
          )
        })}
      </div>

      {/* Adaptive Thresholds */}
      <div className="border-t border-slate-700 pt-2 space-y-1">
        <div className="text-xs font-mono text-slate-500">Adaptive Thresholds:</div>
        <div className="flex gap-3 flex-wrap">
          <span className="text-xs font-mono text-slate-400">
            block: <span className="text-yellow-400">{insights.currentThresholds?.fraudBlockThreshold?.toFixed(2)}</span>
          </span>
          <span className="text-xs font-mono text-slate-400">
            step: <span className="text-yellow-400">{insights.currentThresholds?.fraudStepThreshold?.toFixed(2)}</span>
          </span>
          <span className="text-xs font-mono text-slate-400">
            dominant: <span className="text-violet-400">{insights.mostActiveCouncil}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
