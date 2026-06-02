import { CustomerEvent, CommerceEvent } from "@/core/shared/types"

export interface BehavioralFingerprint {
  avgTimeBetweenEvents: number    // ms — rythme normal du client
  unusualHour: boolean            // heure actuelle vs habitudes
  deviceChangeDetected: boolean   // device different du dernier event
  velocityScore: number           // 0-1 : events trop rapides = suspect
  journeyState: "browsing" | "evaluating" | "converting" | "churning"
}

export function analyzeBehavior(
  events: CustomerEvent[],
  currentEvent: CommerceEvent
): BehavioralFingerprint {
  
  if (events.length < 3) {
    return { velocityScore: 0.5, journeyState: "browsing", 
             unusualHour: false, deviceChangeDetected: false, avgTimeBetweenEvents: 0 }
  }
  
  // Trier par timestamp
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)
  
  // Calcul du rythme normal
  const gaps = sorted.slice(1).map((e, i) => e.timestamp - sorted[i].timestamp)
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
  
  // Velocity : derniers 5 events trop rapides ?
  const recentGaps = gaps.slice(Math.max(0, gaps.length - 4))
  const recentAvg = recentGaps.length > 0 ? recentGaps.reduce((a, b) => a + b, 0) / recentGaps.length : avgGap
  const velocityScore = recentAvg < avgGap * 0.3 ? 0.85 : // 3x trop rapide
                        recentAvg < avgGap * 0.6 ? 0.55 : 0.15
  
  // Heure inhabituelle : comparer heure actuelle vs distribution historique
  const currentHour = new Date().getHours()
  const historicalHours = sorted.map(e => new Date(e.timestamp).getHours())
  const hourFreq = new Array(24).fill(0)
  historicalHours.forEach(h => hourFreq[h]++)
  const unusualHour = hourFreq[currentHour] < historicalHours.length * 0.05
  
  // Journey state via derniers event types
  const recentTypes = sorted.slice(-5).map(e => e.type)
  const journeyState = 
    recentTypes.includes("checkout") ? "converting" :
    recentTypes.includes("payment_failed") ? "churning" :
    recentTypes.filter(t => t === "product_view").length > 3 ? "evaluating" :
    "browsing"
  
  // Device change : comparer deviceId du dernier event
  const lastDevice = sorted[sorted.length - 1].deviceId
  const deviceChangeDetected = currentEvent.deviceId != null && 
                                lastDevice != null && 
                                currentEvent.deviceId !== lastDevice
  
  return { avgTimeBetweenEvents: avgGap, unusualHour, deviceChangeDetected, 
           velocityScore, journeyState }
}
