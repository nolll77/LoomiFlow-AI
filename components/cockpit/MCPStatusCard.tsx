// components/cockpit/MCPStatusCard.tsx
// Live MCP connection health + latency monitoring
"use client"
import { useState, useEffect } from "react"

interface MCPStatus {
  connected: boolean
  toolCount: number
  lastPingMs: number
  lastError?: string
  urlOk: boolean
}

export default function MCPStatusCard() {
  const [status, setStatus] = useState<MCPStatus | null>(null)
  const [checking, setChecking] = useState(false)

  const check = async () => {
    setChecking(true)
    try {
      const t0 = Date.now()
      const res = await fetch("/api/mcp-test")
      const data = await res.json()
      const pingMs = Date.now() - t0

      setStatus({
        connected: data.status === "ok",
        toolCount: data.results?.tools?.count ?? 0,
        lastPingMs: pingMs,
        lastError: data.results?.whoami?.error ?? undefined,
        urlOk: !data.results?.whoami?.error,
      })

      console.log("[MCP STATUS] Checked:", { connected: data.status === "ok", pingMs })
    } catch (e: any) {
      setStatus({ connected: false, toolCount: 0, lastPingMs: 0, lastError: e.message, urlOk: false })
    }
    setChecking(false)
  }

  useEffect(() => { check(); const t = setInterval(check, 30_000); return () => clearInterval(t) }, [])

  return (
    <div className="panel-glass rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-gray-300">LOOMI CONNECT MCP</span>
        <button onClick={check} disabled={checking} className="text-[10px] text-gray-500 hover:text-gray-300">
          {checking ? "⏳" : "↻"}
        </button>
      </div>

      {!status ? (
        <div className="text-[10px] text-gray-500">Checking...</div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status.connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            <span className="text-[10px]" style={{ color: status.connected ? "#2EE59D" : "#FF3B3B" }}>
              {status.connected ? "CONNECTED" : "DISCONNECTED"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <div className="text-gray-500">Tools</div>
              <div className="text-white font-mono">{status.toolCount}</div>
            </div>
            <div>
              <div className="text-gray-500">Latency</div>
              <div className={`font-mono ${status.lastPingMs > 15000 ? "text-red-400" : status.lastPingMs > 5000 ? "text-yellow-400" : "text-green-400"}`}>
                {status.lastPingMs}ms
              </div>
            </div>
          </div>

          <div className="text-[9px] text-gray-600 font-mono truncate">
            loomi-mcp-alpha.bloomreach.com/mcp
          </div>

          {status.lastError && (
            <div className="text-[10px] text-red-400/80 bg-red-400/10 rounded p-1.5 truncate">
              ⚠ {status.lastError}
            </div>
          )}

          {!status.urlOk && (
            <div className="text-[10px] text-yellow-400/80">
              Check: no trailing slash in MCP_URL
            </div>
          )}
        </div>
      )}
    </div>
  )
}
