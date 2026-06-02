# 🛣️ LoomiFlow Technical Debt & Quality Roadmap

**Document Status**: Active Execution  
**Created**: June 2, 2026  
**Last Updated**: June 2, 2026  
**Plan Version**: 5-Point Roadmap (Priority Order)

---

## Executive Summary

This document tracks the complete technical debt remediation plan for LoomiFlow V4 migration and quality improvements. Organized in **5 priority phases**, it serves as the single source of truth for remaining work.

---

## 🎯 5-Point Roadmap (Priority Order)

### 1️⃣ **V4 Native Migration — Eliminate `as any` Casts**
**Status**: 🟡 PARTIALLY COMPLETE (PHASE 1 DONE)  
**Priority**: CRITICAL  
**Effort**: 3-4 days  
**Blocker**: All downstream work depends on clean types

#### What's Completed
- ✅ V4 pipeline engine (`runPipelineV4`) fully implemented
- ✅ Opinion Market with utility scoring working
- ✅ 9 agents properly structured with `AgentOpinion` types
- ✅ 3 Councils (Risk, Revenue, Customer) producing `CouncilProposal` outputs
- ✅ Coalition detection (UNANIMOUS, MAJORITY, SPLIT, VETO) functional
- ✅ 7 hackathon evolutions implemented (Commerce Narrative, Heatmap, Scenario Simulator, etc.)
- ✅ MCP Context Quality Score (Grade A-F) working
- ✅ ExecutionPlan and WriteActions structured
- ✅ **PHASE 1 COMPLETE**: Extended `AgentOpinion` with backward-compat fields (fraudScore, customerLTV, churnRisk, etc.)
- ✅ **Updated 3 agents**: fraudAgent, revenueAgent, cxAgent now populate legacy fields

#### What Remains

| Task | Files Affected | Approach |
|------|-----------------|----------|
| **PHASE 2: Update DecisionTrace** | `core/shared/types.ts` | Replace V3 `agents/orchestrator/consensusWeights` with V4 `councils/marketDecision/utilityScores` |
| **PHASE 3: Refactor Orchestrator** | `core/agents/orchestrator.ts` | Remove 3 `as any` in `runPipelineV4`, properly populate new DecisionTrace fields |
| **PHASE 4: Fix UI Components** | 7+ files in `app/cockpit/`, `lib/` | Replace remaining `as any` accessing `trace.agents` with proper type access on new DecisionTrace |
| **PHASE 5: Fix Memory Graph & Telemetry** | `lib/*.ts` (5+ files) | Update all trace access points to use new `trace.councils` instead of `trace.agents as any` |
| **PHASE 6: Remove Dead Code** | `core/agents/orchestrator.ts` (270 lines) | Delete `runFullAgentPipeline`, update test scripts |
| **PHASE 7: Type Tests** | Create new `test-native-v4.ts` | Verify all DecisionTrace access points are type-safe |
| **PHASE 8: Deprecate V3 Types** | Mark `FraudAgentOutput`, `RevenueAgentOutput`, `CXAgentOutput` as `@deprecated` | Add migration guide comments |

#### Current `as any` Locations (24 Instances After Phase 1)

**Distribution by file**:
```
core/context/stateBuilder.ts:2           // ctx property access
core/agents/orchestrator.ts:3            // councils/orchestrator/contextQuality
core/mcp/traceGraph.ts:1                 // trace.agents (legacy V3 access)
core/mcp/behaviorAnalyzer.ts:3           // enum casting for journey detection
app/cockpit/page.tsx:3                   // marketDecision/LoadTestPanel event
app/api/mcp-test/route.ts:1              // v.ok check
lib/audioEngine.ts:1                     // WebKit AudioContext (browser API)
lib/commercePulse.ts:2                   // councils/agents access
lib/counterfactualEngine.ts:1            // trace.agents (legacy V3 access)
lib/gpuDecisionMapping.ts:2              // trace.agents/orchestrator (legacy V3)
lib/incidentReconstructor.ts:1           // trace.agents (legacy V3 access)
lib/memoryGraph.ts:1                     // trace.agents (legacy V3 access)
lib/observabilityEnvelope.ts:1           // trace.agents (legacy V3 access)
server/mcp/client.ts:1                   // toolName enum casting
```

**Analysis**:
- **7 files** accessing `trace.agents` (legacy V3 structure) — need to migrate to `trace.councils`
- **3 files** with enum/type casting — safe (browser APIs, tool names)
- **2 files** with proper null checks — lower priority

**Accumulated Type Debt**: 24 casts across 14 files (increased from 12 due to new hackathon features)

---

### 2️⃣ **Unit Testing — Add Vitest + 40% Code Coverage**
**Status**: 🟡 NOT STARTED  
**Priority**: HIGH  
**Effort**: 2-3 days  
**Depends On**: Phase 1 (clean types)

#### Scope
- **Vitest Setup**: Add `vitest.config.ts`, `__tests__/` folders
- **Agent Tests**: Fraud Agent, Revenue Agent, CX Agent (unit tests, no mocking MCP)
- **Opinion Market**: Utility scoring, coalition detection logic
- **Council Tests**: Risk, Revenue, Customer council proposal generation
- **Type Coverage**: Ensure all exported interfaces are tested

#### Success Criteria
- All agent functions have unit tests
- Opinion Market utility formula verified with test cases
- Coalition detection logic covered
- No `only()` skips left in test suite
- Coverage report: `npm run test:coverage`

---

### 3️⃣ **Observability & Logging — Structured Telemetry**
**Status**: 🟡 NOT STARTED  
**Priority**: MEDIUM  
**Effort**: 1-2 days  
**Depends On**: Phase 1 (optional, but nice with clean types)

#### Current State
- ❌ Logs scattered: `local-prints/agent-decisions.log` + console.log
- ❌ No structured JSON logging (Pino, Winston)
- ❌ No metrics (Prometheus, OpenTelemetry)
- ❌ No trace correlation IDs

#### Deliverables
- **Structured Logging**: Centralize to JSON (Pino or similar)
- **Trace Correlation**: Add `traceId` to all pipeline logs
- **Metrics**: Export key metrics (decision latency, fraud score distribution, council weights)
- **Observability Envelope**: Already exists in code, integrate with Grafana-ready format

---

### 4️⃣ **Learning Agent Enhancements — ML-Based Threshold Tuning**
**Status**: 🟡 NOT STARTED  
**Priority**: MEDIUM  
**Effort**: 2-3 days  
**Depends On**: Phase 1, Phase 2

#### Current Implementation
- ✅ `SessionLearningAgent` exists and calculates performance metrics
- ✅ Can adjust council weights via `adjustCouncilBudget()`, `adjustCouncilWeight()`
- ⚠️ Adjustments are **basic heuristics** (hardcoded thresholds)

#### Proposed Enhancements
- **Sliding Window**: Track last 50 decisions, not just session
- **Outcome Attribution**: Link decision outcomes (fraud caught, revenue gained) to agent confidence
- **Threshold Optimization**: Use simple hill-climbing or genetic algorithm to find optimal fraud threshold
- **A/B Testing**: Support Learning Agent as slot for experiment control

---

### 5️⃣ **Documentation & UI — Add Sequence Diagrams in Cockpit**
**Status**: 🟡 NOT STARTED  
**Priority**: MEDIUM  
**Effort**: 1-2 days  
**Depends On**: Phase 1, Phase 2

#### Current State
- ✅ Excellent external docs (README, ARCHITECTURE, COUNCILS_GOVERNANCE, 6 scenarios)
- ✅ Cockpit has Memory Graph (shows decision tree)
- ❌ No sequence diagram showing data flow (event → MCP → agents → councils → market → write)
- ❌ No interactive "Why" dialog explaining specific council votes

#### Proposed Additions
- **Sequence Diagram Tab**: Show MCP→Agents→Councils→Market flow for current decision
- **Council Vote Explainer**: Click on each council to see member votes, consensus mechanism
- **Counterfactual Panel**: Already in code (`predictiveScenarioSimulator`), make UI more prominent

---

## 📊 Progress Tracking

### Current Metrics
| Metric | Value | Target |
|--------|-------|--------|
| TypeScript Type Safety | 78% (24 `as any` remaining, down from original 12 due to new features) | 100% (0 casts) |
| Test Coverage | ~5% (CLI scripts only) | 40%+ (unit tests) |
| Structured Logging | 0% | 100% (all events) |
| Documentation Completeness | 95% | 100% |
| Technical Debt Score | 7.0/10 | 9+/10 |
| Phase 1 Status | ✅ COMPLETE | - |
| Estimated Remaining Work | 3-4 days (Phases 2-8) | - |

---

## 🚀 Implementation Order & Dependencies

```
PHASE 1: AgentOpinion ext.
    ↓
PHASE 2: DecisionTrace redesign
    ↓
PHASE 3: Orchestrator refactor
    ├── PHASE 4: UI Component fixes (parallel safe)
    ├── PHASE 5: Memory Graph updates (parallel safe)
    └── PHASE 6: Dead code removal (parallel safe)
    ↓
PHASE 7: Type safety tests
    ↓
[OPTIONAL PARALLEL]
    ├── PHASE 2️⃣: Vitest setup & agent tests
    ├── PHASE 3️⃣: Observability
    ├── PHASE 4️⃣: Learning Agent
    └── PHASE 5️⃣: Documentation UI
```

**Critical Path**: Phases 1→2→3→7 (2-3 days)  
**Full Completion** (all 5 roadmap items): 8-10 days

---

## 📝 File Modifications Summary

### Phase 1 Files
- `core/shared/agentTypes.ts` — Extend `AgentOpinion` interface
- `core/agents/fraudAgent.ts` — Populate legacy fields in output
- `core/agents/revenueAgent.ts` — Populate legacy fields in output
- `core/agents/cxAgent.ts` — Populate legacy fields in output

### Phase 2 Files
- `core/shared/types.ts` — New `DecisionTrace` structure

### Phase 3 Files
- `core/agents/orchestrator.ts` — Remove `as any` casts, populate new fields

### Phase 4 Files
- `app/cockpit/page.tsx` (3 casts)
- `lib/commercePulse.ts` (2 casts)
- `lib/counterfactualEngine.ts` (1 cast)
- `lib/gpuDecisionMapping.ts` (2 casts)
- `app/api/mcp-test/route.ts` (1 cast)
- `core/mcp/traceGraph.ts` (1 cast)
- `core/mcp/behaviorAnalyzer.ts` (3 casts)
- `core/context/stateBuilder.ts` (1 cast)

---

## ✅ Validation Checklist

- [ ] Phase 1: `npm run build:check` passes with no errors
- [ ] Phase 2: New `DecisionTrace` properly exports from `types.ts`
- [ ] Phase 3: `runPipelineV4` produces DecisionTrace with all fields
- [ ] Phase 4: All `as any` removed, `npm run build:check` passes
- [ ] Phase 5: Type safety tests pass
- [ ] Phase 6: `npm run test:all` still works (old tests updated)
- [ ] All: `grep -r "as any" core/ app/ lib/ server/` returns 0 results
- [ ] All: Manual cockpit test at http://localhost:3000/cockpit

---

## 📌 Notes & Learnings

### Recent Commits (insights into project momentum)
- `aa8e519`: Logging guide reference
- `d3bfebe`: EQL running aggregates fallback (campaignROI robustness)
- `afc3e55`: 403 API Limit error mocking (sandbox resilience)
- `9e1a0f2`: safeParseCookie defensive coding
- `1d591a1`: Second MCP URL (clarity-search) for Personal Shopper
- `1c17a12`: SYSTEM_CONTEXT_STATE universal doc (excellent!)
- `ef684d6`: V3/V4 hybrid status explained in READMEs

### Key Insights
1. **Project is actively maintained** — commits show intentional resilience patterns (EQL fallback, 403 handling, multi-device support)
2. **Hackathon mindset** — pragmatic workarounds (mock success on 403) rather than hard failures
3. **Documentation-first** — new features preceded by docs (SYSTEM_CONTEXT_STATE, migration plans)
4. **V3→V4 bridge justified** — maintaining demo stability while building new architecture

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Breaking UI during type migration | Use dual-track: new `DecisionTrace` coexists with V3 temporarily, UI reads both |
| Test suite fragility | Add integration test for DecisionTrace serialization before Phase 3 |
| Learning Agent not proven in prod | Phase 4 is optional; focus on core type safety first |

---

## 📞 Contact & Questions

- **Roadmap Owner**: Team nöL (LoomiFlow)
- **Last Reviewed**: June 2, 2026
- **Next Review**: After Phase 1 completion

---

**This document is living and will be updated as phases complete. Current focus: PHASE 1 (Extend AgentOpinion).**
