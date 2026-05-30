# 🤖 LoomiFlow Agents — `core/agents/`

> **Read time: ~2 min** | Hackathon Loomi Connect 2026

---

## Files

| File | Role |
|------|------|
| `fraudAgent.ts` | Fraud scoring & transaction blocking |
| `revenueAgent.ts` | LTV-based upsell / revenue optimization |
| `cxAgent.ts` | Customer experience & CSAT signals |
| `orchestrator.ts` | Multi-agent consensus & final decision |
| `arenaAgents.ts` | Arena challenge agent definitions |
| `arenaEngine.ts` | Arena scoring engine |

---

## How Each Agent Works

### 🔴 FraudAgent
Computes a `fraudScore` (0–1) based on velocity, geo-anomaly and device fingerprint.

```ts
import { fraudAgent } from './fraudAgent';

const result = await fraudAgent.evaluate(event);
// result.score: 0.91
// result.action: 'BLOCK' | 'REVIEW' | 'ALLOW'
```

**Decision rule:**
```
score > 0.85  → action = 'BLOCK'  🔴
score > 0.55  → action = 'REVIEW' 🟡
score ≤ 0.55  → action = 'ALLOW'  🟢
```

### 💰 RevenueAgent
Evaluates LTV, cart size and purchase history to recommend upsell or discount.

```ts
import { revenueAgent } from './revenueAgent';

const rec = await revenueAgent.evaluate(event);
// rec.signal: 'UPSELL' | 'RETAIN' | 'DISCOUNT'
```

### 🎯 CXAgent
Monitors CSAT, NPS signals, and support ticket velocity.

```ts
import { cxAgent } from './cxAgent';

const cx = await cxAgent.evaluate(event);
// cx.sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
```

---

## Consensus Weights

The orchestrator combines agent votes with fixed weights:

```
┌─────────────────────────────────────┐
│  Agent          │  Weight           │
├─────────────────┼───────────────────┤
│  FraudAgent     │  62%  ████████▌   │
│  RevenueAgent   │  23%  ██▊         │
│  CXAgent        │  15%  █▋          │
└─────────────────┴───────────────────┘
```

```ts
// In orchestrator.ts
const consensusScore =
  fraud.score  * 0.62 +
  revenue.score * 0.23 +
  cx.score     * 0.15;
```

---

## Decision Matrix (Fraud Score × LTV)

```
               LOW LTV          HIGH LTV
             ┌────────────────┬────────────────┐
HIGH FRAUD   │  🔴 BLOCK      │  🟡 REVIEW     │
(> 0.85)     │  Auto-reject   │  Human review  │
             ├────────────────┼────────────────┤
MED FRAUD    │  🟡 REVIEW     │  🟢 ALLOW      │
(0.55–0.85)  │  Flag + delay  │  Allow + alert │
             ├────────────────┼────────────────┤
LOW FRAUD    │  🟢 ALLOW      │  🟢 ALLOW      │
(< 0.55)     │  Standard flow │  Fast-track    │
             └────────────────┴────────────────┘
```

---

## Orchestration Schema

```
                     ┌─────────────┐
                     │   Event     │  (order / login / refund)
                     └──────┬──────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
     ┌──────────┐    ┌──────────┐    ┌──────────┐
     │  Fraud   │    │ Revenue  │    │   CX     │
     │  Agent   │    │  Agent   │    │  Agent   │
     └────┬─────┘    └────┬─────┘    └────┬─────┘
      62% │           23% │           15% │
           └────────────────┴────────────────┘
                            │
                     ┌──────▼──────┐
                     │ Orchestrator│
                     │  (consensus)│
                     └──────┬──────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
           BLOCK         REVIEW        ALLOW
```

---

## Adding a New Agent

1. **Create** `core/agents/myNewAgent.ts`:

```ts
import { AgentResult, LoomiEvent } from '../../lib/agentEngine';

export const myNewAgent = {
  name: 'myNew',
  async evaluate(event: LoomiEvent): Promise<AgentResult> {
    const score = computeMyScore(event);
    return { score, signal: score > 0.7 ? 'FLAG' : 'PASS', metadata: {} };
  }
};
```

2. **Register** in `orchestrator.ts`:

```ts
import { myNewAgent } from './myNewAgent';

const agents = [fraudAgent, revenueAgent, cxAgent, myNewAgent];
const weights = [0.55, 0.20, 0.12, 0.13]; // must sum to 1.0
```

3. **Test** with `mockEvents.ts`:

```ts
import { mockOrderEvent } from '../../lib/mockEvents';
const result = await myNewAgent.evaluate(mockOrderEvent());
```

---

## Required Imports

```ts
// Standard agent imports
import { AgentResult, LoomiEvent, AgentConfig } from '../../lib/agentEngine';
import { observabilityEnvelope } from '../../lib/observabilityEnvelope';
import { retryEngine } from '../../lib/retryEngine';
import { memoryGraph } from '../../lib/memoryGraph';
```

---

## 🐛 Quick Debug

Watch for these `console.log` patterns in the terminal:

```
[FraudAgent]    score=0.91 → BLOCK  (txId: abc123)
[RevenueAgent]  LTV=HIGH signal=UPSELL
[CXAgent]       sentiment=NEGATIVE tickets_spike=true
[Orchestrator]  consensus=0.78 → REVIEW  weights=[0.62,0.23,0.15]
[ArenaEngine]   round=3 winner=fraudAgent delta=+0.04
```

**Tip:** Set `DEBUG_AGENTS=true` in `.env.local` for verbose per-event traces.
