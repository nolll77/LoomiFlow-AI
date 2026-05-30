// hooks/useCockpit.ts
"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { CockpitState, CommerceEvent, DecisionTrace, ConnectionMode } from "@/core/shared/types"
import { computeHeartbeat, getHeartbeatState } from "@/lib/heartbeat"

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080"
const MAX_EVENTS = 50
const RECONNECT_DELAY = 3000

export function useCockpit() {
  const [state, setState] = useState<CockpitState>({
    lastEvent: null, lastDecision: null, events: [],
    connected: false, connectionMode: "disconnected",
    systemMode: "normal", heartbeatState: "idle", heartbeatScore: 0,
  })
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
  }, [])

  // Trigger a demo scenario
  const triggerScenario = useCallback(async (scenario: string) => {
    console.log("[COCKPIT] Triggering scenario:", scenario)
    try {
      const res = await fetch("/api/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario }) })
      const data = await res.json()
      if (data.trace) injectEvent(data.trace.agents ? { id: data.trace.transactionId, type: "payment_failed", timestamp: data.trace.timestamp, customerId: "demo" } : { id: "demo", type: "payment_failed", timestamp: Date.now(), customerId: "demo" }, data.trace)
    } catch (e) { console.error("[COCKPIT] Scenario trigger failed:", e) }
  }, [injectEvent])

  return { state, injectEvent, triggerScenario }
}
