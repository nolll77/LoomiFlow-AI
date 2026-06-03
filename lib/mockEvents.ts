// lib/mockEvents.ts — 3 demo scenarios + VIP data for Pacific Apparel sandbox
import { CommerceEvent } from "@/core/shared/types"

// Pacific Apparel customers (sandbox silent-ukulele)
export const DEMO_CUSTOMERS = {
  vip: {
    id: "vip_pacific_001",
    name: "Sarah Mitchell",
    tier: "VIP" as const,
    ltv: 3200,
    totalOrders: 14,
    churnRisk: "high" as const,
    predictionScore: 0.82,
    categoryPreference: ["premium-fashion", "accessories"],
  },
  standard: {
    id: "user_pacific_442",
    name: "John Doe",
    tier: "standard" as const,
    ltv: 420,
    totalOrders: 3,
    churnRisk: "medium" as const,
    predictionScore: 0.45,
    categoryPreference: ["basics"],
  },
}

// Scenario 1 — VIP Payment Failure (CLIMAX DEMO)
export const VIP_PAYMENT_FAILURE: CommerceEvent = {
  id: `evt_vip_${Date.now()}`,
  type: "payment_failed",
  timestamp: Date.now(),
  customerId: DEMO_CUSTOMERS.vip.id,
  value: 249.90,
  currency: "EUR",
  deviceId: "device_B", // Nouveau device non reconnu
  mcpContext: {
    customerId: DEMO_CUSTOMERS.vip.id,
    tier: "VIP",
    ltv: 3200,
    churnRisk: "high",
    predictionScore: 0.82,
    totalOrders: 14,
    categoryPreference: ["premium-fashion"],
    fetchedAt: Date.now(),
    toolsUsed: ["get_customer_properties", "get_customer_prediction_score", "list_customer_events"],
    recentEvents: [
      { id: "v1", type: "product_view", timestamp: Date.now() - 86400000, deviceId: "device_A" },
      { id: "v2", type: "checkout", timestamp: Date.now() - 80000000, deviceId: "device_A" },
      { id: "v3", type: "checkout", timestamp: Date.now() - 40000000, deviceId: "device_A" },
    ]
  },
  paypalData: {
    transactionId: `PAYPAL_TX_${Date.now()}`,
    status: "DECLINED",
    declineReason: "AUTHORIZATION_TIMEOUT",
    fraudSignals: { velocityAnomaly: true, deviceMismatch: false, geoInconsistency: true, riskScore: 0.72 },
    amount: { value: 249.90, currency: "EUR" },
    buyerAccountId: process.env.PAYPAL_PERSONAL_ACCOUNT_ID,
    merchantAccountId: process.env.PAYPAL_BUSINESS_ACCOUNT_ID,
  },
}

// Scenario 2 — Mobile Conversion Drop (SYSTEM INTELLIGENCE)
export const CONVERSION_ANOMALY: CommerceEvent = {
  id: `evt_anomaly_${Date.now()}`,
  type: "conversion_anomaly",
  timestamp: Date.now(),
  customerId: "system",
  value: 1200,
  metadata: { segment: "mobile_eu", dropRate: 0.34, affectedUsers: 847 },
  mcpContext: {
    customerId: "system",
    tier: "standard",
    ltv: 0,
    churnRisk: "low",
    predictionScore: 0,
    totalOrders: 0,
    fetchedAt: Date.now(),
    toolsUsed: ["execute_analytics"],
    recentEvents: []
  },
}

// Scenario 3 — Cart Abandonment (WARM-UP)
export const CART_ABANDONMENT: CommerceEvent = {
  id: `evt_cart_${Date.now()}`,
  type: "cart_abandonment",
  timestamp: Date.now(),
  customerId: DEMO_CUSTOMERS.standard.id,
  value: 89.00,
  deviceId: "device_A",
  mcpContext: {
    customerId: DEMO_CUSTOMERS.standard.id,
    tier: "standard",
    ltv: 420,
    churnRisk: "medium",
    predictionScore: 0.45,
    totalOrders: 3,
    fetchedAt: Date.now(),
    toolsUsed: ["get_customer_properties", "list_customer_events"],
    recentEvents: [
      { id: "evt1", type: "product_view", timestamp: Date.now() - 60000, deviceId: "device_A" },
      { id: "evt2", type: "product_view", timestamp: Date.now() - 58000, deviceId: "device_A" },
      { id: "evt3", type: "checkout_initiated", timestamp: Date.now() - 56000, deviceId: "device_A" },
      { id: "evt4", type: "payment_failed", timestamp: Date.now() - 54000, deviceId: "device_A" },
      { id: "evt5", type: "payment_failed", timestamp: Date.now() - 52000, deviceId: "device_A" },
      { id: "evt6", type: "payment_failed", timestamp: Date.now() - 50000, deviceId: "device_A" },
    ]
  },
}

export const DEMO_SCENARIOS = {
  vipPaymentFailure: VIP_PAYMENT_FAILURE,
  conversionAnomaly: CONVERSION_ANOMALY,
  cartAbandonment: CART_ABANDONMENT,
}

// Demo order (for UI): warm-up → build tension → climax
export const DEMO_ORDER = ["cartAbandonment", "conversionAnomaly", "vipPaymentFailure"] as const
