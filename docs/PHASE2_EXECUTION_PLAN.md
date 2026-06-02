# PHASE 2 Execution Plan — Migrate DecisionTrace to V4 Native Structure

**Date**: June 2, 2026  
**Status**: Ready for Execution  
**Estimated Duration**: 6-8 hours  
**Complexity**: HIGH (impacts 14+ files, DecisionTrace is central type)

---

## Executive Summary

### Objective
Replace V3 `agents/orchestrator/consensusWeights` structure in `DecisionTrace` with V4 `councils/marketDecision/utilityScores` structure. This unlocks remaining 24 `as any` casts in downstream consumers.

### Current Problem
```typescript
// V3 (current, causes 'as any' casts)
agents: {
  fraud:   FraudAgentOutput | Record<string, unknown>     // ← Union confusion
  revenue: RevenueAgentOutput | Record<string, unknown>
  cx:      CXAgentOutput | Record<string, unknown>
}
orchestrator: OrchestratorDecision
consensusWeights: { fraud: 0.62, revenue: 0.23, cx: 0.15 }  // ← Static V3 weights
```

### Target State
```typescript
// V4 (native, fully typed)
councils: {
  risk:     CouncilProposal          // Contains fraud opinions
  revenue:  CouncilProposal          // Contains growth agents opinions
  customer: CouncilProposal          // Contains CX agents opinions
}
marketDecision: MarketDecision        // Opinion Market result (dynamic scores)
utilityScores: {
  risk: number
  revenue: number
  customer: number
  winningCouncil: string
}
```

### Impact
- ✅ Eliminates 24 `as any` casts in lib/ and UI files
- ✅ Full type safety for all downstream consumers
- ✅ Properly exposes dynamic utility scores (not static weights)
- ✅ Aligns with V4 Opinion Market architecture

---

## Files to Modify (14 total)

### CATEGORY 1: Core Type Definitions (3 files) — Highest Priority
| File | Change | Impact |
|------|--------|--------|
| `core/shared/types.ts` | Update DecisionTrace: remove agents/orchestrator/consensusWeights, add councils/marketDecision/utilityScores | Central type — blocking all others |
| `core/agents/orchestrator.ts` | Update runPipelineV4 to populate new DecisionTrace structure | Produces DecisionTrace |
| `core/orchestration/types.ts` | Already has MarketDecision, may need tweaks | Already mostly correct |

### CATEGORY 2: Library Files — Trace Access Pattern (7 files)
**All read from `trace.agents` — need to migrate to `trace.councils`**

| File | Current Pattern | New Pattern |
|------|-----------------|-------------|
| `core/mcp/traceGraph.ts` | `(trace.agents as any)` | `trace.councils.risk.memberOpinions[0]` |
| `lib/counterfactualEngine.ts` | `(trace.agents as any).fraud` | `trace.councils.risk.memberOpinions.find(o => o.agentId === 'fraud')` |
| `lib/gpuDecisionMapping.ts` | `(trace.agents as any)` + `(trace.orchestrator as any)` | `trace.councils` + `trace.marketDecision` |
| `lib/incidentReconstructor.ts` | `(trace.agents as any)` | `trace.councils` |
| `lib/memoryGraph.ts` | `(trace.agents as any)` | `trace.councils` |
| `lib/observabilityEnvelope.ts` | `(trace.agents as any)` | `trace.councils` |
| `lib/commercePulse.ts` | `(trace.agents as any)` + `(t as any).councils` | `trace.councils` + `trace.marketDecision.utilityScores` |

### CATEGORY 3: UI Components (3 files)
| File | Current Pattern | New Pattern |
|------|-----------------|-------------|
| `app/cockpit/page.tsx` | `(state.lastDecision.marketDecision as any)?.winningCouncil` | `state.lastDecision.marketDecision.winningCouncil` |
| `app/cockpit/page.tsx` | `(e as any)` in LoadTestPanel | Type e properly |
| `app/api/mcp-test/route.ts` | `(v as any).ok` | Proper type guard |

### CATEGORY 4: Orchestrator/Context (2 files)
| File | Change | Impact |
|------|--------|--------|
| `core/context/stateBuilder.ts` | `(ctx as any)?.ids` | Add proper null checks |
| `core/mcp/behaviorAnalyzer.ts` | 3 enum casts as any | Use proper type guards |

---

## Modification Sequence (Execution Order)

### STEP 1: Update Core Type (types.ts)
**File**: `core/shared/types.ts` (lines 147-185)

**Current**:
```typescript
export interface DecisionTrace {
  id: string
  transactionId: string
  timeline: TraceEntry[]

  // V3 required
  agents: {
    fraud:   FraudAgentOutput | Record<string, unknown>
    revenue: RevenueAgentOutput | Record<string, unknown>
    cx:      CXAgentOutput | Record<string, unknown>
  }
  orchestrator: OrchestratorDecision
  consensusWeights: { fraud: number; revenue: number; cx: number }
  reasoning: string[]

  // V4 optional (to be promoted to primary)
  councils?: Record<string, unknown>
  marketDecision?: unknown
  // ...
}
```

**Target**:
```typescript
import type { CouncilProposal } from "@/core/councils/types"
import type { MarketDecision } from "@/core/orchestration/types"

export interface DecisionTrace {
  id: string
  transactionId: string
  timeline: TraceEntry[]

  // V4 PRIMARY (promoted from optional)
  councils: {
    risk:     CouncilProposal
    revenue:  CouncilProposal
    customer: CouncilProposal
  }
  marketDecision: MarketDecision
  
  // Shortcut for UI (derived from marketDecision.utilityScores)
  utilityScores: {
    risk: number
    revenue: number
    customer: number
    winningCouncil: string
  }

  // V3 DEPRECATED (kept for backward-compat during transition)
  // @deprecated Use councils instead
  agents?: {
    fraud?:   FraudAgentOutput | Record<string, unknown>
    revenue?: RevenueAgentOutput | Record<string, unknown>
    cx?:      CXAgentOutput | Record<string, unknown>
  }
  orchestrator?: OrchestratorDecision
  consensusWeights?: { fraud: number; revenue: number; cx: number }
  reasoning?: string[]

  // Shared fields (unchanged)
  finalDecision: string
  confidence: number
  mcpContextSources: string[]
  // ... rest of fields
}
```

**Changes**:
- ✅ Remove required `agents`, `orchestrator`, `consensusWeights`
- ✅ Promote `councils`, `marketDecision` from optional to required
- ✅ Add `utilityScores` shortcut object
- ✅ Mark V3 fields as optional + deprecated
- ✅ Add proper type imports

---

### STEP 2: Update Orchestrator to Populate New Structure
**File**: `core/agents/orchestrator.ts` (function `runPipelineV4`)

**Current issue** (lines 165-200):
```typescript
// Populates NEW structure but casts to 'as any'
councils: { risk: riskC, revenue: revenueC, customer: customerC } as any,
orchestrator: {} as any,
```

**Required changes**:
```typescript
// Properly populate with types
const trace: DecisionTrace = {
  id: generateTraceId(),
  transactionId: event.customerId,
  timeline: [],
  
  // V4 PRIMARY (no as any!)
  councils: {
    risk: riskProposal,          // Already typed as CouncilProposal
    revenue: revenueProposal,
    customer: customerProposal,
  },
  marketDecision: marketDecision,  // Already typed as MarketDecision
  
  // Shortcut for UI
  utilityScores: {
    risk: marketDecision.utilityScores.risk,
    revenue: marketDecision.utilityScores.revenue,
    customer: marketDecision.utilityScores.customer,
    winningCouncil: marketDecision.winningCouncil,
  },
  
  // Keep V3 for backward compat (optional)
  agents: {
    fraud: riskProposal.memberOpinions.find(o => o.agentId === 'fraud'),
    revenue: revenueProposal.memberOpinions.find(o => o.agentId === 'revenue'),
    cx: customerProposal.memberOpinions.find(o => o.agentId === 'cx'),
  },
  
  // ... rest of fields
}
```

**Remove**: 2 `as any` casts

---

### STEP 3: Update Library Files (Batch 1 — High Impact)

#### 3a. Fix `lib/gpuDecisionMapping.ts`
**Current** (2 casts):
```typescript
const agents = trace.agents as any
const orch = trace.orchestrator as any
```

**New**:
```typescript
const riskOpinion = trace.councils.risk.memberOpinions.find(o => o.agentId === 'fraud')
const revenueOpinion = trace.councils.revenue.memberOpinions.find(o => o.agentId === 'revenue')
const marketDecision = trace.marketDecision
```

#### 3b. Fix `lib/commercePulse.ts`
**Current** (2 casts):
```typescript
const councils = (t as any).councils
const score = fraudOp?.fraudScore ?? (t.agents as any)?.fraud?.fraudScore ?? 0.3
```

**New**:
```typescript
const councils = t.councils
const fraudOpinion = councils.risk.memberOpinions.find(o => o.agentId === 'fraud')
const score = fraudOpinion?.fraudScore ?? fraudOpinion?.confidence ?? 0.3
```

#### 3c. Fix `lib/memoryGraph.ts`
**Current** (1 cast):
```typescript
const agents = trace.agents as any
```

**New**:
```typescript
const allOpinions = [
  ...trace.councils.risk.memberOpinions,
  ...trace.councils.revenue.memberOpinions,
  ...trace.councils.customer.memberOpinions,
]
```

---

### STEP 4: Update Library Files (Batch 2 — Remaining)

#### 4a. `core/mcp/traceGraph.ts` (1 cast)
#### 4b. `lib/counterfactualEngine.ts` (1 cast)
#### 4c. `lib/incidentReconstructor.ts` (1 cast)
#### 4d. `lib/observabilityEnvelope.ts` (1 cast)

**Pattern**: Replace `trace.agents as any` with `trace.councils.{risk,revenue,customer}.memberOpinions`

---

### STEP 5: Fix UI Components

#### 5a. `app/cockpit/page.tsx`
**Current** (3 casts):
```typescript
councilWinner={(state.lastDecision.marketDecision as any)?.winningCouncil ?? "risk"}
onEvent={(e) => injectEvent(e as any)}
winner = (state.lastDecision?.marketDecision as any)?.winningCouncil ?? "risk"
```

**New** (type-safe):
```typescript
councilWinner={state.lastDecision?.marketDecision?.winningCouncil ?? "risk"}
onEvent={(e: LoadTestEvent) => injectEvent(e)}
winner = state.lastDecision?.marketDecision?.winningCouncil ?? "risk"
```

#### 5b. `app/api/mcp-test/route.ts` (1 cast)
#### 5c. `core/context/stateBuilder.ts` (2 casts)

---

## Validation Checkpoint

**After each STEP, verify**:
```bash
# Should show NO errors
npm run build:check

# Should pass all existing tests
npm run test:all

# Count remaining as any
grep -r "as any" core/ app/ lib/ server/
# Expected: Decreasing from 24 toward 0
```

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Breaking UI components | HIGH | Keep V3 agents field optional during transition |
| Type errors in new code | MEDIUM | Run build:check after each file |
| Missing council opinions | MEDIUM | Ensure findByAgentId helpers are robust |
| Orchestrator doesn't populate councils | CRITICAL | Test orchestrator.ts immediately after modification |

---

## Success Criteria

- [ ] `npm run build:check` passes with zero errors
- [ ] All 24 `as any` casts eliminated or moved to non-core files
- [ ] `trace.councils` properly typed in DecisionTrace
- [ ] `trace.marketDecision` properly typed in DecisionTrace
- [ ] UI components access marketDecision without casting
- [ ] Library files access councils without casting
- [ ] V3 backward-compat fields marked as deprecated
- [ ] No regression in existing tests

---

## Parallel Work (Can Start After STEP 2)

- Unit tests for new DecisionTrace structure
- Update cockpit UI to display new utilityScores
- Add migration warnings for V3 field access

---

## Rollback Plan

If critical issues arise:
1. Revert DecisionTrace to keep V3 fields required
2. Keep V4 fields as optional
3. Try again with slower, more careful migration

---

## Estimated Breakdown

| Step | Files | Time | Blocker |
|------|-------|------|---------|
| 1 | types.ts | 30 min | No (types only) |
| 2 | orchestrator.ts | 45 min | After Step 1 |
| 3 | 4 lib files (GPU, Pulse, Mem, Trace) | 1.5 hours | After Step 2 |
| 4 | 4 lib files (Counterfactual, Incident, Observable, Envelope) | 1 hour | After Step 3 |
| 5 | 3 UI/Context files | 1 hour | After Step 4 |
| Validation | Build + tests | 30 min | After all steps |
| **TOTAL** | **14 files** | **5.5 hours** | — |

**Buffer**: +1.5 hours for unexpected issues  
**Total with buffer**: 6-8 hours ✅

---

## Next: Ready to Execute

Once approved, execution will follow this exact sequence with detailed commit at each milestone.

**Questions before we start?**
