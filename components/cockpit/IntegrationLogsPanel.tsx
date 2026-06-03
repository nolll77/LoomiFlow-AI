"use client"
import { useEffect, useState, useRef } from "react"
import { DecisionTrace } from "@/core/shared/types"

interface LogLine {
  text: string
  type: "info" | "success" | "warn" | "error" | "mcp" | "paypal" | "crm"
  timestamp: string
}

export default function IntegrationLogsPanel({ decision }: { decision: DecisionTrace | null }) {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const timerRefs = useRef<NodeJS.Timeout[]>([])

  useEffect(() => {
    if (!decision) {
      setLogs([])
      return
    }

    // Clear previous timeouts
    timerRefs.current.forEach(t => clearTimeout(t))
    timerRefs.current = []
    setIsTyping(true)
    setLogs([])

    const generatedLines: LogLine[] = []
    const now = new Date()
    
    const timeStr = (offsetMs: number) => {
      const d = new Date(now.getTime() + offsetMs)
      return d.toTimeString().split(" ")[0]
    }

    // 1. Ingestion
    generatedLines.push({
      text: `[SYSTEM] Ingesting checkout transaction event (ID: ${decision.id.slice(0, 12)}...)`,
      type: "info",
      timestamp: timeStr(0)
    })

    // 2. MCP calls
    const tools = decision.mcpContextSources
    if (tools.length > 0) {
      generatedLines.push({
        text: `[MCP] Connecting to Loomi Connect MCP Server...`,
        type: "mcp",
        timestamp: timeStr(80)
      })
      tools.forEach((tool, idx) => {
        let details = ""
        if (tool === "get_customer_properties") details = "Sarah Mitchell (VIP, LTV €3200)"
        if (tool === "get_customer_prediction_score") details = "Churn propensity 0.82"
        if (tool === "list_customer_events") details = "14 historical checkouts analysed"
        if (tool === "execute_analytics") details = "Funnel anomaly detected (drop rate 0.34)"

        generatedLines.push({
          text: `[MCP] tool_call: ${tool} → OK (${details})`,
          type: "mcp",
          timestamp: timeStr(150 + idx * 80)
        })
      })
    }

    // 3. Agents & Councils
    generatedLines.push({
      text: `[ORCHESTRATOR] Multi-Agent Councils evaluating event contexts in parallel...`,
      type: "info",
      timestamp: timeStr(450)
    })

    const councils = decision.councils as any
    if (councils) {
      if (councils.risk) {
        generatedLines.push({
          text: `[COUNCIL] Risk Council proposes: ${councils.risk.recommendation} (Confidence: ${(councils.risk.confidence * 100).toFixed(0)}%)`,
          type: "warn",
          timestamp: timeStr(520)
        })
      }
      if (councils.revenue) {
        generatedLines.push({
          text: `[COUNCIL] Revenue Council proposes: ${councils.revenue.recommendation} (Confidence: ${(councils.revenue.confidence * 100).toFixed(0)}%)`,
          type: "success",
          timestamp: timeStr(580)
        })
      }
      if (councils.customer) {
        generatedLines.push({
          text: `[COUNCIL] Customer Council proposes: ${councils.customer.recommendation} (Confidence: ${(councils.customer.confidence * 100).toFixed(0)}%)`,
          type: "info",
          timestamp: timeStr(640)
        })
      }
    }

    // 4. Opinion Market Decision
    const winner = decision.marketDecision?.winningCouncil ?? "revenue"
    generatedLines.push({
      text: `[OPINION_MARKET] Conflict arbitrated: Consensus [${decision.marketDecision?.coalitionType || "SPLIT"}], Winner: ${winner.toUpperCase()} COUNCIL (Decision: ${decision.finalDecision})`,
      type: "success",
      timestamp: timeStr(750)
    })

    // 5. PayPal & Bloomreach CRM writes
    generatedLines.push({
      text: `[PAYPAL] Placing authorization hold on order... status: APPROVED`,
      type: "paypal",
      timestamp: timeStr(850)
    })

    generatedLines.push({
      text: `[BLOOMREACH] Executing Write API payload: updateCustomerProperty ('recovery_initiated' = true)`,
      type: "crm",
      timestamp: timeStr(950)
    })

    generatedLines.push({
      text: `[BLOOMREACH] Executing Write API payload: trackCustomerEvent ('recovery_campaign_triggered')`,
      type: "crm",
      timestamp: timeStr(1050)
    })

    // 6. Learning Agent recording
    generatedLines.push({
      text: `[LEARNING] Decision logged to rolling history window. Current threshold adjusted: 0.87.`,
      type: "info",
      timestamp: timeStr(1150)
    })

    // Animate lines one by one
    generatedLines.forEach((line, index) => {
      const timeout = setTimeout(() => {
        setLogs(prev => [...prev, line])
        if (index === generatedLines.length - 1) {
          setIsTyping(false)
        }
      }, index * 200)
      timerRefs.current.push(timeout)
    })

    return () => {
      timerRefs.current.forEach(t => clearTimeout(t))
    }
  }, [decision])

  return (
    <div className="panel-glass rounded-[28px] p-5 flex flex-col min-h-[300px] overflow-hidden border border-slate-800 bg-[#060814]/80">
      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 font-mono">Real-time Integration Logs</span>
        </div>
        <span className="text-[10px] text-slate-600 font-mono">
          {isTyping ? "● processing pipeline" : "✓ idle"}
        </span>
      </div>

      <div className="flex-1 font-mono text-[10px] space-y-2 overflow-y-auto max-h-[350px] pr-1 leading-relaxed">
        {logs.length === 0 && !isTyping ? (
          <div className="text-slate-600 text-center py-16">
            Awaiting system execution... Trigger a scenario to view real-time API integrations.
          </div>
        ) : (
          logs.map((log, idx) => {
            let color = "text-slate-400"
            if (log.type === "success") color = "text-emerald-400 font-semibold"
            if (log.type === "warn") color = "text-amber-400"
            if (log.type === "error") color = "text-red-400"
            if (log.type === "mcp") color = "text-purple-400"
            if (log.type === "paypal") color = "text-sky-400 font-semibold"
            if (log.type === "crm") color = "text-teal-400 font-semibold"

            return (
              <div key={idx} className="flex gap-2.5 border-b border-slate-900/50 pb-1.5 last:border-0">
                <span className="text-slate-600 shrink-0 font-light select-none">[{log.timestamp}]</span>
                <span className={`${color} break-words flex-1`}>{log.text}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
