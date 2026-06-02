import { describe, it, expect, vi } from "vitest"
import { withRetry, withMCPRetry, withBloomreachRetry } from "@/lib/retryEngine"
import { ReplayBuffer } from "@/lib/replayBuffer"
import { agentsToOrders, buildOrderBook } from "@/lib/orderBookEngine"
import type { DecisionTrace } from "@/core/shared/types"

describe("Retry Engine", () => {
  it("should return success if target function succeeds immediately", async () => {
    const fn = vi.fn().mockResolvedValue("data")
    const res = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 5, jitter: false })
    expect(res.success).toBe(true)
    expect(res.result).toBe("data")
    expect(res.attempts).toBe(1)
  })

  it("should retry and succeed after transient failures", async () => {
    let count = 0
    const fn = vi.fn(async () => {
      count++
      if (count < 3) throw new Error("Transient error")
      return "succeeded"
    })
    const res = await withRetry(fn, { maxAttempts: 4, baseDelayMs: 5, jitter: false })
    expect(res.success).toBe(true)
    expect(res.result).toBe("succeeded")
    expect(res.attempts).toBe(3)
  })

  it("should fail after exceeding max attempts", async () => {
    const fn = vi.fn(async () => {
      throw new Error("Persistent error")
    })
    const res = await withRetry(fn, { maxAttempts: 2, baseDelayMs: 5, jitter: false })
    expect(res.success).toBe(false)
    expect(res.attempts).toBe(2)
  })

  it("convenience wrapper withMCPRetry should propagate final error", async () => {
    const fn = vi.fn(async () => {
      throw new Error("MCP error")
    })
    await expect(withMCPRetry(fn)).rejects.toThrow("MCP error")
  })
})

describe("Replay Buffer", () => {
  const mockTrace = {
    id: "trace_1",
    transactionId: "evt_1",
    timeline: [],
    finalDecision: "ALLOW",
    confidence: 0.9,
    mcpContextSources: [],
  } as unknown as DecisionTrace

  it("should push, shift and size items properly", () => {
    const buffer = new ReplayBuffer(2)
    buffer.push(mockTrace, "test1")
    expect(buffer.size()).toBe(1)

    buffer.push(mockTrace, "test2")
    expect(buffer.size()).toBe(2)

    buffer.push(mockTrace, "test3")
    expect(buffer.size()).toBe(2)
    expect(buffer.peek()?.label).toBe("test2")
  })

  it("should replay all elements correctly", async () => {
    const buffer = new ReplayBuffer(10)
    buffer.push(mockTrace, "test1")
    buffer.push(mockTrace, "test2")

    const callback = vi.fn()
    await buffer.replay(callback, "10x", 5)
    expect(callback).toHaveBeenCalledTimes(2)
    expect(buffer.isEmpty()).toBe(true)
  })
})

describe("Order Book Engine", () => {
  it("should convert agent opinions to orders", () => {
    const fraud = { fraudScore: 0.8, recommendation: "BLOCK", confidence: 0.9 }
    const revenue = { priority: "high", revenueAtRisk: 600, recommendation: "ALLOW", confidence: 0.85 }
    const cx = { churnRisk: "low", recommendation: "ALLOW", confidence: 0.78 }

    const orders = agentsToOrders(fraud, revenue, cx, "evt_123")
    expect(orders.length).toBe(3)
    expect(orders.find(o => o.agent === "fraud")?.decision).toBe("BLOCK")
    expect(orders.find(o => o.agent === "revenue")?.decision).toBe("ALLOW")
  })

  it("should construct order book and compute market sentiment", () => {
    const orders: any[] = [
      { agent: "fraud", side: "BUY", decision: "BLOCK", size: 0.9, timestamp: Date.now(), transactionId: "evt_1" },
      { agent: "revenue", side: "BUY", decision: "ALLOW", size: 0.8, timestamp: Date.now(), transactionId: "evt_1" },
      { agent: "cx", side: "BUY", decision: "ALLOW", size: 0.4, timestamp: Date.now(), transactionId: "evt_1" },
    ]
    const book = buildOrderBook(orders)
    expect(book.dominantDecision).toBe("ALLOW")
    expect(book.marketSentiment).toBe("REVENUE_DOMINANT")
  })
})
