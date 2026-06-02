"use client"
import { CommerceEvent } from "@/core/shared/types"
import { useMemo } from "react"

export default function TimeHeatmap({ events }: { events: CommerceEvent[] }) {
  const cells = useMemo(() => {
    const now = Date.now()
    const buckets = Array.from({ length: 30 }, (_, i) => {
      const start = now - (30 - i) * 2000
      const end = start + 2000
      const bucket = events.filter(e => e.timestamp >= start && e.timestamp < end)
      const maxFraud = bucket.reduce((m, e) => Math.max(m, e.fraudScore ?? 0), 0)
      return { intensity: Math.min(bucket.length / 3, 1), fraudScore: maxFraud, count: bucket.length }
    })
    return buckets
  }, [events])

  return (
    <div className="panel-glass rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-gray-300">TIME HEATMAP</span>
        <span className="text-[10px] text-gray-500">60s window</span>
      </div>
      <div className="flex gap-0.5 items-end h-12">
        {cells.map((c, i) => (
          <div key={i} className="flex-1 rounded-sm transition-all duration-300 cursor-pointer group relative"
            style={{
              height: `${Math.max(4, c.intensity * 100)}%`,
              background: c.fraudScore > 0.7 ? `rgba(255,59,59,${0.3 + c.intensity * 0.7})`
                : c.fraudScore > 0.4 ? `rgba(255,159,28,${0.3 + c.intensity * 0.7})`
                : `rgba(77,163,255,${0.2 + c.intensity * 0.6})`,
            }}
            title={`${c.count} events, fraud ${(c.fraudScore * 100).toFixed(0)}%`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-gray-600 mt-1">
        <span>60s ago</span><span>now</span>
      </div>
    </div>
  )
}
