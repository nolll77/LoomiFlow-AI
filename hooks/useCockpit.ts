// hooks/useCockpit.ts
"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { CockpitState, CommerceEvent, DecisionTrace, ConnectionMode } from "@/core/shared/types"
import { computeHeartbeat, getHeartbeatState } from "@/lib/heartbeat"
import type { HeatmapRow } from "@/lib/confidenceHeatmap"
import { computeCommercePulse } from "@/lib/commercePulse"
import type { CommercePulse } from "@/lib/commercePulse"
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080"
const MAX_EVENTS = 50
const RECONNECT_DELAY = 3000

export function useCockpit() {
  const [state, setState] = useState<CockpitState>({
    lastEvent: null, lastDecision: null, events: [],
    connected: false, connectionMode: "disconnected",
    systemMode: "normal", heartbeatState: "idle", heartbeatScore: 0,
  })
  const [heatmapRows, setHeatmapRows] = useState<HeatmapRow[]>([])
  const [pulse, setPulse] = useState<CommercePulse | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<NodeJS.Timeout>()

  const connect = useCallback(() => {
    if (typeof window === "undefined") return
    console.log("[COCKPIT] Connecting to WebSocket:", WS_URL)

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("[COCKPIT] WebSocket connected")
        setState(s => ({ ...s, connected: true, connectionMode: "websocket" as ConnectionMode }))
      }

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data)
          if (data.type === "COCKPIT_EVENT") {
            const { event, trace } = data.payload
            setState(s => {
              const events = [event, ...s.events].slice(0, MAX_EVENTS)
              const heartbeatScore = computeHeartbeat(events)
              return {
                ...s,
                lastEvent: event,
                lastDecision: trace,
                events,
                heartbeatScore,
                heartbeatState: getHeartbeatState(heartbeatScore),
                systemMode: heartbeatScore > 0.8 ? "fraud_spike" : heartbeatScore > 0.5 ? "high_load" : "normal",
              }
            })
          }
        } catch (e) { console.error("[COCKPIT] Parse error:", e) }
      }

      ws.onclose = () => {
        console.log("[COCKPIT] WebSocket disconnected — reconnecting in", RECONNECT_DELAY, "ms")
        setState(s => ({ ...s, connected: false, connectionMode: "disconnected" }))
        reconnectRef.current = setTimeout(connect, RECONNECT_DELAY)
      }

      ws.onerror = (err) => console.error("[COCKPIT] WS error:", err)
    } catch (e) {
      console.error("[COCKPIT] WebSocket init failed:", e)
      setState(s => ({ ...s, connectionMode: "disconnected" }))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
      clearTimeout(reconnectRef.current)
    }
  }, [connect])

  // Inject event directly (for demo simulate button)
  const injectEvent = useCallback((event: CommerceEvent, trace?: DecisionTrace) => {
    setState(s => {
      const events = [event, ...s.events].slice(0, MAX_EVENTS)
      const heartbeatScore = computeHeartbeat(events)
      return { ...s, lastEvent: event, lastDecision: trace ?? s.lastDecision, events, heartbeatScore, heartbeatState: getHeartbeatState(heartbeatScore) }
    })
    // Accumulate heatmap row if this trace has V4 council data
    if (trace) {
      const councils = (trace as any).councils as Record<string, { confidence: number }> | undefined
      const market   = (trace as any).marketDecision as { winningCouncil?: string } | undefined
      if (councils && market) {
        const row: HeatmapRow = {
          decisionId: trace.id,
          decision:   trace.finalDecision,
          ts:         trace.timestamp,
          councils: {
            risk:     councils.risk?.confidence     ?? 0,
            revenue:  councils.revenue?.confidence  ?? 0,
            customer: councils.customer?.confidence ?? 0,
          },
          winner: market.winningCouncil ?? "risk",
        }
        setHeatmapRows(prev => {
          const next = [...prev, row]
          return next.length > 20 ? next.slice(-20) : next
        })
      }
    }
    // Compute Commerce Pulse if commerceState is available
    if (trace) {
      const cs = (trace as any).commerceState as CommerceKnowledgeState | undefined
      if (cs) {
        // We need the current events list — read via functional updater trick
        setState(s => {
          try {
            const newPulse = computeCommercePulse(cs, s.events.map(() => trace).concat([trace]).slice(-10))
            setPulse(newPulse)
          } catch {}
          return s  // no state change, side-effect only
        })
      }
    }
  }, [])

  // Trigger a demo scenario using SSE (Streaming)
  const triggerScenario = useCallback(async (scenario: string) => {
    console.log("[COCKPIT] Triggering scenario (streaming):", scenario)
    try {
      const res = await fetch("/api/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario }) })
      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let traceEvent: any = null
      let partialTrace: any = { agents: {} }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value).split("\n")
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const msg = JSON.parse(line.slice(6))
            
            if (msg.type === "event_received") {
              traceEvent = { id: msg.eventId, type: "payment_failed", timestamp: msg.timestamp, customerId: "demo" }
              injectEvent(traceEvent, partialTrace)
            } else if (msg.type === "agent_complete") {
              partialTrace.agents = { ...partialTrace.agents, [msg.agent]: msg.result }
              injectEvent(traceEvent, { ...partialTrace })
            } else if (msg.type === "decision_final") {
              partialTrace.orchestrator = msg.decision
              partialTrace.finalDecision = msg.decision.finalDecision
              partialTrace.confidence = msg.confidence
              partialTrace.consensusWeights = msg.decision.consensusWeights
              injectEvent(traceEvent, { ...partialTrace })
            } else if (msg.type === "trace_complete") {
              injectEvent(traceEvent, msg.trace)
            }
          } catch(e) {}
        }
      }
    } catch (e) { console.error("[COCKPIT] Scenario trigger failed:", e) }
  }, [injectEvent])

  return { state, heatmapRows, pulse, injectEvent, triggerScenario }
}
