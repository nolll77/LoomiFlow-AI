import { describe, it, expect } from "vitest"
import { buildCommerceState } from "@/core/context/stateBuilder"
import type { CommerceEvent, MCPCustomerContext } from "@/core/shared/types"

describe("State Builder Unit Tests", () => {
  it("should build commerce state correctly under VIP and high-fraud conditions", async () => {
    const event: CommerceEvent = {
      id: "evt_123",
      type: "payment_failed",
      timestamp: Date.now(),
      customerId: "cust_vip",
      value: 1200,
      fraudScore: 0.85,
    }

    const ctx: MCPCustomerContext = {
      customerId: "cust_vip",
      ltv: 6000,
      tier: "VIP",
      churnRisk: "high",
      totalOrders: 15,
      segmentIds: ["seg_vip", "seg_active"],
      recentEvents: [
        { id: "evt_prev", type: "product_view", timestamp: Date.now() - 5000 }
      ],
      toolsUsed: ["get_customer_profile"],
      mcpSavedMs: 120,
      fetchedAt: Date.now(),
    }

    const state = await buildCommerceState(event, ctx, ["get_customer_profile"])
    expect(state.customer.customerId).toBe("cust_vip")
    expect(state.customer.tier).toBe("VIP")
    expect(state.customer.churnScore).toBe(0.8)
    expect(state.revenue.revenueAtRisk).toBe(1200)
    expect(state.revenue.recoveryPotential).toBe(6000 * 0.15)
    expect(state.fraud.fraudScore).toBe(0.85)
    expect(state.fraud.riskLevel).toBe("HIGH") // enriched depends on behavior fingerprint velocity/etc.
    expect(state.catalog.searchQualityScore).toBeNull() // no Discovery tool used
  })

  it("should handle premium tier mapping correctly", async () => {
    const event: CommerceEvent = {
      id: "evt_123",
      type: "checkout",
      timestamp: Date.now(),
      customerId: "cust_premium",
      value: 200,
    }

    const ctx: MCPCustomerContext = {
      customerId: "cust_premium",
      ltv: 2500,
      tier: "premium",
      churnRisk: "medium",
      totalOrders: 5,
      segmentIds: [],
      recentEvents: [],
      toolsUsed: [],
      mcpSavedMs: 0,
      fetchedAt: Date.now(),
    }

    const state = await buildCommerceState(event, ctx, [])
    expect(state.customer.tier).toBe("PREMIUM")
  })

  it("should correctly handle multi-device cookie array logic", async () => {
    const event: CommerceEvent = {
      id: "evt_123",
      type: "checkout",
      timestamp: Date.now(),
      customerId: "cust_cookies",
      value: 100,
    }

    const ctx: any = {
      customerId: "cust_cookies",
      ltv: 100,
      ids: {
        cookie: ["cookie_primary", "cookie_secondary"]
      },
      recentEvents: [],
    }

    const state = await buildCommerceState(event, ctx as any, [])
    expect(state.customer.cookieId).toBe("cookie_primary")
  })
})
