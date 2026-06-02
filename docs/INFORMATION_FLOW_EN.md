# LoomiFlow AI — Complete Information Flow

This document describes the exact LoomiFlow AI information flow, from incoming commerce events to the final decision, observability, and cockpit UI notification.

## 1. Purpose

The objective is to explain how signals are captured, enriched, evaluated by multiple agents, orchestrated, and then actioned through Bloomreach, while feeding the real-time cockpit.

## 2. Overview

LoomiFlow AI is a headless pipeline that combines:

- commerce or PayPal events
- Loomi Connect MCP enrichment
- a multi-agent engine (Fraud, Revenue, CX)
- a decision orchestrator
- a Bloomreach write-back phase
- observability / memory / incident reconstruction
- a real-time supervision cockpit

## 3. Simplified flow diagram

```text
+-----------------+        +-------------------------+        +----------------------+        +--------------------------+
| 1. Commerce     |  --->  | 2. MCP Enrichment       |  --->  | 3. Parallel Agents     |  --->  | 4. Orchestrator         |
|    Event        |        |                         |        |   Fraud / Revenue /    |        |    (BLOCK/ALLOW/HOLD/    |
|  (PayPal/demo)  |        |                         |        |   CX                  |        |     STEP_UP_AUTH)        |
+-----------------+        +-------------------------+        +----------------------+        +--------------------------+
        |                            |                              |                                    |
        |                            |                              |                                    |
        v                            v                              v                                    v
+-----------------+        +-------------------------+        +--------------------------------+        +--------------------------+
| Simulation API  |        | server/mcp/client.ts    |        | core/agents/orchestrator.ts   |        | server/bloomreach/       |
|  /api/simulate  |        | getCustomerFullContext  |        | runFullAgentPipeline()       |        | writeApi.ts              |
+-----------------+        +-------------------------+        +--------------------------------+        +--------------------------+
        |                                                                                                 |
        +---------------------------------------------------------------------------------------------->  |
                                                                                                          |
                                                                                                          v
                                                                                         +-----------------------------+
                                                                                         | 5. Observability + memory   |
                                                                                         |    trace, latency, incidents |
                                                                                         +-----------------------------+
                                                                                                          |
                                                                                                          v
                                                                                         +-----------------------------+
                                                                                         | 6. Cockpit UI (WS)           |
                                                                                         |    /cockpit                   |
                                                                                         +-----------------------------+
```

## 4. Detailed information flow

### 4.1 Event intake

Source: `app/api/simulate/route.ts`

- `POST /api/simulate` receives a demo scenario.
- It loads the corresponding event from `lib/mockEvents.ts`.
- It calls `runFullAgentPipeline(event, event.mcpContext ?? null, useLLM)`.
- It publishes the result via WebSocket to cockpit clients.

Key file: `app/api/simulate/route.ts`

### 4.2 MCP enrichment

Source: `core/agents/orchestrator.ts`

- If the event has no existing MCP context, the pipeline calls `getCustomerFullContext(event.customerId)`.
- The MCP client is located in `server/mcp/client.ts`.
- Typical MCP calls include `get_customer_properties`, `get_customer_prediction_score`, `list_customer_events`, and similar.
- The returned context is stored in `MCPCustomerContext`.

Key files:
- `server/mcp/client.ts`
- `core/shared/types.ts`

### 4.3 Parallel agents

Source: `core/agents/orchestrator.ts`

The pipeline executes three agents in parallel using `Promise.all`:

- `runFraudAgent(event, mcpContext, useLLM)` in `core/agents/fraudAgent.ts`
- `runRevenueAgent(event, mcpContext, useLLM)` in `core/agents/revenueAgent.ts`
- `runCXAgent(event, mcpContext, useLLM)` in `core/agents/cxAgent.ts`

Each agent returns an `AgentOutput` object including:

- `recommendation` (`BLOCK`, `ALLOW`, `HOLD`, `STEP_UP_AUTH`, `THROTTLE`)
- `score`
- `confidence`
- `reasons`
- `mcpSourcesUsed`
- domain-specific fields such as fraud score, revenue at risk, churn risk, etc.

Key file: `core/shared/types.ts`

### 4.4 Orchestrator

Source: `core/agents/orchestrator.ts`

- If `OPENAI_API_KEY` is configured and `useLLM=true`, the system may use `runOrchestratorLLM`.
- Otherwise, it uses `runMockOrchestrator`.
- The rules prioritize safety and business value:
  - `fraud > 0.85 && ltv < 500 => BLOCK`
  - `fraud > 0.6 && ltv > 1000 => STEP_UP_AUTH`
  - `fraud < 0.4 && revenueAtRisk > 200 => ALLOW`
  - otherwise `HOLD`
- The output is an `OrchestratorDecision` with:
  - `finalDecision`
  - `confidence`
  - `severity`
  - `reasoning`
  - `actions`
  - `customerMessage`
  - `consensusWeights`

### 4.5 Bloomreach write-back phase

Source: `core/agents/orchestrator.ts` + `server/bloomreach/writeApi.ts`

- If `BLOOMREACH_API_TOKEN` is defined, the pipeline executes `executeAgentDecisionWrites(...)`.
- This phase writes data to Bloomreach Engagement to trigger scenarios or update customer properties.
- Actions can include property updates and scenario triggers.

Key file: `server/bloomreach/writeApi.ts`

### 4.6 Observability and memory

Source: `core/agents/orchestrator.ts`

After the decision, the pipeline builds:

- `trace.observability` via `lib/observabilityEnvelope.ts`
  - tokens, cost, latency, bottleneck, MCP tool data
- `trace.memoryGraph` via `lib/memoryGraph.ts`
  - influence graph of decision nodes
- incident reconstruction via `lib/incidentReconstructor.ts`
  - root cause narrative

These objects support analysis and UI visualization.

### 4.7 Publishing to the cockpit

Source: `app/api/simulate/route.ts`

- After computing the `trace`, the API sends a WS message of type `COCKPIT_EVENT`.
- The WebSocket is managed by `server/websocket/gateway.ts`.
- Cockpit clients receive the event and update state.

Key file: `server/websocket/gateway.ts`

### 4.8 Frontend cockpit UI

Source: `app/cockpit/page.tsx` and `hooks/useCockpit.ts`

The frontend consumes:

- WebSocket `COCKPIT_EVENT`
- API `POST /api/simulate`

Cockpit state is managed by `hooks/useCockpit.ts`:

- event history
- latest decision
- heartbeat score
- system mode

Key components:
- `components/cockpit/StatusBar.tsx`
- `components/cockpit/AgentGrid.tsx`
- `components/cockpit/ActionPanel.tsx`
- `components/cockpit/EventStream.tsx`
- `components/cockpit/CanaryStatusPanel.tsx`
- `components/cockpit/DecisionDebugger.tsx`
- `components/cockpit/ObservabilityMiniPanel.tsx`

## 5. Sequences and exact integration points

### 5.1 Demo / simulation trigger

1. `POST /api/simulate` with a `scenario`
2. Load mock event
3. `runFullAgentPipeline(event, ...)`
4. Publish WS `COCKPIT_EVENT`
5. Return JSON response with `trace`

### 5.2 Cockpit WebSocket

1. `hooks/useCockpit.ts` opens `ws://localhost:8080`
2. Receives `COCKPIT_EVENT`
3. Updates state
4. Renders cockpit components

### 5.3 Decision pipeline

1. Commerce event
2. MCP context enrichment
3. Fraud / revenue / CX agents
4. Orchestrator
5. Optional Bloomreach write-back
6. Observability and memory graph
7. Output decision trace

## 6. Complete architecture diagram

```text
                                                                 +--------------------+
                                                                 |  Frontend Cockpit  |
                                                                 |  app/cockpit/page  |
                                                                 |  hooks/useCockpit  |
                                                                 +---------+----------+
                                                                           |
                                                                           | WebSocket
                                                                           v
+----------------+        +-------------------------+        +----------------------+        +--------------------------+
| PayPal / Demo  |  --->  | API / api/simulate      |  --->  | Orchestrator Pipeline |  --->  | Bloomreach Write Phase    |
|  commerce event|        |                         |        |  core/agents/orchestrator |  |  server/bloomreach/writeApi |
+----------------+        +-------------------------+        +--------------------------------+        +--------------------------+
                                       |                          |                                          
                                       |                          |                                          
                                       |                          v                                          
                                       |                 +-------------------------+                        
                                       |                 | MCP Enrichment          |                        
                                       |                 | server/mcp/client.ts    |                        
                                       |                 +-------------------------+                        
                                       |                          |                                          
                                       |                          v                                          
                                       |                 +-------------------------+                        
                                       |                 | Fraud / Revenue / CX    |                        
                                       |                 | core/agents/*           |                        
                                       |                 +-------------------------+                        
                                       |                          |                                          
                                       |                          v                                          
                                       |                 +-------------------------+                        
                                       |                 | Orchestrator Decision    |                        
                                       |                 | core/agents/orchestrator |                        
                                       |                 +-------------------------+                        
                                       |                          |                                          
                                       |                          v                                          
                                       |                 +-------------------------+                        
                                       |                 | Observability + Memory   |                        
                                       |                 | lib/*.ts                 |                        
                                       |                 +-------------------------+                        
                                       |                                                          
                                       +----------------------------------------------------------+
                                                                                                        
```

## 7. Documentation recommendations

- place this document in `docs/INFORMATION_FLOW_EN.md`
- use the ASCII diagram as a visual summary
- link to key files for traceability
- retain exact project terminology: `event`, `trace`, `MCP`, `agent`, `orchestrator`, `write-back`, `observability`

## 8. Reference files

- `app/api/simulate/route.ts`
- `core/agents/orchestrator.ts`
- `server/mcp/client.ts`
- `core/agents/fraudAgent.ts`
- `core/agents/revenueAgent.ts`
- `core/agents/cxAgent.ts`
- `server/bloomreach/writeApi.ts`
- `server/websocket/gateway.ts`
- `hooks/useCockpit.ts`
- `app/cockpit/page.tsx`
- `components/cockpit/*.tsx`

---

*Document generated to describe the exact LoomiFlow AI information flow.*
