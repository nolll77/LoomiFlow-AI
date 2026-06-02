# LoomiFlow — V3→V4 Structural Migration Plan

> **Current Status (June 2026)**: V4 is functional but running as a layer on top of V3.  
> This document is the comprehensive blueprint to perform a clean structural migration to native V4.  
> Author: Antigravity session, validated against actual codebase.

---

## Technical Debt Diagnostic

### Current Code Reality

#### 1. `DecisionTrace.agents` — Unstable Union Type

```typescript
// core/shared/types.ts — Current State
agents: {
  fraud:   FraudAgentOutput | Record<string, unknown>   // ← broken union
  revenue: RevenueAgentOutput | Record<string, unknown>
  cx:      CXAgentOutput | Record<string, unknown>
}
```

**Problem**: `runPipelineV4` populates `agents` with `AgentOpinion` casted to `Record<string, unknown>`. 
V3 UI components (`AgentGrid`, `DecisionDebugger`, `ElectricBeams`, etc.) access `agents.fraud.fraudScore` using `as any`. 
This results in pure TypeScript debt—11 files use `as any` due to this mismatch.

#### 2. `DecisionTrace.orchestrator` — Hand-crafted V3 Stub

```typescript
// core/agents/orchestrator.ts — inside runPipelineV4
orchestrator: {
  finalDecision: marketDecision.finalDecision,
  confidence: marketDecision.confidence,
  severity: "medium",                                          // ← hardcoded
  reasoning: [marketDecision.marketNarrative],
  actions: marketDecision.executionPlan.immediateActions.map(a => a.tool),
  consensusWeights: { fraud: 0.62, revenue: 0.23, cx: 0.15 }, // ← frozen V3 weights
}
```

**Problem**: The Opinion Market computes dynamic `utilityScores` (e.g., risk=0.847, revenue=0.623), but `consensusWeights` remains statically frozen to the V3 default weights (0.62/0.23/0.15).

#### 3. `runFullAgentPipeline` — 270 Lines of Dead Code

```typescript
// core/agents/orchestrator.ts lines 165-260
export async function runFullAgentPipeline(...)  // no longer called by active API routes
```

**Still referenced by**:
- `app/api/paypal-webhook/route.ts` line 21
- `scripts/test-observability.ts`
- `scripts/test-pipeline.ts`

#### 4. Orphaned V3 Types — Still Used Everywhere

| Type | Referencing Files |
|---|---|
| `FraudAgentOutput` | `orchestrator.ts`, `orderBookEngine.ts`, `agentEngine.ts`, `lib/` |
| `RevenueAgentOutput` | `orchestrator.ts`, `orderBookEngine.ts`, `agentEngine.ts` |
| `CXAgentOutput` | `orchestrator.ts`, `orderBookEngine.ts`, `agentEngine.ts` |

#### 5. `consensusWeights` — Anachronistic Field

```typescript
// Inside DecisionTrace (types.ts line 159)
consensusWeights: { fraud: number; revenue: number; cx: number }

// Still read by:
// - hooks/useCockpit.ts line 117
// - components/cockpit/AgentGrid.tsx (consensus indicator bar)
// - core/mcp/traceGraph.ts line 121
// - scripts/test-agents.ts (assertion fraud !== 0.62)
```

#### 6. `agentsToOrders` — Order Book Depends on V3 Types

```typescript
// lib/orderBookEngine.ts
export function agentsToOrders(
  fraud: FraudAgentOutput,    // ← expects V3 types
  revenue: RevenueAgentOutput,
  cx: CXAgentOutput,
  transactionId: string
): AgentOrder[]
```

**Problem**: The `DecisionOrderBook` reads `agents.fraud` through `as any` to populate orders.

---

## Native V4 Target Architecture

### New `DecisionTrace` (Reference Type)

```typescript
// core/shared/types.ts — Native V4 target definition

export interface DecisionTrace {
  // ── Identity ──────────────────────────────────────────────
  id: string
  transactionId: string
  timestamp: number

  // ── Final Decision ────────────────────────────────────────
  finalDecision: OrchestratorDecision["finalDecision"]
  confidence: number

  // ── V4 Brain (Primary Data) ───────────────────────────────
  state: CommerceKnowledgeState              // ← NEW: full system state
  councils: {
    risk:     CouncilProposal
    revenue:  CouncilProposal
    customer: CouncilProposal
  }
  marketDecision: MarketDecision             // ← real utility scores
  executionPlan:  ExecutionPlan
  businessImpact: BusinessImpactSummary
  executiveSummary: string
  learningInsights: LearningInsights

  // ── Observability & V4 Evolutions ─────────────────────────
  timeline:         TraceEntry[]
  mcpContextSources: string[]
  observability?:   ObservabilityEnvelope
  memoryGraph?:     AgentMemoryGraph
  counterfactuals?: Counterfactual[]
  narrative?:       string                   // ← Commerce Narrative Engine
  contextQuality?:  ContextQualityReport     // ← MCP Context Quality Score
  incidentReconstruction?: unknown

  // ── Integrations ──────────────────────────────────────────
  paypalData?:    PayPalEventData
  writeActions?:  WriteActionResult[]

  // ── DELETED / DEPRECATED ──────────────────────────────────
  // agents: { fraud, revenue, cx }         ← replaced by councils
  // orchestrator: OrchestratorDecision     ← replaced by marketDecision
  // consensusWeights                       ← replaced by utilityScores
  // reasoning: string[]                    ← replaced by marketNarrative
}
```

### Replacing Legacy V3 Agent Types

```typescript
// AgentOpinion (V4) replaces FraudAgentOutput/RevenueAgentOutput/CXAgentOutput

// BEFORE (V3)
interface FraudAgentOutput extends AgentOutput {
  fraudScore: number
  behavioralAnomalies: string[]
  // ...
}

// AFTER (V4) — Unified AgentOpinion, already defined in agentTypes.ts
interface AgentOpinion {
  agentId: string
  recommendation: string
  confidence: number
  dataQuality: number
  reasoning: string[]
  expectedOutcome: {
    fraudPrevented?: number
    revenueProtected?: number
    revenueGained?: number
    retentionGain?: number
    conversionUplift?: number
  }
  urgency: "critical" | "high" | "medium" | "low"
  requiredActions: ProposedAction[]
  dataQualityFlags?: string[]
  // Legacy fields mapped from V3 (for backward compat with memoryGraph, etc.)
  fraudScore?: number      // ← from fraudAgent V4
  customerLTV?: number     // ← from revenueAgent V4
  churnRisk?: string       // ← from cxAgent V4 ("low" | "medium" | "high")
  latencyMs?: number       // ← measured by council wrapper
}
```

### New `consensusWeights` → `utilityScores`

```typescript
// BEFORE (V3) — static weights
consensusWeights: { fraud: 0.62, revenue: 0.23, cx: 0.15 }

// AFTER (V4) — dynamic utility scores from the Opinion Market
utilityScores: {
  risk:     number   // e.g. 0.847 (dynamic)
  revenue:  number   // e.g. 0.623
  customer: number   // e.g. 0.412
  winningCouncil: "risk" | "revenue" | "customer"
}
```

---

## Migration Plan — 8 Ordered Phases

### PHASE 0 — Preparation (Zero breaking changes)
**Estimated Duration: 30 min**

Create a dedicated clean branch. Do NOT merge anything to `main` until PHASE 7 is complete.

```bash
git checkout -b feat/v4-native-migration
```

Create `core/shared/typesV4.ts` — the new native V4 `DecisionTrace` types.  
This will coexist alongside `types.ts` throughout the migration. No existing files are modified in this phase.

---

### PHASE 1 — Extend `AgentOpinion` for Legacy Backward-Compat
**Estimated Duration: 45 min**  
**File: `core/shared/agentTypes.ts`**

Add legacy optional fields to `AgentOpinion` so that older UI components reading fields like `fraudScore`, `customerLTV`, `churnRisk`, `latencyMs`, `score`, `agentName`, `recommendation`, and `reasons` can function **WITHOUT** using `as any`.

```typescript
// core/shared/agentTypes.ts — extension of AgentOpinion

export interface AgentOpinion {
  // ── Native V4 Fields ──────────────────────────────────────
  agentId: string
  recommendation: string
  confidence: number
  dataQuality: number
  reasoning: string[]
  expectedOutcome: AgentExpectedOutcome
  urgency: "critical" | "high" | "medium" | "low"
  requiredActions: ProposedAction[]
  dataQualityFlags?: string[]

  // ── Mapped Legacy Fields (V3 → V4 bridge) ────────────────
  // These fields are populated by V4 agents for backward compatibility
  agentName?: string       // = agentId (for DecisionDebugger)
  score?: number           // = confidence (for AgentGrid, ElectricBeams)
  fraudScore?: number      // specific to fraudAgent
  customerLTV?: number     // specific to revenueAgent
  revenueAtRisk?: number   // specific to revenueAgent
  churnRisk?: string       // specific to cxAgent ("low" | "medium" | "high")
  latencyMs?: number       // measured by council wrapper
  reasons?: string[]       // = reasoning (alias for V3 UI)
  mcpSourcesUsed?: string[]
}
```

Update the three V4 agents (`fraudAgent.ts`, `revenueAgent.ts`, `cxAgent.ts`) to populate these compatibility fields inside their output `AgentOpinion` payload.

---

### PHASE 2 — Migrate `DecisionTrace.agents` to `CouncilProposal.memberOpinions`
**Estimated Duration: 1 hour**  
**Files: `core/shared/types.ts`, `core/agents/orchestrator.ts`**

#### 2a. Modify `DecisionTrace`

Remove the union `agents` field and expose a structured councils accessor:

```typescript
// core/shared/types.ts — MODIFICATION

export interface DecisionTrace {
  // ...
  
  // DELETED:
  // agents: { fraud: FraudAgentOutput | Record<string, unknown>, ... }
  
  // ADDED:
  councils: {
    risk:     CouncilProposal     // risk.memberOpinions contains fraud/revenue/cx opinions
    revenue:  CouncilProposal
    customer: CouncilProposal
  }
}
```

#### 2b. Add Accessor Helpers

```typescript
// core/shared/traceHelpers.ts — NEW FILE

import { DecisionTrace } from "./types"
import { AgentOpinion } from "./agentTypes"

export function getAgent(trace: DecisionTrace, agentId: "fraud" | "revenue" | "cx"): AgentOpinion | undefined {
  return trace.councils?.risk?.memberOpinions?.find(o => o.agentId === agentId)
}

export function getFraudScore(trace: DecisionTrace): number {
  return getAgent(trace, "fraud")?.fraudScore ?? getAgent(trace, "fraud")?.confidence ?? 0
}

export function getCustomerLTV(trace: DecisionTrace): number {
  return getAgent(trace, "revenue")?.customerLTV ?? 0
}

export function getChurnRisk(trace: DecisionTrace): "low" | "medium" | "high" {
  return (getAgent(trace, "cx")?.churnRisk as "low" | "medium" | "high") ?? "low"
}

export function getConsensusWeights(trace: DecisionTrace): { risk: number; revenue: number; customer: number } {
  const scores = trace.marketDecision?.utilityScores ?? {}
  return {
    risk:     scores.risk ?? 0.62,
    revenue:  scores.revenue ?? 0.23,
    customer: scores.customer ?? 0.15,
  }
}
```

#### 2c. Refactor `runPipelineV4` in `orchestrator.ts`

Remove the legacy `agents` stub formatting block and return the direct native properties:

```typescript
// core/agents/orchestrator.ts — runPipelineV4 return block
return {
  ...partialTrace,
  councils: { risk: riskC, revenue: revenueC, customer: customerC },
  marketDecision,
  // ...
}
```

---

### PHASE 3 — Migrate `orchestrator` → `marketDecision`
**Estimated Duration: 1 hour**  
**Files: `core/shared/types.ts`, `core/agents/orchestrator.ts`, `core/mcp/traceGraph.ts`**

#### 3a. Remove `OrchestratorDecision` from `DecisionTrace`

```typescript
// BEFORE
orchestrator: OrchestratorDecision
consensusWeights: { fraud: number; revenue: number; cx: number }
reasoning: string[]

// AFTER
marketDecision: MarketDecision   // typed, contains everything
// marketDecision.finalDecision
// marketDecision.confidence
// marketDecision.winningCouncil
// marketDecision.utilityScores  ← replaces consensusWeights
// marketDecision.marketNarrative ← replaces reasoning[0]
// marketDecision.coalitionType    ← NEW: UNANIMOUS | MAJORITY | SPLIT | VETO
```

#### 3b. Update `AgentGrid` Consensus Indicator

```typescript
// components/cockpit/AgentGrid.tsx — BEFORE
const o = decision.orchestrator
<div style={{ width: `${o.consensusWeights.fraud * 100}%` }} />

// AFTER (using typed helper)
import { getConsensusWeights } from "@/core/shared/traceHelpers"
const weights = getConsensusWeights(decision)
<div style={{ width: `${weights.risk * 100}%` }} />
// Note: Labels change from V3 "Fraud" / "Revenue" / "CX" to V4 "Risk" / "Revenue" / "Customer"
```

---

### PHASE 4 — Migrate V3 UI Components (Remove all `as any` casting)
**Estimated Duration: 2 hours**  
**Files impacted: 11 components**

For each component, replace `as any` casts with type-safe imports from `traceHelpers.ts`.

Example for `components/cockpit/AgentGrid.tsx`:
```typescript
// BEFORE
const agents = decision?.agents as any
<AgentCard agent={agents?.fraud ?? null} />

// AFTER
import { getAgent } from "@/core/shared/traceHelpers"
const fraudAgent = decision ? getAgent(decision, "fraud") : null
<AgentCard agent={fraudAgent ?? null} />
```

---

### PHASE 5 — Update `lib/orderBookEngine.ts` to accept `AgentOpinion`
**Estimated Duration: 30 min**

```typescript
// lib/orderBookEngine.ts — AFTER
import { AgentOpinion } from "@/core/shared/agentTypes"
export function agentsToOrders(
  fraud: AgentOpinion | null | undefined,
  revenue: AgentOpinion | null | undefined,
  cx: AgentOpinion | null | undefined,
  transactionId: string
): AgentOrder[] {
  // Read recommendation directly instead of output.recommendation
  // Read confidence instead of output.score
  // Read fraudScore ?? confidence for order size calculations
}
```

---

### PHASE 6 — Migrate PayPal Webhook Routing and CLI Scripts
**Estimated Duration: 30 min**

*   Update `app/api/paypal-webhook/route.ts` to invoke `runPipelineV4(event)` instead of legacy pipelines.
*   Update `scripts/test-pipeline.ts` and `scripts/test-observability.ts` to use `runPipelineV4` and assert against the new `marketDecision.utilityScores` structure instead of legacy consensus weights.

---

### PHASE 7 — Delete Dead V3 Code
**Estimated Duration: 1 hour**

Delete the following items in order, making sure the project compiles between each deletion:
1. `runFullAgentPipeline` from `orchestrator.ts`
2. `FraudAgentOutput`, `RevenueAgentOutput`, and `CXAgentOutput` types from `types.ts`
3. `AgentOutput` and `OrchestratorDecision` from `types.ts`
4. Legacy agent execution wrappers (`runFraudAgentLegacy`, etc.)
5. `lib/agentEngine.ts` (obsolete simulation file)

Validate cleanup:
```bash
npm run build && echo "Compilation Clean"
```

---

### PHASE 8 — Final E2E Verification
**Estimated Duration: 30 min**

Execute type checks and run E2E scenarios via local endpoints:
```bash
# 1. Type check check
npm run build

# 2. Test V4 Endpoint
curl -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"scenario": "vipPaymentFailure"}' | jq '.trace.marketDecision'
```

---

## Migration Benefits Summary

*   **100% Type-Safe**: Removes all 11 `as any` legacy hacks in V4 routing.
*   **Dynamic Weighting**: The UI now shows the actual, dynamic **Opinion Market Utility Scores** instead of fake static coefficients.
*   **Reduced Footprint**: Removes ~350 lines of redundant V3 legacy orchestration pathways.
*   **Clean Pipeline**: Event -> StateBuilder -> Councils -> OpinionMarket -> Action -> Ledger.
