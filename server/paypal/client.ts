// server/paypal/client.ts
import { PayPalEventData } from "@/core/shared/types"

const BASE = process.env.PAYPAL_SANDBOX_BASE_URL!
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID!
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!

function ppLog(action: string, ok: boolean, data?: any) {
  const msg = `[PAYPAL][${ok ? "OK" : "ERR"}][${new Date().toISOString()}] ${action} ${
    data ? JSON.stringify(data).slice(0, 100) : ""
  }`
  console.log(msg)
  try {
    const fs = require("fs"), path = require("path")
    const dir = path.join(process.cwd(), "local-prints")
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, "paypal-events.log"), msg + "\n")
  } catch {}
}

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getPayPalToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    ppLog("getToken", true, { cached: true })
    return cachedToken.token
  }
  ppLog("getToken", true, { fresh: true })
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const err = await res.text()
    ppLog("getToken", false, { status: res.status })
    throw new Error(`PayPal auth failed: ${err}`)
  }
  const d = await res.json()
  cachedToken = { token: d.access_token, expiresAt: Date.now() + (d.expires_in - 60) * 1000 }
  ppLog("getToken", true, { expiresIn: d.expires_in })
  return cachedToken.token
}

export async function testPayPalConnection(): Promise<boolean> {
  try { await getPayPalToken(); ppLog("testConnection", true); return true }
  catch (err: any) { ppLog("testConnection", false, { error: err.message }); return false }
}

export function simulatePaymentFailure(
  customerId: string,
  amount: number
): PayPalEventData {
  const txId = `PAYPAL_TX_${Date.now()}_${customerId.slice(0, 6)}`
  ppLog("simulateFailure", true, { txId, amount })
  return {
    transactionId: txId,
    status: "DECLINED",
    declineReason: "AUTHORIZATION_TIMEOUT",
    fraudSignals: {
      velocityAnomaly: Math.random() > 0.5,
      deviceMismatch: Math.random() > 0.7,
      geoInconsistency: Math.random() > 0.6,
      riskScore: Math.random() * 0.9 + 0.1,
    },
    amount: { value: amount, currency: "USD" },
    buyerAccountId: process.env.PAYPAL_PERSONAL_ACCOUNT_ID,
    merchantAccountId: process.env.PAYPAL_BUSINESS_ACCOUNT_ID,
  }
}

export function normalizePayPalWebhook(body: any): PayPalEventData | null {
  ppLog("normalizeWebhook", true, { eventType: body.event_type })
  const failureTypes = ["PAYMENT.CAPTURE.DENIED", "PAYMENT.AUTHORIZATION.VOIDED"]
  if (!failureTypes.includes(body.event_type)) {
    ppLog("normalizeWebhook", true, { skipped: true, reason: "not a failure event" })
    return null
  }
  return {
    transactionId: body.resource?.id ?? `WEBHOOK_${Date.now()}`,
    status: "DECLINED",
    declineReason: body.resource?.reason_code ?? "UNKNOWN",
    amount: {
      value: parseFloat(body.resource?.amount?.value ?? "0"),
      currency: body.resource?.amount?.currency_code ?? "USD",
    },
    buyerAccountId: body.resource?.payer?.payer_id,
    merchantAccountId: process.env.PAYPAL_BUSINESS_ACCOUNT_ID,
  }
}
