# 🛡️ LoomiFlow SRE — `core/sre/`

> **Read time: ~2 min** | Hackathon Loomi Connect 2026

---

## Files

| File | Role |
|------|------|
| `trafficController.ts` | Traffic split between prod / canary / shadow |
| `rollback.ts` | SLO breach detection & automatic rollback |

---

## Traffic Split

The `TrafficController` routes incoming events across three lanes:

```
┌──────────────────────────────────────────────────────┐
│                   INCOMING TRAFFIC                   │
└──────────────────────┬───────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │   PROD   │ │  CANARY  │ │  SHADOW  │
    │   85%    │ │   10%    │ │    5%    │
    │ (stable) │ │  (new v) │ │ (mirror) │
    └──────────┘ └──────────┘ └──────────┘
```

```ts
import { trafficController } from './trafficController';

// Default split
trafficController.setSplit({
  prod:   0.85,
  canary: 0.10,
  shadow: 0.05,
});

// Route a single event
const lane = trafficController.route(event);
// lane: 'prod' | 'canary' | 'shadow'
```

**Shadow** lane: receives a copy of all traffic, responses are discarded — used for silent testing without impacting users.

---

## Rollback Trigger Conditions

The `rollback.ts` module continuously monitors SLO metrics and fires automatically:

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Error rate (canary) | `> 2%` over 5 min | Shift canary → 0%, restore prod 100% |
| P99 latency | `> 800ms` sustained 3 min | Pause canary |
| Fraud miss-rate | `> 5%` delta vs prod | Hard rollback + alert |
| Agent consensus failure | `> 10%` NaN rate | Kill switch engaged |

```ts
import { rollbackEngine } from './rollback';

// Manual trigger
await rollbackEngine.trigger({
  reason: 'SLO_BREACH',
  metric: 'error_rate',
  value: 0.034,
});
// Logs: [Rollback] SLO_BREACH triggered → prod=100%, canary=0%
```

---

## Kill Switch

Emergency stop — halts all canary and shadow traffic instantly:

```ts
import { trafficController } from './trafficController';

// Engage kill switch (e.g. from admin panel or alert webhook)
trafficController.killSwitch();
// → prod: 100%, canary: 0%, shadow: 0%
// → Logs: [KillSwitch] ENGAGED at 2026-05-30T05:23:36Z

// Reset
trafficController.reset();
```

---

## Monitoring via TrafficSplitPanel

The `TrafficSplitPanel` component (UI) polls `trafficController.getStatus()` every 5s:

```ts
// Returns live snapshot
const status = trafficController.getStatus();
// {
//   prod: 0.85, canary: 0.10, shadow: 0.05,
//   killSwitchActive: false,
//   sloHealth: { errorRate: 0.008, p99: 340, fraudDelta: 0.01 }
// }
```

Open the panel at: **`/dashboard/sre`** → "Traffic Split" tab.

---

## SRE Flow Schema

```
  ┌─────────────┐
  │   Event In  │
  └──────┬──────┘
         │
         ▼
  ┌──────────────────────────────────┐
  │      TrafficController           │
  │  route() → prod | canary | shadow│
  └──────────────────────────────────┘
         │              │             │
    (85%)│         (10%)│        (5%) │
         ▼              ▼             ▼
     [PROD]         [CANARY]      [SHADOW]
     agents         agents       agents (no-op)
         │              │
         └──────┬────────┘
                ▼
        ┌───────────────┐
        │ SLO Monitor   │ ← rollback.ts
        │ (continuous)  │
        └───────┬───────┘
                │
           SLO breach?
           ┌────┴────┐
          YES        NO
           │          │
           ▼          ▼
    ┌─────────────┐  continue
    │  Rollback   │
    │  Engine     │
    └──────┬──────┘
           │
    ┌──────┴──────┐
    │ Kill Switch │ (if hard breach)
    └─────────────┘
```

---

## Log File

All SRE decisions are persisted to:

```
local-prints/sre-decisions.log
```

Format:
```
2026-05-30T05:23:36Z [TrafficController] route=canary eventId=evt_9f2a
2026-05-30T05:23:41Z [SLOMonitor] errorRate=0.025 → BREACH (threshold=0.02)
2026-05-30T05:23:41Z [Rollback] TRIGGERED reason=SLO_BREACH prod=100% canary=0%
2026-05-30T05:23:41Z [KillSwitch] ENGAGED
```

---

## 🐛 Quick Debug

```
[TrafficController] split={prod:0.85, canary:0.10, shadow:0.05}
[TrafficController] route=canary for eventId=evt_abc
[SLOMonitor]        p99=812ms → BREACH threshold=800ms
[Rollback]          TRIGGERED → restoring prod=100%
[KillSwitch]        ENGAGED at <timestamp>
[KillSwitch]        RESET — resuming normal split
```

**Tip:** Tail the log file during demos:
```bash
tail -f local-prints/sre-decisions.log
```
