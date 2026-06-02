# LoomiFlow AI — Flux d'information complet

Ce document décrit le flux d'information exact de LoomiFlow AI, depuis l'entrée d'un événement commerce jusqu'à la décision finale, l'observabilité et la notification UI.

## 1. Objectif

L'objectif est de décrire comment les signaux sont capturés, enrichis, évalués par plusieurs agents, orchestrés puis actionnés via Bloomreach, tout en alimentant le dashboard cockpit.

## 2. Vue d'ensemble

LoomiFlow AI est un pipeline headless qui combine :

- des événements commerce ou PayPal
- un enrichissement Loomi Connect MCP
- un moteur multi-agent (Fraud, Revenue, CX)
- un orchestrateur de décision
- une phase d'écriture Bloomreach
- une couche d'observabilité / mémoire / incident
- un cockpit de supervision en temps réel

## 3. Schéma simplifié du flux

```text
+-----------------+        +-------------------------+        +----------------------+        +--------------------------+
| 1. Événement    |  --->  | 2. Enrichissement MCP  |  --->  | 3. Agents parallèles  |  --->  | 4. Orchestrateur         |
|    Commerce     |        |    (get_customer_*)     |        |   Fraud / Revenue /   |        |    (BLOCK/ALLOW/HOLD/    |
|  (PayPal, demo) |        |                         |        |   CX                 |        |     STEP_UP_AUTH)        |
+-----------------+        +-------------------------+        +----------------------+        +--------------------------+
        |                            |                              |                                    |
        |                            |                              |                                    |
        v                            v                              v                                    v
+-----------------+        +-------------------------+        +--------------------------------+        +--------------------------+
|  API simulate   |        |  server/mcp/client.ts   |        |  core/agents/orchestrator.ts   |        |  server/bloomreach/       |
|  /api/simulate  |        |  getCustomerFullContext |        |  runFullAgentPipeline()       |        |  writeApi.ts              |
+-----------------+        +-------------------------+        +--------------------------------+        +--------------------------+
        |                                                                                                 |
        +---------------------------------------------------------------------------------------------->  |
                                                                                                          |
                                                                                                          v
                                                                                         +-----------------------------+
                                                                                         | 5. Observabilité + mémoire   |
                                                                                         |    trace, latency, incidents |
                                                                                         +-----------------------------+
                                                                                                          |
                                                                                                          v
                                                                                         +-----------------------------+
                                                                                         | 6. Cockpit UI (WS)           |
                                                                                         |    /cockpit                   |
                                                                                         +-----------------------------+
```

## 4. Flux d'information détaillé

### 4.1 Entrée d'événement

Source : `app/api/simulate/route.ts`

- L'API `POST /api/simulate` reçoit un scénario de démonstration.
- Elle charge l'événement correspondant depuis `lib/mockEvents.ts`.
- Elle appelle `runFullAgentPipeline(event, event.mcpContext ?? null, useLLM)`.
- Elle publie le résultat via WebSocket aux clients cockpit.

Fichier clé : `app/api/simulate/route.ts`

### 4.2 Enrichissement MCP

Source : `core/agents/orchestrator.ts`

- Si l'événement n'a pas déjà de contexte MCP, le pipeline appelle `getCustomerFullContext(event.customerId)`.
- Le client MCP se trouve dans `server/mcp/client.ts`.
- Les outils MCP utilisés incluent des appels typiques tels que `get_customer_properties`, `get_customer_prediction_score`, `list_customer_events`, etc.
- Le contexte retourné est stocké en `MCPCustomerContext`.

Fichiers clés :
- `server/mcp/client.ts`
- `core/shared/types.ts`

### 4.3 Agents parallèles

Source : `core/agents/orchestrator.ts`

Le pipeline exécute trois agents en parallèle avec `Promise.all` :

- `runFraudAgent(event, mcpContext, useLLM)` dans `core/agents/fraudAgent.ts`
- `runRevenueAgent(event, mcpContext, useLLM)` dans `core/agents/revenueAgent.ts`
- `runCXAgent(event, mcpContext, useLLM)` dans `core/agents/cxAgent.ts`

Chaque agent retourne un objet `AgentOutput` comprenant :

- `recommendation` (`BLOCK`, `ALLOW`, `HOLD`, `STEP_UP_AUTH`, `THROTTLE`)
- `score`
- `confidence`
- `reasons`
- `mcpSourcesUsed`
- données métier spécifiques (fraud score, revenue at risk, churn risk, etc.)

Fichier clé : `core/shared/types.ts`

### 4.4 Orchestrateur

Source : `core/agents/orchestrator.ts`

- Si `OPENAI_API_KEY` est configuré et `useLLM=true`, le système peut utiliser `runOrchestratorLLM`.
- Sinon, il utilise `runMockOrchestrator`.
- Les règles priorisent la sécurité et la valeur :
  - `fraud > 0.85 && ltv < 500 => BLOCK`
  - `fraud > 0.6 && ltv > 1000 => STEP_UP_AUTH`
  - `fraud < 0.4 && revenueAtRisk > 200 => ALLOW`
  - sinon `HOLD`
- La sortie est un `OrchestratorDecision` avec :
  - `finalDecision`
  - `confidence`
  - `severity`
  - `reasoning`
  - `actions`
  - `customerMessage`
  - `consensusWeights`

### 4.5 Phase de write-back Bloomreach

Source : `core/agents/orchestrator.ts` + `server/bloomreach/writeApi.ts`

- Si la variable `BLOOMREACH_API_TOKEN` est définie, le pipeline exécute `executeAgentDecisionWrites(...)`.
- Cette phase écrit des informations dans Bloomreach Engagement pour déclencher des scénarios ou mettre à jour des propriétés client.
- Les actions peuvent inclure des mises à jour de propriété et des triggers de scénarios.

Fichier clé : `server/bloomreach/writeApi.ts`

### 4.6 Observabilité et mémoire

Source : `core/agents/orchestrator.ts`

Après la décision, le pipeline construit :

- `trace.observability` via `lib/observabilityEnvelope.ts`
  - tokens, coût, latence, bottleneck, outil MCP
- `trace.memoryGraph` via `lib/memoryGraph.ts`
  - graph des influences et nœuds décisionnels
- incident reconstruction via `lib/incidentReconstructor.ts`
  - narratives root-cause

Ces objets servent à l'analyse interne et à la visualisation dans la UI.

### 4.7 Publication vers le cockpit

Source : `app/api/simulate/route.ts`

- Après calcul du `trace`, l'API tente d'envoyer un message WS de type `COCKPIT_EVENT`.
- Le WebSocket est géré dans `server/websocket/gateway.ts`.
- Les clients cockpit reçoivent les événements et mettent à jour l'état.

Fichier clé : `server/websocket/gateway.ts`

### 4.8 Interface front-end cockpit

Source : `app/cockpit/page.tsx` et `hooks/useCockpit.ts`

Le front-end consomme :

- WebSocket `COCKPIT_EVENT`
- API `POST /api/simulate`

L'état du cockpit est géré par `hooks/useCockpit.ts` :

- historique des événements
- dernière décision
- heartbeat score
- system mode

Composants clés :
- `components/cockpit/StatusBar.tsx`
- `components/cockpit/AgentGrid.tsx`
- `components/cockpit/ActionPanel.tsx`
- `components/cockpit/EventStream.tsx`
- `components/cockpit/CanaryStatusPanel.tsx`
- `components/cockpit/DecisionDebugger.tsx`
- `components/cockpit/ObservabilityMiniPanel.tsx`

## 5. Séquences et points d’intégration exacts

### 5.1 Déclenchement demo / simulate

1. `POST /api/simulate` avec `scenario`
2. Chargement de l'événement mock
3. `runFullAgentPipeline(event, ...)`
4. Publication WS `COCKPIT_EVENT`
5. Réponse JSON avec `trace`

### 5.2 WebSocket cockpit

1. `hooks/useCockpit.ts` ouvre `ws://localhost:8080`
2. Reçoit `COCKPIT_EVENT`
3. Met à jour l'état
4. Le cockpit rend les composants

### 5.3 Pipeline décisionnel

1. Événement commerce
2. Contexte MCP
3. Agents  fraude / revenu / CX
4. Orchestrateur
5. Bloomreach write (optionnel)
6. Observabilité
7. Trace résultat

## 6. Diagramme complet de l'architecture

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
+----------------+        +-------------------------+        +----------------------+        +--------------------------+
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

## 7. Recommandations pour documentation

- placer ce document dans `docs/INFORMATION_FLOW.md`
- utiliser le diagramme ASCII comme synthèse visuelle
- relier aux fichiers clés pour faciliter la traçabilité
- conserver le vocabulaire exact du projet : `event`, `trace`, `MCP`, `agent`, `orchestrator`, `write-back`, `observability`

## 8. Fichiers de référence

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

*Document généré pour décrire le flux d'information exact de LoomiFlow AI.*
