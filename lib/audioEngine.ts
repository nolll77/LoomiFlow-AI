// lib/audioEngine.ts
// Web Audio API synth engine — dynamic beeps and SRE alerts (E5 spec)
// Server-safe: all functions guard against non-browser environments

// ─── CONTEXT SINGLETON ────────────────────────────────────────

let _ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!_ctx || _ctx.state === "closed") {
    try {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (e) {
      console.warn("[AUDIO] AudioContext unavailable:", e)
      return null
    }
  }
  return _ctx
}

// Resume context on user gesture (required by most browsers)
export async function unlockAudio(): Promise<void> {
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === "suspended") {
    try { await ctx.resume() } catch {}
  }
}

// ─── LOW-LEVEL SYNTH ─────────────────────────────────────────

interface ToneConfig {
  frequency: number
  type?: OscillatorType
  gainPeak?: number
  durationMs?: number
  attackMs?: number
  releaseMs?: number
}

function playTone(config: ToneConfig): void {
  const ctx = getCtx()
  if (!ctx) return

  const { frequency, type = "sine", gainPeak = 0.15, durationMs = 120, attackMs = 10, releaseMs = 80 } = config

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.type = type
  osc.frequency.setValueAtTime(frequency, ctx.currentTime)

  const now = ctx.currentTime
  const durationSec = durationMs / 1000
  const attackSec = attackMs / 1000
  const releaseSec = releaseMs / 1000

  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(gainPeak, now + attackSec)
  gain.gain.setValueAtTime(gainPeak, now + durationSec - releaseSec)
  gain.gain.linearRampToValueAtTime(0, now + durationSec)

  osc.start(now)
  osc.stop(now + durationSec + 0.01)
}

function scheduleChord(tones: ToneConfig[], startOffsetMs = 0): void {
  const ctx = getCtx()
  if (!ctx) return
  tones.forEach(tone => {
    setTimeout(() => playTone(tone), startOffsetMs)
  })
}

// ─── NAMED SOUND EVENTS ───────────────────────────────────────

/** Soft success chirp — ALLOW decision or successful write */
export function playSuccess(): void {
  playTone({ frequency: 880, type: "sine", durationMs: 100, gainPeak: 0.10 })
  setTimeout(() => playTone({ frequency: 1108, type: "sine", durationMs: 80, gainPeak: 0.08 }), 110)
}

/** Warning double-beep — HOLD or LOW_CONFIDENCE anomaly */
export function playWarning(): void {
  playTone({ frequency: 440, type: "triangle", durationMs: 150, gainPeak: 0.12 })
  setTimeout(() => playTone({ frequency: 440, type: "triangle", durationMs: 150, gainPeak: 0.10 }), 200)
}

/** Critical alert siren — BLOCK or FRAUD_SPIKE */
export function playCritical(): void {
  const times = [0, 180, 360]
  times.forEach(t => {
    setTimeout(() => {
      playTone({ frequency: 660, type: "sawtooth", durationMs: 160, gainPeak: 0.18 })
    }, t)
    setTimeout(() => {
      playTone({ frequency: 440, type: "sawtooth", durationMs: 160, gainPeak: 0.15 })
    }, t + 80)
  })
}

/** MCP activity pulse — gentle high-pitched tick on each MCP tool call */
export function playMCPTick(): void {
  playTone({ frequency: 1760, type: "sine", durationMs: 40, gainPeak: 0.05 })
}

/** Rollback thud — triggered on SRE canary rollback */
export function playRollback(): void {
  playTone({ frequency: 220, type: "sawtooth", durationMs: 300, gainPeak: 0.20 })
  setTimeout(() => playTone({ frequency: 110, type: "sawtooth", durationMs: 200, gainPeak: 0.15 }), 280)
}

/** Startup chime — played on cockpit mount */
export function playStartup(): void {
  scheduleChord([
    { frequency: 523, type: "sine", gainPeak: 0.08, durationMs: 80 },
    { frequency: 659, type: "sine", gainPeak: 0.07, durationMs: 80 },
    { frequency: 784, type: "sine", gainPeak: 0.06, durationMs: 80 },
  ])
  setTimeout(() => playTone({ frequency: 1047, type: "sine", gainPeak: 0.10, durationMs: 120 }), 90)
}

// ─── DECISION-DRIVEN DISPATCH ─────────────────────────────────

export type SoundEvent =
  | "ALLOW"
  | "BLOCK"
  | "HOLD"
  | "STEP_UP_AUTH"
  | "THROTTLE"
  | "MCP_TICK"
  | "ROLLBACK"
  | "STARTUP"

export function playForEvent(event: SoundEvent): void {
  switch (event) {
    case "ALLOW":       return playSuccess()
    case "BLOCK":       return playCritical()
    case "HOLD":        return playWarning()
    case "STEP_UP_AUTH": return playWarning()
    case "THROTTLE":    return playWarning()
    case "MCP_TICK":    return playMCPTick()
    case "ROLLBACK":    return playRollback()
    case "STARTUP":     return playStartup()
  }
}
