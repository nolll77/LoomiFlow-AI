// core/sre/rollback.ts
// Auto-rollback logic for high fraud / SLO breach scenarios

function rollbackLog(step: string, data?: any) {
  const msg = `[SRE][ROLLBACK][${step}] ${data ? JSON.stringify(data).slice(0, 150) : ""}`
  console.log(msg)
  try { const fs=require("fs"),path=require("path"),dir=path.join(process.cwd(),"local-prints"); if(!fs.existsSync(dir))fs.mkdirSync(dir,{recursive:true}); fs.appendFileSync(path.join(dir,"sre-decisions.log"),msg+"\n") } catch {}
}

export interface SLOState {
  errorRate: number       // 0–1
  latencyP95Ms: number
  fraudRate: number       // 0–1
  availabilityPct: number // 0–100
}

export interface RollbackDecision {
  shouldRollback: boolean
  reason: string
  severity: "none" | "warning" | "critical"
  recommendedSplit: { prod: number; canary: number; shadow: number }
  actions: string[]
}

export function evaluateRollback(slo: SLOState): RollbackDecision {
  rollbackLog("EVALUATE", slo)

  // Critical: immediate rollback
  if (slo.errorRate > 0.05) {
    rollbackLog("ROLLBACK_TRIGGERED", { reason: "errorRate", value: slo.errorRate })
    return {
      shouldRollback: true,
      reason: `Error rate ${(slo.errorRate * 100).toFixed(1)}% exceeds 5% SLO`,
      severity: "critical",
      recommendedSplit: { prod: 0.1, canary: 0.8, shadow: 0.1 },
      actions: ["Stop canary promotion", "Route 90% to shadow for analysis", "Alert on-call"],
    }
  }

  if (slo.fraudRate > 0.80) {
    rollbackLog("ROLLBACK_TRIGGERED", { reason: "fraudRate", value: slo.fraudRate })
    return {
      shouldRollback: true,
      reason: `Fraud rate ${(slo.fraudRate * 100).toFixed(0)}% — platform under attack`,
      severity: "critical",
      recommendedSplit: { prod: 0.25, canary: 0.60, shadow: 0.15 },
      actions: ["Activate fraud storm mode", "Increase step-up auth rate", "Notify fraud team"],
    }
  }

  // Warning: degrade gracefully
  if (slo.latencyP95Ms > 2000) {
    return {
      shouldRollback: false,
      reason: `P95 latency ${slo.latencyP95Ms}ms above 2s threshold`,
      severity: "warning",
      recommendedSplit: { prod: 0.5, canary: 0.35, shadow: 0.15 },
      actions: ["Throttle canary traffic", "Scale PROD instances", "Monitor MCP latency"],
    }
  }

  if (slo.availabilityPct < 99.5) {
    return {
      shouldRollback: false,
      reason: `Availability ${slo.availabilityPct.toFixed(2)}% below SLO`,
      severity: "warning",
      recommendedSplit: { prod: 0.7, canary: 0.2, shadow: 0.1 },
      actions: ["Reduce canary load", "Check MCP endpoint health"],
    }
  }

  return {
    shouldRollback: false,
    reason: "All SLOs within bounds",
    severity: "none",
    recommendedSplit: { prod: 0.85, canary: 0.10, shadow: 0.05 },
    actions: [],
  }
}

export function getCanaryPhase(split: { prod: number; canary: number }): string {
  if (split.canary < 0.05) return "IDLE"
  if (split.canary < 0.15) return "OBSERVE (5%)"
  if (split.canary < 0.30) return "EXPAND (25%)"
  if (split.canary < 0.60) return "SCALING (50%)"
  return "INCIDENT MODE"
}
