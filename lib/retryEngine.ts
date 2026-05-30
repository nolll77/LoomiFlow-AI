// lib/retryEngine.ts
// Exponential backoff with jitter for transient MCP/API failures

export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  jitter?: boolean
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
}

export interface RetryResult<T> {
  success: boolean
  result?: T
  error?: Error
  attempts: number
  totalElapsedMs: number
  delays: number[]
}

// ─── DELAY CALCULATION ────────────────────────────────────────

function calcBackoffDelay(attempt: number, base: number, max: number, jitter: boolean): number {
  const expDelay = Math.min(max, base * Math.pow(2, attempt - 1))
  if (!jitter) return expDelay
  // Full jitter: randomize between 0 and exponential delay
  return Math.floor(Math.random() * expDelay)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── MAIN RETRY WRAPPER ───────────────────────────────────────

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    jitter = true,
    onRetry,
  } = opts

  const delays: number[] = []
  const t0 = Date.now()
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn()
      return { success: true, result, attempts: attempt, totalElapsedMs: Date.now() - t0, delays }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt < maxAttempts) {
        const delay = calcBackoffDelay(attempt, baseDelayMs, maxDelayMs, jitter)
        delays.push(delay)
        onRetry?.(attempt, lastError, delay)
        console.warn(`[RETRY] Attempt ${attempt}/${maxAttempts} failed — retrying in ${delay}ms. Error: ${lastError.message}`)
        await sleep(delay)
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: maxAttempts,
    totalElapsedMs: Date.now() - t0,
    delays,
  }
}

// ─── CONVENIENCE WRAPPERS ─────────────────────────────────────

/** Standard retry for MCP tool calls (3 attempts, starts at 500ms) */
export async function withMCPRetry<T>(fn: () => Promise<T>): Promise<T> {
  const result = await withRetry(fn, {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 4000,
    jitter: true,
    onRetry: (attempt, error) => {
      console.warn(`[MCP_RETRY] Attempt ${attempt}: ${error.message}`)
    },
  })
  if (!result.success) throw result.error ?? new Error("MCP call failed after retries")
  return result.result as T
}

/** Standard retry for Bloomreach write operations (2 attempts, starts at 1000ms) */
export async function withBloomreachRetry<T>(fn: () => Promise<T>): Promise<T> {
  const result = await withRetry(fn, {
    maxAttempts: 2,
    baseDelayMs: 1000,
    maxDelayMs: 5000,
    jitter: false,
    onRetry: (attempt) => {
      console.warn(`[BR_RETRY] Bloomreach write retry #${attempt}`)
    },
  })
  if (!result.success) throw result.error ?? new Error("Bloomreach write failed after retries")
  return result.result as T
}
