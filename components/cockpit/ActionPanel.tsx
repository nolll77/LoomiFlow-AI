"use client"
import { useState } from "react"
import { DecisionTrace, CommerceEvent } from "@/core/shared/types"

const DECISION_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  BLOCK:        { color: "#ef4444", icon: "🚫", label: "BLOCKED" },
  ALLOW:        { color: "#10b981", icon: "✅", label: "ALLOWED" },
  HOLD:         { color: "#f59e0b", icon: "⏸", label: "HELD" },
  STEP_UP_AUTH: { color: "#3b82f6", icon: "🔐", label: "STEP-UP AUTH" },
  THROTTLE:     { color: "#8b5cf6", icon: "🔄", label: "THROTTLED" },
}

export default function ActionPanel({ decision, event }: { decision: DecisionTrace | null; event: CommerceEvent | null }) {
  const [feedbackState, setFeedbackState] = useState<"idle" | "submitting" | "success">("idle")

  if (!decision) return (
    <div className="panel-glass rounded-[28px] p-5 text-center opacity-70">
      <span className="text-sm text-slate-500">Aucune décision disponible</span>
    </div>
  )

  const o = decision.orchestrator
  const cfg = DECISION_CONFIG[o.finalDecision] ?? DECISION_CONFIG["HOLD"]

  const submitFeedback = async (forcedDecision: string) => {
    setFeedbackState("submitting")
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          traceId: decision.id,
          originalDecision: o.finalDecision,
          forcedDecision,
          operatorId: "demo_judge",
        })
      })
      setFeedbackState("success")
      setTimeout(() => setFeedbackState("idle"), 3000)
    } catch (e) {
      console.error(e)
      setFeedbackState("idle")
    }
  }

  return (
    <div className="panel-glass rounded-[28px] p-5 space-y-5">
      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Action panel</div>

      <div className="rounded-[24px] border px-5 py-5" style={{ borderColor: `${cfg.color}20`, background: `${cfg.color}0f` }}>
        <div className="text-3xl font-semibold text-slate-900">{cfg.icon}</div>
        <div className="mt-3 text-xl font-semibold" style={{ color: cfg.color }}>{cfg.label}</div>
        <div className="mt-2 text-sm text-slate-600">
          {(o.confidence * 100).toFixed(0)}% confidence · {o.severity} severity
        </div>
      </div>

      {o.customerMessage && (
        <div className="rounded-[20px] border border-sky-200/70 bg-sky-50/80 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 mb-2">Message client</div>
          <div className="text-sm text-slate-600 leading-6">{o.customerMessage}</div>
        </div>
      )}

      {decision.writeActions && decision.writeActions.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Bloomreach writes</div>
          {decision.writeActions.map((a, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-slate-600">
              <span className={a.status === "success" ? "text-emerald-600" : a.status === "failed" ? "text-red-600" : "text-amber-600"}>
                {a.status === "success" ? "✓" : a.status === "failed" ? "✗" : "⏳"}
              </span>
              <span className="font-medium">{a.type.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      )}

      {decision.mcpContextSources.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-2">MCP intelligence</div>
          <div className="flex flex-wrap gap-2">
            {decision.mcpContextSources.map(t => (
              <span key={t} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700">{t.replace("get_", "").replace(/_/g, " ")}</span>
            ))}
          </div>
        </div>
      )}

      {/* FEEDBACK LOOP */}
      <div className="pt-4 border-t border-slate-200/50">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-3">AI Correction</div>
        
        {feedbackState === "success" ? (
          <div className="rounded-xl border border-green-200/60 bg-green-50/50 p-3 text-center text-sm font-medium text-green-600">
            ✓ Feedback enregistré pour l'entraînement
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button 
              disabled={feedbackState === "submitting" || o.finalDecision === "ALLOW"}
              onClick={() => submitFeedback("ALLOW")}
              className="rounded-xl border border-emerald-200/50 bg-emerald-50/30 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Force ALLOW
            </button>
            <button 
              disabled={feedbackState === "submitting" || o.finalDecision === "BLOCK"}
              onClick={() => submitFeedback("BLOCK")}
              className="rounded-xl border border-rose-200/50 bg-rose-50/30 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Force BLOCK
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
