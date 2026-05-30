# 📦 LoomiFlow Lib — `lib/`

> **Read time: ~2 min** | Hackathon Loomi Connect 2026

---

## Module Reference Table

| File | Role | Key Exports | When to Use |
|------|------|-------------|-------------|
| `agentEngine.ts` | Core agent runtime & types | `AgentResult`, `LoomiEvent`, `runAgent()` | Every agent implementation |
| `gpuDecisionMapping.ts` | Maps decisions to GPU acceleration tiers | `gpuMap()`, `GpuTier` | High-throughput scoring paths |
| `heartbeat.ts` | Liveness ping for all agents | `startHeartbeat()`, `HeartbeatStatus` | Health monitoring, watchdog |
| `loadTestSimulator.ts` | Simulates traffic load scenarios | `runLoadTest()`, `LoadProfile` | Perf testing before canary |
| `mockEvents.ts` | Generates synthetic LoomiEvents | `mockOrderEvent()`, `mockLoginEvent()` | Unit tests, local dev |
| `orderBookEngine.ts` | Order state machine & book management | `OrderBook`, `processOrder()` | Revenue/fraud order flows |
| `incidentReconstructor.ts` ⭐ | Replays past incidents from logs | `reconstructIncident()`, `IncidentTimeline` | Post-mortem, debug sessions |
| `memoryGraph.ts` ⭐ | Persistent agent memory as a graph | `MemoryGraph`, `remember()`, `recall()` | Cross-event context retention |
| `observabilityEnvelope.ts` ⭐ | Wraps every decision with trace metadata | `wrap()`, `ObsEnvelope` | All agent decisions (mandatory) |
| `retryEngine.ts` ⭐ | Exponential backoff + circuit breaker | `withRetry()`, `CircuitBreaker` | External API calls |
| `replayBuffer.ts` ⭐ | Ring buffer for event replay | `ReplayBuffer`, `push()`, `drain()` | Arena training, A/B replay |
| `audioEngine.ts` ⭐ | Audio cues for real-time alerts | `playAlert()`, `AudioLevel` | Dashboard UX alerts |

> ⭐ = V2 modules (new in this release)

---

## V2 Module Usage Examples

### 📁 `incidentReconstructor.ts`

Replay a past incident end-to-end from stored logs:

```ts
import { reconstructIncident } from '../lib/incidentReconstructor';

const timeline = await reconstructIncident({
  incidentId: 'inc_2026_fraud_spike',
  fromTs: '2026-05-29T14:00:00Z',
  toTs:   '2026-05-29T14:15:00Z',
});

console.log(timeline.events);    // ordered list of events
console.log(timeline.decisions); // agent decisions per event
console.log(timeline.rootCause); // inferred root cause
```

---

### 🧠 `memoryGraph.ts`

Persist cross-event context per user or session:

```ts
import { MemoryGraph } from '../lib/memoryGraph';

const graph = new MemoryGraph({ namespace: 'fraud' });

// Store a fact
await graph.remember('user:u_42', { highRisk: true, flaggedAt: Date.now() });

// Retrieve later (even across events)
const memory = await graph.recall('user:u_42');
// { highRisk: true, flaggedAt: 1748571816000 }
```

---

### 🔭 `observabilityEnvelope.ts`

**Mandatory wrapper** for all agent decisions — adds trace ID, latency, and agent metadata:

```ts
import { wrap } from '../lib/observabilityEnvelope';

const result = await wrap('fraudAgent', async () => {
  return fraudAgent.evaluate(event);
});
// result.traceId: 'trace_8f2a1c'
// result.latencyMs: 42
// result.agentName: 'fraudAgent'
// result.payload: { score: 0.91, action: 'BLOCK' }
```

---

### 🔁 `retryEngine.ts`

Wrap any async call with retry + circuit breaker:

```ts
import { withRetry, CircuitBreaker } from '../lib/retryEngine';

const breaker = new CircuitBreaker({ threshold: 5, resetAfterMs: 30_000 });

const data = await withRetry(
  () => paypalClient.charge(order),
  { maxAttempts: 3, backoffMs: 200, breaker }
);
// Logs: [RetryEngine] attempt=1 failed → retrying in 200ms
// Logs: [RetryEngine] attempt=2 succeeded
```

---

### 🎞️ `replayBuffer.ts`

Ring buffer — store events and drain for replay or training:

```ts
import { ReplayBuffer } from '../lib/replayBuffer';

const buffer = new ReplayBuffer({ capacity: 1000 });

buffer.push(event);           // add to ring
const batch = buffer.drain(50); // pull up to 50 events
// Use in arena training or A/B comparison
```

---

### 🔊 `audioEngine.ts`

Fire audio alerts on the dashboard during live demos:

```ts
import { playAlert, AudioLevel } from '../lib/audioEngine';

// Levels: 'info' | 'warning' | 'critical'
playAlert(AudioLevel.CRITICAL, 'fraud_block');
// Plays: /assets/sounds/critical.mp3
// Logs: [AudioEngine] alert=critical cue=fraud_block
```

---

## Module Dependency Graph

```
orchestrator
  └── observabilityEnvelope  ← wraps every decision
        └── memoryGraph       ← persists cross-event facts
        └── retryEngine       ← guards external calls

agentEngine
  └── replayBuffer            ← feeds arena training
  └── heartbeat               ← liveness monitoring

loadTestSimulator
  └── mockEvents              ← synthetic event generation
  └── orderBookEngine         ← order state during load

incidentReconstructor
  └── memoryGraph             ← reads stored facts
  └── observabilityEnvelope   ← reads stored traces

audioEngine (standalone)
gpuDecisionMapping (standalone)
```

---

## 🐛 Quick Debug

```
[AgentEngine]           event=order runId=run_9f2 started
[ObsEnvelope]           traceId=trace_8f2a agentName=fraudAgent latencyMs=42
[MemoryGraph]           remember user:u_42 { highRisk: true }
[RetryEngine]           attempt=2 succeeded (paypalClient.charge)
[ReplayBuffer]          push size=342/1000
[IncidentReconstructor] reconstructed 47 events rootCause=velocity_spike
[AudioEngine]           alert=critical cue=fraud_block
[Heartbeat]             all agents alive (checked 3/3)
[LoadTestSimulator]     rps=450 p99=210ms errorRate=0.001
```

**Tip:** Import only the modules you need to keep bundle size small. `audioEngine` and `loadTestSimulator` should never be imported in production agent paths.
