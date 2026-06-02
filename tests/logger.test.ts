import { describe, it, expect, vi } from "vitest"
import { runWithTrace, info, getActiveTraceId, logger } from "@/lib/logger"

describe("Pino Logger Unit Tests", () => {
  it("should run operations with traceId inside AsyncLocalStorage", () => {
    runWithTrace("test-trace-12345", () => {
      expect(getActiveTraceId()).toBe("test-trace-12345")
    })
  })

  it("should output log carrying active traceId", () => {
    const logSpy = vi.spyOn(logger, "info")

    runWithTrace("correlation-id-abc", () => {
      info("Checking correlation traceId propagation")
    })

    expect(logSpy).toHaveBeenCalled()
    const lastCallArg = logSpy.mock.calls[logSpy.mock.calls.length - 1][0] as any
    expect(lastCallArg).toBeDefined()
    expect(lastCallArg.traceId).toBe("correlation-id-abc")

    logSpy.mockRestore()
  })
})
