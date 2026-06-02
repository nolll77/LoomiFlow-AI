"use client"
import { useState } from "react"
import { LoadTestScenario, CommerceEvent } from "@/core/shared/types"
import { runLoadTest, LOAD_SCENARIOS } from "@/lib/loadTestSimulator"

const SCENARIO_CONFIG: Record<LoadTestScenario, { color: string; label: string }> = {
  LOW_FRAUD:      { color: "#2EE59D", label: "Low Fraud" },
  BURST:          { color: "#FF9F1C", label: "Burst" },
  FRAUD_STORM:    { color: "#FF3B3B", label: "🌩 FRAUD STORM" },
  LATENCY_ATTACK: { color: "#8B5CF6", label: "Latency Attack" },
  CHAOS_MIX:      { color: "#FF3B3B", label: "💥 CHAOS MIX" },
}

export default function LoadTestPanel({ onEvent, triggerScenario }: { onEvent: (e: Partial<CommerceEvent>) => void; triggerScenario: (s: string) => void }) {
  const [running, setRunning] = useState<LoadTestScenario | null>(null)
  const [report, setReport] = useState<any>(null)

  const trigger = async (scenario: LoadTestScenario) => {
    console.log("[LOAD TEST] Triggering:", scenario)
    setRunning(scenario)
    const result = await runLoadTest(scenario, (e) => onEvent(e as any), { cap: 30, delayMs: 100 })
    setReport(result)
    setRunning(null)
  }

  return (
    <div className="panel-glass rounded-2xl p-3 space-y-2">
      <div className="text-[11px] font-bold text-gray-300">SCENARIO SIMULATOR</div>

      {/* Demo scenarios */}
      <div className="space-y-1">
        <div className="text-[10px] text-gray-500 mb-1">DEMO SCENARIOS</div>
        {["cartAbandonment", "conversionAnomaly", "vipPaymentFailure"].map(s => (
          <button key={s} onClick={() => triggerScenario(s)}
            className="w-full text-left text-[10px] py-1.5 px-2 rounded border border-white/10 text-gray-400 hover:border-blue-400/40 hover:text-blue-300 transition-all">
            ▶ {s.replace(/([A-Z])/g, " $1").trim()}
          </button>
        ))}
      </div>

      {/* Load test buttons */}
      <div className="space-y-1">
        <div className="text-[10px] text-gray-500 mb-1">LOAD TEST</div>
        {(Object.keys(LOAD_SCENARIOS) as LoadTestScenario[]).map(s => {
          const cfg = SCENARIO_CONFIG[s]
          return (
            <button key={s} onClick={() => trigger(s)} disabled={running !== null}
              className="w-full text-[10px] py-1.5 px-2 rounded border transition-all disabled:opacity-40"
              style={{ borderColor: `${cfg.color}44`, color: cfg.color }}>
              {running === s ? "⏳ Running..." : `▶ ${cfg.label}`}
            </button>
          )
        })}
      </div>

      {report && (
        <div className="text-[10px] text-gray-500 border-t border-white/5 pt-2 space-y-0.5">
          <div>Events: {report.totalEvents} · Max fraud: {(report.maxFraudDetected * 100).toFixed(0)}%</div>
          <div>Stability: {report.systemStabilityScore}/100 · {report.rollbackTriggered ? "🚨 ROLLBACK" : "✅ stable"}</div>
        </div>
      )}
    </div>
  )
}
