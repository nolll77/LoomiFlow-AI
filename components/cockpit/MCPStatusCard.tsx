// components/cockpit/MCPStatusCard.tsx
// Live MCP connection health + latency monitoring
"use client"
import { useState, useEffect } from "react"
import { DecisionTrace } from "@/core/shared/types"

interface MCPStatus {
  connected: boolean
  toolCount: number
  lastPingMs: number
  lastError?: string
  urlOk: boolean
}

export default function MCPStatusCard({ decision }: { decision: DecisionTrace | null }) {
  const [status, setStatus] = useState<MCPStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [activeTransfer, setActiveTransfer] = useState(false)

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

  useEffect(() => {
    check()
    const t = setInterval(check, 30_000)
    return () => clearInterval(t)
  }, [])

  // Listen to new decisions to show active transfer animation
  useEffect(() => {
    if (!decision) return
    setActiveTransfer(true)
    const t = setTimeout(() => {
      setActiveTransfer(false)
    }, 2000)
    return () => clearTimeout(t)
  }, [decision])

  return (
    <div className={`panel-glass rounded-2xl p-3 border transition-all duration-300 ${activeTransfer ? "border-purple-500/80 bg-purple-950/10 shadow-[0_0_15px_rgba(167,139,250,0.15)]" : "border-slate-800"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-gray-300 tracking-wider">LOOMI CONNECT MCP</span>
        <button onClick={check} disabled={checking} className="text-[10px] text-gray-500 hover:text-gray-300">
          {checking ? "⏳" : "↻"}
        </button>
      </div>

      {!status ? (
        <div className="text-[10px] text-gray-500">Checking...</div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${activeTransfer ? "bg-purple-500 animate-ping" : status.connected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
              <span className="text-[10px] font-bold font-mono" style={{ color: activeTransfer ? "#c084fc" : status.connected ? "#2EE59D" : "#FF3B3B" }}>
                {activeTransfer ? "ACTIVE TRANSFER" : status.connected ? "CONNECTED" : "DISCONNECTED"}
              </span>
            </div>
            {activeTransfer && (
              <span className="text-[8px] text-purple-400 font-mono animate-pulse">JSON-RPC READ</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <div className="text-gray-500">Tools Calls</div>
              <div className={`font-mono transition-all duration-300 ${activeTransfer ? "text-purple-400 font-bold scale-110" : "text-white"}`}>
                {activeTransfer ? decision?.mcpContextSources?.length ?? 0 : status.toolCount}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Latency</div>
              <div className={`font-mono transition-all duration-300 ${activeTransfer ? "text-purple-400 font-bold scale-110" : status.lastPingMs > 15000 ? "text-red-400" : "text-green-400"}`}>
                {activeTransfer ? `${decision?.mcpSavedMs ?? 1}ms` : `${status.lastPingMs}ms`}
              </div>
            </div>
          </div>

          {activeTransfer && decision?.mcpContextSources && (
            <div className="text-[9px] text-purple-400 font-mono bg-purple-950/20 p-1.5 rounded border border-purple-500/10 truncate">
              {decision.mcpContextSources.join(", ")}
            </div>
          )}

          {!activeTransfer && (
            <>
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
            </>
          )}
        </div>
      )}
    </div>
  )
}
