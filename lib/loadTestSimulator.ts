// lib/loadTestSimulator.ts
import { CommerceEvent, LoadTestScenario, LoadProfile, LoadTestReport } from "@/core/shared/types"

export const LOAD_SCENARIOS: Record<LoadTestScenario, number> = {
  LOW_FRAUD: 0.1,
  BURST: 0.4,
  FRAUD_STORM: 0.7,
  LATENCY_ATTACK: 0.5,
  CHAOS_MIX: 0.9,
}

export function generateFraudLoad(intensity: number): LoadProfile {
  return {
    rps: Math.floor(100 + intensity * 5000),
    fraudRate: Math.min(1, intensity * 0.95),
    latencySpike: 1 + intensity * 4,
    errorRate: Math.min(0.8, intensity * 0.3),
  }
}

export function generateEvents(profile: LoadProfile, count: number): Partial<CommerceEvent>[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: `load_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 9)}`,
    type: "payment_failed" as const,
    timestamp: Date.now(),
    customerId: Math.random() < 0.1 ? "vip_pacific_001" : `user_${Math.floor(Math.random() * 1000)}`,
    value: Math.random() * 500,
    fraudScore: Math.random() < profile.fraudRate ? 0.7 + Math.random() * 0.3 : Math.random() * 0.3,
    paypalData: {
      transactionId: `LOAD_TX_${Date.now()}_${i}`,
      status: "DECLINED" as const,
      declineReason: "AUTHORIZATION_TIMEOUT",
      fraudSignals: {
        velocityAnomaly: Math.random() < profile.fraudRate,
        deviceMismatch: Math.random() < profile.fraudRate * 0.7,
        geoInconsistency: Math.random() < profile.fraudRate * 0.6,
        riskScore: Math.random() * profile.fraudRate,
      },
      amount: { value: Math.random() * 500, currency: "USD" },
    },
  }))
}

export async function runLoadTest(
  scenario: LoadTestScenario,
  onEvent: (event: Partial<CommerceEvent>) => void,
  options = { cap: 50, delayMs: 80 }
): Promise<LoadTestReport> {
  const intensity = LOAD_SCENARIOS[scenario]
  const profile = generateFraudLoad(intensity)
  const events = generateEvents(profile, Math.min(profile.rps, options.cap))

  console.log(`[LOAD TEST] Starting ${scenario} (intensity=${intensity}, events=${events.length})`)

  let maxFraud = 0
  let rollbackTriggered = false

  for (const event of events) {
    onEvent(event)
    if ((event.fraudScore ?? 0) > maxFraud) maxFraud = event.fraudScore ?? 0
    if ((event.fraudScore ?? 0) > 0.8) rollbackTriggered = true
    await new Promise(r => setTimeout(r, options.delayMs))
  }

  const report: LoadTestReport = {
    totalEvents: events.length,
    avgLatency: profile.latencySpike * 100,
    maxFraudDetected: maxFraud,
    rollbackTriggered,
    systemStabilityScore: Math.round((1 - intensity) * 100),
    scenarioUsed: scenario,
  }

  console.log(`[LOAD TEST] Complete:`, report)
  return report
}
