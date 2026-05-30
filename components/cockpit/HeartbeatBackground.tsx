"use client"
import { HeartbeatState } from "@/core/shared/types"
import { HEARTBEAT_COLORS } from "@/lib/heartbeat"

export default function HeartbeatBackground({ score, state }: { score: number; state: HeartbeatState }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 transition-all duration-1000"
      style={{
        background: `radial-gradient(ellipse at center, ${HEARTBEAT_COLORS[state]} 0%, transparent 70%)`,
        animation: state === "critical" ? "heartbeat 0.8s ease-in-out infinite" : state === "busy" ? "heartbeat 1.2s ease-in-out infinite" : "heartbeat 2s ease-in-out infinite",
        opacity: 0.6 + score * 0.4,
      }}
    />
  )
}
