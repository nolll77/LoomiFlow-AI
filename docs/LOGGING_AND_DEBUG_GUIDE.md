# 📊 LoomiFlow AI — Logging & Debugging Guide

This guide details LoomiFlow's structured terminal logging and print statement system. This telemetry is explicitly designed to be copy-pasted into LLM agents or conversational assistants to provide 100% execution context when debugging.

---

## 🔍 Log Prefixes Reference

Watch for these prefix tags in your terminal console (`npm run dev` or `npx ts-node scripts/test-pipeline.ts`):

| Prefix | Source Component | Log Content & Purpose |
|---|---|---|
| `[PIPELINE]` | `orchestrator.ts` | Traces the entry, lifecycle, duration, and output of the core multi-agent pipeline. |
| `[BRAIN][Agent]` | Individual Agents | Prints specific agent reasonings, computed confidence levels, and input parameter diagnostics (e.g. `FraudAgent`, `RecoveryAgent`, etc.). |
| `[ARENA]` | `arenaEngine.ts` | Visualizes the Governance Council consensus building, conflict scores, and dynamically adjusted weights. |
| `[WRITE]` | `writeApi.ts` | Details REST API write requests, payload keys, and response status (including 403 API Limit interception). |
| `[LEARNING]` | `learningAgent.ts` | Reports self-learning feedback loops, dynamic threshold modifications, and system mode updates (e.g. Defensive Mode). |
| `[TRACE GRAPH]` | `traceGraph.ts` | Reports structural metadata of the Explainability Memory Graph generated for SRE. |
| `[WEBHOOK]` | PayPal API handler | Logs incoming raw transaction event signals, payload validation, and client device ID parsing. |
| `[HEALTH]` | `/api/health` | Evaluates MCP and external service integration latency and status diagnostics. |

---

## 📋 Sample Execution Trace (Perfect for LLM Context)

Below is an authentic trace showing a degraded MCP session triggering the Risk Council veto. Copying this into an agent allows it to instantly diagnose the flow:

```text
[WEBHOOK][PayPal] Event type: PAYMENT.SALE.DENIED
[PIPELINE] Starting for event: evt_abc123 type=payment_failed
[MCP][REASONING][PREFETCH] Context prefetch initiated for customer cust_vip_99
[MCP-TEST] Connected to remote MCP: https://loomi-mcp-alpha.bloomreach.com/mcp
[BRAIN][FraudAgent] baseScore=0.78, enrichedScore=0.88, RiskLevel=CRITICAL
[BRAIN][FraudAgent] ⚠️ FRAUD CRITICAL LIMIT EXCEEDED (0.85 threshold). Risk Council veto active.
[BRAIN][RecoveryAgent] VIP status detected. Churn risk high, recovery potential: €150.00
[BRAIN][MerchandisingAgent] NO_CATALOG_DATA -> Gracefully yielding due to absent Discovery features.
[ARENA] Consensus: 0.90 | Decision: BLOCK | Conflict: true (Growth Council wanted ALLOW)
[ARENA] Risk Council veto override enforced. Commercial utility market bypassed.
[ARENA] Updated weights: { fraud: 0.650, sre: 0.050, revenue: 0.200 }
[WRITE][OK][2026-06-02T15:58:30Z] updateCustomerProperty {"customerId":"cust_vip_99","keys":["acoa_recovery_initiated","acoa_last_decision"]}
[WRITE][OK][2026-06-02T15:58:31Z] trackCustomerEvent {"customerId":"cust_vip_99","eventName":"payment_recovery_initiated","info":"write-back confirmed in sandbox testing"}
[TRACE GRAPH] Building explainability nodes for decision: BLOCK
[TRACE GRAPH] Built: 14 nodes, 18 edges
[LEARNING] High BLOCK rate. Tightening thresholds. DEFENSIVE MODE active.
[PIPELINE] Complete in 186ms — Decision: BLOCK (90% confidence)
```

---

## 💡 How to Debug Using This Guide

When encountering an unexpected agent decision:
1. Open the terminal or log viewer where LoomiFlow is running.
2. Select and copy the logs starting from `[WEBHOOK]` or `[PIPELINE] Starting` to `[PIPELINE] Complete`.
3. Paste it directly into your AI assistant with the prompt:
   > *"Here is the LoomiFlow transaction execution trace. Analyze the council conflicts, the inputs, and explain why the system reached this decision."*
4. The assistant will decode the reasoning pathway step-by-step using this logging blueprint.
