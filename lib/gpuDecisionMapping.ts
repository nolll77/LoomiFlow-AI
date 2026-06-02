// lib/gpuDecisionMapping.ts
// Maps agent decisions + fraud scores → GPU visual parameters
// Used by GPUCockpit, FlowOverlay, AgentArenaPanel

import { DecisionTrace, SystemMode, HeartbeatState } from "@/core/shared/types"

export interface GPUVisualState {
  // Point cloud
  pointCount: number
  pointSize: number
  particleSpeed: number
  // Colors
  primaryColor: [number, number, number]   // RGB 0-1
  secondaryColor: [number, number, number]
  accentColor: [number, number, number]
  // Intensity
  turbulence: number      // 0-1 chaos level
  clusterRadius: number   // 0-1 how clustered points are
  redTint: number         // 0-1 fraud overlay
  // Special effects
  blackHoleActive: boolean
  galaxyMode: boolean
  fragmentedFlow: boolean
}

const COLORS = {
  safe:     [0.18, 0.90, 0.62] as [number,number,number],  // #2EE59D green
  warning:  [1.00, 0.62, 0.11] as [number,number,number],  // #FF9F1C orange
  danger:   [1.00, 0.23, 0.23] as [number,number,number],  // #FF3B3B red
  info:     [0.30, 0.64, 1.00] as [number,number,number],  // #4DA3FF blue
  purple:   [0.55, 0.36, 1.00] as [number,number,number],  // #8B5CF6 purple
  neutral:  [0.20, 0.24, 0.40] as [number,number,number],  // dark blue-gray
}

export function decisionToGPUState(
  trace: DecisionTrace | null,
  systemMode: SystemMode,
  heartbeatState: HeartbeatState
): GPUVisualState {

  // Base state
  if (!trace) {
    return {
      pointCount: 2000,
      pointSize: 1.5,
      particleSpeed: 0.3,
      primaryColor: COLORS.info,
      secondaryColor: COLORS.neutral,
      accentColor: COLORS.purple,
      turbulence: 0.1,
      clusterRadius: 0.8,
      redTint: 0,
      blackHoleActive: false,
      galaxyMode: true,
      fragmentedFlow: false,
    }
  }

  // V4 path (primary)
  const riskCouncil = trace.councils?.risk?.memberOpinions ?? []
  const fraudScore = (riskCouncil.find((o: any) => o.agentId === "fraud")?.fraudScore ?? 0) as number
  const decision   = trace.finalDecision
  const severity   = (trace.orchestrator?.severity ?? "normal") as string
  const isCritical = severity === "critical"

  // Point count scales with activity
  const pointCount = isCritical ? 8000 : severity === "high" ? 5000 : 3000

  // Colors by decision
  let primaryColor: [number,number,number]
  let secondaryColor: [number,number,number]
  switch (decision) {
    case "BLOCK":        primaryColor = COLORS.danger;  secondaryColor = COLORS.warning; break
    case "ALLOW":        primaryColor = COLORS.safe;    secondaryColor = COLORS.info;    break
    case "STEP_UP_AUTH": primaryColor = COLORS.info;    secondaryColor = COLORS.purple;  break
    case "HOLD":         primaryColor = COLORS.warning; secondaryColor = COLORS.neutral; break
    default:             primaryColor = COLORS.neutral; secondaryColor = COLORS.info;    break
  }

  // Turbulence = fraud score
  const turbulence = fraudScore * (isCritical ? 1.0 : 0.7)

  // Red tint increases with fraud
  const redTint = fraudScore > 0.7 ? (fraudScore - 0.7) / 0.3 : 0

  console.log(`[GPU] State: decision=${decision}, fraud=${fraudScore.toFixed(2)}, turbulence=${turbulence.toFixed(2)}, redTint=${redTint.toFixed(2)}`)

  return {
    pointCount,
    pointSize: isCritical ? 2.5 : 1.8,
    particleSpeed: 0.2 + turbulence * 0.8,
    primaryColor,
    secondaryColor,
    accentColor: COLORS.purple,
    turbulence,
    clusterRadius: decision === "BLOCK" ? 0.3 : 0.7,
    redTint,
    blackHoleActive: decision === "BLOCK" && fraudScore > 0.85,
    galaxyMode: decision === "ALLOW",
    fragmentedFlow: fraudScore > 0.7,
  }
}

// Arena-specific: 3 agents as competing force fields
export function arenaToForceFields(fraudWeight: number, revenueWeight: number, sreWeight: number) {
  const total = fraudWeight + revenueWeight + sreWeight || 1
  return {
    fraud:   { intensity: fraudWeight / total,   color: COLORS.danger,  radius: 60 + fraudWeight * 40 },
    revenue: { intensity: revenueWeight / total, color: COLORS.safe,    radius: 60 + revenueWeight * 40 },
    sre:     { intensity: sreWeight / total,     color: COLORS.info,    radius: 60 + sreWeight * 40 },
  }
}

// Traffic split → visual lane widths + colors
export function trafficSplitToVisual(split: { prod: number; canary: number; shadow: number }) {
  const alertLevel = split.canary > 0.5 ? "critical" : split.canary > 0.3 ? "warning" : "normal"
  return {
    prodWidth: split.prod * 100,
    canaryWidth: split.canary * 100,
    shadowWidth: split.shadow * 100,
    prodColor: split.prod > 0.7 ? "#2EE59D" : "#FF9F1C",
    canaryColor: split.canary > 0.4 ? "#FF3B3B" : "#FF9F1C",
    shadowColor: "#4DA3FF",
    colorBias: alertLevel === "critical" ? "#FF3B3B" : "#2EE59D",
    alertLevel,
  }
}
