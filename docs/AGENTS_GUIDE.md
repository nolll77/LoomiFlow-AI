# 🤖 LoomiFlow AI — Agents Guide

**Loomi Connect AI Hackathon 2026**  

This guide details the internal logic and responsibilities of the 4 intelligent agents forming the core of the Autonomous Commerce Operations Agent (ACOA).

---

## 1. Agent Roles & Logic

### 🛡️ Fraud Agent (Weight: 62%)
- **Input**: PayPal signals, velocity metrics, IP/Geo data, device fingerprinting.
- **Logic**: Strict risk evaluation.
  - `score > 0.8` → `BLOCK`
  - `score > 0.4` → `STEP_UP_AUTH`
  - `score <= 0.4` → `ALLOW`

### 💰 Revenue Agent (Weight: 23%)
- **Input**: Customer LTV, tier (VIP, standard), cart value, transaction history.
- **Logic**: Maximizes recovery and safeguards VIP accounts.
  - `LTV > 1000` or `value > 200` → `ALLOW`
  - Else → `HOLD`

### 💬 CX Agent (Weight: 15%)
- **Input**: Churn risk prediction, engagement score, recent support tickets.
- **Logic**: Minimizes friction.
  - `churnRisk === "high"` → `STEP_UP_AUTH` (to provide a soft-fail path)
  - Else → `HOLD`

---

## 2. Orchestrator Consensus & Matrix

The Orchestrator resolves conflicting advice by applying predefined safety and business rules.

### Decision Matrix (Fraud Score vs. LTV)
```text
                    FRAUD SCORE
              0.0    0.3    0.5    0.7    0.85   1.0
           ┌──────┬──────┬──────┬──────┬──────┬──────┐
    < 500  │ HOLD │ HOLD │ HOLD │ BLOCK│ BLOCK│ BLOCK│
           ├──────┼──────┼──────┼──────┼──────┼──────┤
L    500  │ALLOW │ALLOW │ HOLD │ STEP │ STEP │ BLOCK│
T   1000  │ALLOW │ALLOW │ HOLD │ STEP │ STEP │ BLOCK│
V         ├──────┼──────┼──────┼──────┼──────┼──────┤
  > 1000  │ALLOW │ALLOW │ALLOW │ STEP │ STEP │ STEP │
           └──────┴──────┴──────┴──────┴──────┴──────┘
          STEP = STEP_UP_AUTH (VIP protection pattern)
```

### Confidence Calculation
```javascript
confidence = (0.62 * fraud.conf) + (0.23 * revenue.conf) + (0.15 * cx.conf)
```

---

## 3. The "WHY" Button (Reasoning Chain)
The UI features a "WHY" button powered by the **Memory Graph**. It calculates the relative influence of every context data point on the final decision.

**Example VIP Output:**
> "Fraud score 0.72 exceeds threshold but customer LTV (€3200) justifies recovery. CX Agent highlighted high churn risk. Final decision: STEP_UP_AUTH."

---

## 4. Console Debugging (Expected Prints)

When the agents run, expect the following server logs:
```text
[AGENT][FRAUD][START] {"eventType":"payment_failed","customerId":"vip_pacific_001"}
[AGENT][FRAUD][DONE] {"score":0.72,"recommendation":"STEP_UP_AUTH"}
[AGENT][REVENUE][START] {"eventType":"payment_failed","value":249.9}
[AGENT][REVENUE][DONE] {"revenueAtRisk":249.9,"recommendation":"ALLOW"}
[AGENT][CX][START] {"churnRisk":"high"}
[AGENT][CX][DONE] {"churnRisk":"high","recommendation":"STEP_UP_AUTH"}
[ORCHESTRATOR][START] {"fraud":"STEP_UP_AUTH","revenue":"ALLOW","cx":"STEP_UP_AUTH"}
[ORCHESTRATOR][DECISION] {"final":"HOLD","confidence":0.89,"severity":"medium"}
```

## 📝 Proof of Capture
- Agent specific logic, weights, and inputs.
- Orchestrator decision matrix.
- Confidence consensus calculation.
- Reasoning chain explanation.
- Expected debug print statements.
