# 🏛️ Multi-Agent Governance: Councils & Opinion Market

This document provides a technical deep-dive into the governance layer of LoomiFlow V4. It explains the design philosophy, mathematical formulations, and runtime consensus mechanisms used to arbitrate decisions between specialized agents.

---

## 1. Design Philosophy: Decoupling Agent Voice from Governance

Most multi-agent systems suffer from **Agent Sprawl**—where adding more agents leads to chaotic decision pathways, high latency, and unpredictable conflicts. 

LoomiFlow V4 solves this by decoupling **Specialized Analysis** from **Strategic Governance**:
*   **Layer 2 (Agents / The Voices)**: Specialized, lightweight agents process the `CommerceKnowledgeState` to generate local opinions. They have narrow expertise and focus solely on their respective KPIs (e.g., fraud score, churn probability, or email open rates).
*   **Layer 3 (Councils / The Governance)**: Agents do not decide alone. They submit their opinions to one of three **Governance Councils**. Each Council consolidates these opinions into a unified proposal using customized internal consensus models.
*   **Layer 4 (Opinion Market / The Arbitration)**: The three Council proposals are submitted to a centralized market engine. Instead of static logical trees, the market arbitrates using **Economic Utility Functions** and dynamic weights.

---

## 2. The Three Governance Councils

```text
 🛡️ RISK COUNCIL             💰 REVENUE COUNCIL         👤 CUSTOMER COUNCIL
 ┌──────────────────────┐    ┌─────────────────────┐    ┌──────────────────────┐
 │ - Fraud Agent        │    │ - Recovery Agent    │    │ - Retention Agent    │
 │ - SRE / Infra Agent  │    │ - Merch. Agent      │    │ - Personal Shopper   │
 └──────────┬───────────┘    └──────────┬──────────┘    └──────────┬───────────┘
            │                           │                          │
            ▼                           ▼                          ▼
      Risk Proposal              Revenue Proposal          Customer Proposal
 (BLOCK | STEP_UP_AUTH | HOLD)   (ALLOW | STEP_UP)      (ALLOW | HOLD | voucher)
```

### A. The Risk Council (🚨 Risk & Solvency)
*   **Role**: Protects platform solvency, prevents chargebacks, detects fraud, and monitors infrastructural health.
*   **Internal Consensus Method**: **Strict Safety Veto**.
    *   If the Fraud Agent detects high-risk patterns exceeding the security threshold, the Risk Council overrides all other inputs and demands a `BLOCK`.
    *   *Mathematical representation of consensus confidence*:
        $$C_{\text{risk}} = \max(C_{\text{fraud}}, C_{\text{sre}})$$

### B. The Revenue Council (💰 Financial Optimization)
*   **Role**: Maximizes checkout conversion, recovers abandoned cart values, and optimizes inventory placement.
*   **Internal Consensus Method**: **ROI-Driven Maximization**.
    *   Synthesizes opinions by calculating the immediate recovery probability multiplied by the transaction value.
    *   *Consensus recommendation*: Selects the strategy that yields the highest estimated recovery margin.

### C. The Customer Council (👤 Experience & Lifetime Value)
*   **Role**: Protects Customer Lifetime Value (LTV), prevents permanent VIP churn, and manages brand sentiment.
*   **Internal Consensus Method**: **Friction-Churn Minimization**.
    *   Prioritizes reducing friction for high-LTV customers. If a client has a high churn risk, the council votes to avoid restrictive verification checks like hard blocking.

---

## 3. The Opinion Market Utility Engine (The Math)

The **Opinion Market** arbitrates the three council proposals at runtime using a multi-attribute utility function.

### The Utility Equation
For each council proposal $p$ under council $c$, the market computes a utility score $U(c)$:

$$U(c) = W_c \times \left( \alpha \cdot \text{Gain}(p) - \beta \cdot \text{Risk}(p) + \gamma \cdot \text{Confidence}(p) \right)$$

Where:
*   $W_c$ is the **Council Weight** ($W_c = \text{BaseWeight}_c \times \text{PerformanceMultiplier}_c$).
*   $\text{Gain}(p)$ is the normalized ROI expected from the proposal:
    $$\text{Gain}(p) = \frac{\text{ExpectedROI}}{1000}$$
*   $\text{Risk}(p)$ is the safety penalty assigned to the recommended action:
    *   `BLOCK` = $0.8$ (High business friction, low fraud risk exposure)
    *   `STEP_UP_AUTH` = $0.3$ (Moderate friction)
    *   `ALLOW` / `HOLD` = $0.1$ (Low friction, high fraud risk exposure)
*   $\text{Confidence}(p)$ is the confidence score of the proposal (between $0.0$ and $1.0$).
*   **Weights Constants**: $\alpha = 0.4$ (Gain weight), $\beta = 0.4$ (Risk weight), $\gamma = 0.2$ (Confidence weight).

### Council Base Budgets
At initialization, budgets are weighted toward platform security:
1.  **Risk Council**: Base Weight $0.45$
2.  **Revenue Council**: Base Weight $0.30$
3.  **Customer Council**: Base Weight $0.20$
4.  **Intelligence Layer**: Base Weight $0.05$

---

## 4. Self-Learning Loop: Dynamic Budget Tuning

To prevent decision drift and adapt to live traffic conditions (e.g., promotional spikes causing false positive fraud blocks), the **Session Learning Agent** dynamically updates the weights in the background:

```text
Decision Executed ──► Session Ledger (Log) ──► Learning Agent ──► Adjust performanceMultiplier
```

*   **Adjustment Logic**:
    *   If a Council's past proposals led to verified successful outcomes (e.g., a `STEP_UP_AUTH` proposal successfully validated by the user), its `performanceMultiplier` increases by $+0.05$ (capped at $2.0$).
    *   If a Council's proposal led to a failure (e.g., an allowed transaction resulting in chargeback, or a block causing VIP churn), its `performanceMultiplier` decreases by $-0.10$ (floored at $0.5$).
*   This feedback loop operates **in-memory, in-session**, bypassing the need for slow model retraining or redeployment.

---

## 5. Coalition Type Derivation

To make the governance transparent, the market detects the type of alignment between Councils:

| Coalition Type | Condition | Business Meaning | UI Color |
| :--- | :--- | :--- | :--- |
| **`VETO`** | Risk Council `BLOCK` and Confidence > $0.85$ | Safety override. All other opinions are bypassed. | Red 🔴 |
| **`UNANIMOUS`** | All 3 Councils recommended the exact same action | Full organizational consensus. | Green 🟢 |
| **`MAJORITY`** | 2 out of 3 Councils recommended the same action | Democratic resolution of conflicting views. | Blue 🔵 |
| **`SPLIT`** | All 3 Councils recommended different actions | High tension. Arbitrated purely by mathematical utility. | Purple 🟣 |
