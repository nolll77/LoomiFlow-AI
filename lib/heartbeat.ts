// lib/heartbeat.ts
import { HeartbeatState } from "@/core/shared/types"

export function computeHeartbeat(events: any[]): number {
  const now = Date.now()
  const recent = events.filter(e => e && typeof e.timestamp === "number" && now - e.timestamp < 10_000)
  const score =
    recent.length +
    recent.filter(e => (e.fraudScore ?? 0) > 0.6 || e.lastDecision?.severity === "high").length * 2 +
    recent.filter(e => (e.fraudScore ?? 0) > 0.8 || e.lastDecision?.severity === "critical").length * 4
  return Math.min(score / 10, 1)
}

export function getHeartbeatState(h: number): HeartbeatState {
  if (h < 0.2) return "idle"
  if (h < 0.5) return "active"
  if (h < 0.8) return "busy"
  return "critical"
}

export const HEARTBEAT_COLORS: Record<HeartbeatState, string> = {
  idle:     "rgba(99, 102, 241, 0.05)",
  active:   "rgba(99, 102, 241, 0.12)",
  busy:     "rgba(139, 92, 246, 0.20)",
  critical: "rgba(239, 68, 68, 0.18)",
}
