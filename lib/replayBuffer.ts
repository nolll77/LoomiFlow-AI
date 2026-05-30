// lib/replayBuffer.ts
// Netflix-style event replay buffer — queue and replay decisions at configurable speed

import { DecisionTrace } from "@/core/shared/types"

// ─── TYPES ────────────────────────────────────────────────────

export interface BufferedDecision {
  trace: DecisionTrace
  bufferedAt: number
  label?: string
}

export type ReplaySpeed = "1x" | "2x" | "5x" | "10x"

const SPEED_MULTIPLIERS: Record<ReplaySpeed, number> = {
  "1x": 1, "2x": 0.5, "5x": 0.2, "10x": 0.1,
}

export type ReplayCallback = (trace: DecisionTrace, index: number, total: number) => void

// ─── BUFFER CLASS ─────────────────────────────────────────────

export class ReplayBuffer {
  private buffer: BufferedDecision[] = []
  private maxSize: number
  private isReplaying = false

  constructor(maxSize = 100) {
    this.maxSize = maxSize
  }

  // ── WRITE ──────────────────────────────────────────────────

  push(trace: DecisionTrace, label?: string): void {
    this.buffer.push({ trace, bufferedAt: Date.now(), label })
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift() // drop oldest if over capacity
    }
  }

  pushBatch(traces: DecisionTrace[]): void {
    traces.forEach((t, i) => this.push(t, `batch_${i}`))
  }

  // ── READ ───────────────────────────────────────────────────

  peek(): BufferedDecision | undefined {
    return this.buffer[0]
  }

  drain(): BufferedDecision[] {
    const items = [...this.buffer]
    this.buffer = []
    return items
  }

  size(): number { return this.buffer.length }
  isEmpty(): boolean { return this.buffer.length === 0 }
  getAll(): BufferedDecision[] { return [...this.buffer] }

  // ── REPLAY ─────────────────────────────────────────────────

  /**
   * Replay buffered decisions sequentially with a configurable delay between each.
   * @param onReplay - callback invoked per trace
   * @param speed - playback speed multiplier ("1x" | "2x" | "5x" | "10x")
   * @param baseIntervalMs - baseline delay between decisions in ms (default 1500)
   */
  async replay(
    onReplay: ReplayCallback,
    speed: ReplaySpeed = "1x",
    baseIntervalMs = 1500
  ): Promise<void> {
    if (this.isReplaying) {
      console.warn("[REPLAY_BUFFER] Already replaying — aborting duplicate call")
      return
    }
    if (this.isEmpty()) {
      console.log("[REPLAY_BUFFER] Buffer is empty, nothing to replay")
      return
    }

    this.isReplaying = true
    const snapshot = this.drain()
    const interval = baseIntervalMs * SPEED_MULTIPLIERS[speed]

    console.log(`[REPLAY_BUFFER] Starting replay of ${snapshot.length} decisions at ${speed} (${interval}ms interval)`)

    for (let i = 0; i < snapshot.length; i++) {
      const { trace } = snapshot[i]
      onReplay(trace, i, snapshot.length)
      if (i < snapshot.length - 1) {
        await new Promise(resolve => setTimeout(resolve, interval))
      }
    }

    this.isReplaying = false
    console.log("[REPLAY_BUFFER] Replay complete")
  }

  get replaying(): boolean { return this.isReplaying }

  /** Non-destructive replay (keeps buffer intact) */
  async previewReplay(
    onReplay: ReplayCallback,
    speed: ReplaySpeed = "2x",
    baseIntervalMs = 1000
  ): Promise<void> {
    if (this.isReplaying) return
    this.isReplaying = true
    const snapshot = [...this.buffer]
    const interval = baseIntervalMs * SPEED_MULTIPLIERS[speed]

    for (let i = 0; i < snapshot.length; i++) {
      const { trace } = snapshot[i]
      onReplay(trace, i, snapshot.length)
      if (i < snapshot.length - 1) {
        await new Promise(resolve => setTimeout(resolve, interval))
      }
    }
    this.isReplaying = false
  }
}

// ─── SINGLETON ────────────────────────────────────────────────

/** Global singleton replay buffer — use this in components */
export const globalReplayBuffer = new ReplayBuffer(100)
