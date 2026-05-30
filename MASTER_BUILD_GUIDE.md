# LOOMIFLOW AI - MASTER BUILD GUIDE V2
## Loomi Connect AI Hackathon 2026 | Track 6: Cross-MCP Orchestration
### ACOA - Autonomous Commerce Operations Agent

> **Ce fichier est le seul dont tu as besoin pour reconstruire LoomiFlow AI from scratch.**
> Passe-le à VSCode Copilot, Cursor, ou tout agent IA.
> Il contient : architecture, code, credentials pattern, tests, debug, visualisations.

---

## 📋 TABLE OF CONTENTS

1. [Vision & Positioning](#1-vision--positioning)
2. [Architecture Complète](#2-architecture-complète)
3. [Stack Technique](#3-stack-technique)
4. [Structure des fichiers](#4-structure-des-fichiers)
5. [Variables d'environnement](#5-variables-denvironnement)
6. [Bootstrap from scratch](#6-bootstrap-from-scratch)
7. [Modules Core - Code complet](#7-modules-core--code-complet)
8. [API Routes](#8-api-routes)
9. [Pipeline de décision - Decision Flow](#9-pipeline-de-décision--decision-flow)
10. [Visualisation Layer](#10-visualisation-layer)
11. [SRE Layer - Résilience](#11-sre-layer--résilience)
12. [Tests & Debug](#12-tests--debug)
13. [Demo Script](#13-demo-script)
14. [Proof of Capture](#14-proof-of-capture)

---

## 1. Vision & Positioning

### Ce que LoomiFlow AI N'EST PAS
❌ Un chatbot e-commerce  
❌ Un assistant analytics  
❌ Un wrapper de recherche IA  

### Ce que LoomiFlow AI EST
✅ **"An AI-native orchestration & observability cockpit for commerce operations powered by Loomi Connect MCP"**

### Track 6 - Cross-MCP Orchestration (Advanced)
- 3+ MCP surfaces utilisées simultanément
- Read loop + Write loop confirmés (Paul Edwards, Bloomreach)
- Données réelles via sandbox `silent-ukulele`

---

## 2. Architecture Complète

### 2.1 Vue Globale

```
╔═══════════════════════════════════════════════════════════════════════╗
║                    LOOMIFLOW AI - FULL STACK ARCHITECTURE             ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║   EXTERNAL TRIGGERS                                                   ║
║   ┌─────────────┐   ┌──────────────┐   ┌─────────────────────┐        ║
║   │ PayPal      │   │ Demo Button  │   │ Load Test                 │  ║
║   │ Webhook     │   │ /api/simulate│   │ Simulator                 │  ║
║   └──────┬──────┘   └──────┬───────┘   └──────────┬──────────┘        ║
║          │                 │                                       │  ║
║          └─────────────────┴───────────────────────┘                  ║
║                                                                    │  ║
║                            ▼                                          ║
║   ┌────────────────────────────────────────────────────────────────┐  ║
║   │                  COMMERCE EVENT NORMALIZER                     │  ║
║   │  payment_failed | cart_abandonment | fraud_detected | vip_at_risk│║
║   └────────────────────────┬───────────────────────────────────────┘  ║
║                                                                    │  ║
║                            ▼                                          ║
║   ┌────────────────────────────────────────────────────────────────┐  ║
║   │              LOOMI CONNECT MCP - READ PHASE                    │  ║
║   │  https://loomi-mcp-alpha.bloomreach.com/mcp (NO trailing /)    │  ║
║   │                                                                │  ║
║   │  get_customer_properties --> tier, LTV, segments               │  ║
║   │  get_customer_prediction_score --> churn_risk, engage_score    │  ║
║   │  list_customer_events --> infer journey state & patterns       │  ║
║   │  execute_analytics --> funnel metrics, conversion rate         │  ║
║   │  get_api_trigger --> identify write-back scenario URL          │  ║
║   └────────────────────────┬───────────────────────────────────────┘  ║
║                                                                    │  ║
║                            ▼                                          ║
║   ┌────────────────────────────────────────────────────────────────┐  ║
║   │              MULTI-AGENT PARALLEL ENGINE                       │  ║
║   │                                                                │  ║
║   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │    ║
║   │  │ FRAUD AGENT  │  │REVENUE AGENT │  │   CX AGENT   │          │  ║
║   │  │   w=0.62     │  │   w=0.23     │  │   w=0.15     │          │  ║
║   │  │              │  │              │  │              │          │  ║
║   │  │ fraudScore   │  │ revenueRisk  │  │ churnRisk    │          │  ║
║   │  │ signals[]    │  │ customerLTV  │  │ friction     │          │  ║
║   │  │ blockPayment │  │ discountRec  │  │ escalate     │          │  ║
║   │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │    ║
║   │         │                 │                   │                │  ║
║   │         └─────────────────┴───────────────────┘                │  ║
║   │                           │ Promise.all()                      │  ║
║   └───────────────────────────┼────────────────────────────────────┘  ║
║                                                                    │  ║
║                               ▼                                       ║
║   ┌────────────────────────────────────────────────────────────────┐  ║
║   │                    ORCHESTRATOR ENGINE                         │  ║
║   │                                                                │  ║
║   │  RULE 1: fraud>0.85 + ltv<500  ────────────--> BLOCK           │  ║
║   │  RULE 2: fraud>0.60 + ltv>1000 ────────────--> STEP_UP_AUTH    │  ║
║   │  RULE 3: fraud<0.40 + revenue>200 ──────────--> ALLOW          │  ║
║   │  RULE 4: else ──────────────────────────────--> HOLD           │  ║
║   │                                                                │  ║
║   │  confidence = 0.62*fraud.conf + 0.23*rev.conf + 0.15*cx.conf   │  ║
║   └────────────────────────────────────────────────────────────────┘  ║
║                                                                    │  ║
║          ┌────────────────────┼─────────────────────┐                 ║
║          │                   │                                     │  ║
║          ▼                   ▼                      ▼                 ║
║   [OBSERVABILITY]    [MEMORY GRAPH]       [INCIDENT RECONSTRUCTOR]    ║
║   tokens, cost,      influence weights,   DAG, root-cause,            ║
║   latency breakdown  top drivers          narrative, severity/100     ║
║          │                   │                                     │  ║
║          └────────────────────┴─────────────────────┘                 ║
║                                                                    │  ║
║                               ▼                                       ║
║   ┌────────────────────────────────────────────────────────────────┐  ║
║   │              BLOOMREACH WRITE PHASE                            │  ║
║   │  (confirmed by Paul Edwards @ Bloomreach)                      │  ║
║   │                                                                │  ║
║   │  1. updateCustomerProperty --> recovery_initiated = true       │  ║
║   │  2. trackCustomerEvent ────--> fire Bloomreach scenario        │  ║
║   │  3. Bloomreach scenario ───--> Mailgun → customer email        │  ║
║   └────────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║   REAL-TIME FEEDBACK LOOP                                             ║
║   WebSocket (ws://localhost:8080) --> Next.js useCockpit hook         ║
║   Firebase Realtime DB (fallback) --> cross-tab sync                  ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### 2.2 Decision Matrix

```
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
          STEP = STEP_UP_AUTH (VIP protection pattern - Peter Centgraf)
```

### 2.3 SRE Traffic Split

```
LIVE TRAFFIC ALLOCATION
┌─────────────────────────────────────────────────┐
│                                                 │
│  PROD ████████████████████████████████ 85%      │
│  CANARY ████████ 10%                            │
│  SHADOW ████ 5%                                 │
│                                                 │
│  SLO BREACH TRIGGER → ROLLBACK IN 3s            │
│  fraud_rate > 30% OR error_rate > 5%            │
└─────────────────────────────────────────────────┘
```

### 2.4 Memory Graph (AI Explainability)

```
DECISION MEMORY GRAPH - Influence Weights
═══════════════════════════════════════════════

  [obs_event] ──0.85--> [mcp_get_customer_properties]
                │                   │
                │                   ▼
                │         [state_ltv: €1250]
                │                   │
                │              0.88 │
                │                   ▼
                │         [agent_revenue: ALLOW]
                │                   │
                │              0.23 │
                └────────────────-->┤
                                    ▼
  [mcp_get_prediction] ──1.0--> [state_churn: high]
                                    │
                               0.90 │
                                    ▼
                           [agent_cx: STEP_UP_AUTH]
                                    │
                               0.15 │
                                    ▼
  [state_fraud_score:0.72] ──────-->[DECISION: STEP_UP_AUTH]
           │                        ▲
      0.95 │                        │
           ▼                        │
  [agent_fraud: STEP_UP_AUTH] ──0.62┘
```

### 2.5 Observability Envelope

```
PER-TRACE OBSERVABILITY
╔════════════════════════════════════╗
║  TOKENS     input: 420             ║
║             output: 130            ║
║             cost: $0.0001          ║
╠════════════════════════════════════╣
║  LATENCY    mcp:      340ms  ████  ║
║             llm:      890ms  ██████║ ← bottleneck
║             agents:   120ms  ██    ║
║             decision:  45ms  █     ║
║             TOTAL:   1395ms        ║
╠════════════════════════════════════╣
║  ANOMALIES  [none] ✅              ║
╚════════════════════════════════════╝
```

---

## 3. Stack Technique

```
Framework:    Next.js 15 (App Router)
Language:     TypeScript 5 strict
Styling:      Tailwind CSS 3
Runtime:      Node.js 20+
Package:      npm

External APIs:
  - Loomi Connect MCP  → https://loomi-mcp-alpha.bloomreach.com/mcp
  - Bloomreach REST    → https://api.exponea.com
  - Bloomreach Sandbox → https://uqa.app.exponea.dev/p/silent-ukulele
  - PayPal Sandbox     → https://api-m.sandbox.paypal.com
  - OpenAI             → gpt-4o-mini (optional, mock mode available)
  - Firebase           → Realtime DB (optional, WS fallback)

Visualization:
  - WebGL (GLSL shaders) particle system - 3000+ points
  - Canvas2D fallback
  - Web Audio API (zero dependencies)
```

---

## 4. Structure des Fichiers

```
loomiflow/
├── app/
│   ├── cockpit/page.tsx          ← Main dashboard (4 views: cockpit/arena/trace/traffic)
│   ├── api/
│   │   ├── decision/route.ts     ← POST: run full agent pipeline
│   │   ├── simulate/route.ts     ← POST: demo scenarios
│   │   ├── health/route.ts       ← GET: all connections status
│   │   ├── mcp-test/route.ts     ← GET: MCP tools list
│   │   └── paypal-webhook/route.ts ← POST: PayPal events
│   ├── globals.css               ← Global styles + panel-glass
│   └── layout.tsx
│
├── components/
│   ├── cockpit/
│   │   ├── AgentGrid.tsx         ← 3 agent cards + orchestrator
│   │   ├── DecisionDebugger.tsx  ← Drawer: Timeline/Memory/Agents/MCP/Graph/Writes
│   │   ├── ObservabilityMiniPanel.tsx ← Token cost + latency bars
│   │   ├── TimeHeatmap.tsx       ← Cinematic replay heatmap
│   │   ├── EventStream.tsx       ← Live event feed
│   │   ├── ActionPanel.tsx       ← Decision actions
│   │   ├── CanaryStatusPanel.tsx ← SRE canary status
│   │   ├── DecisionOrderBook.tsx ← Bloomberg-style order book
│   │   ├── LoadTestPanel.tsx     ← Load test controls
│   │   ├── MCPStatusCard.tsx     ← MCP connection status
│   │   ├── AIConfidenceMeter.tsx ← Confidence gauge
│   │   ├── StatusBar.tsx         ← Top system bar
│   │   └── HeartbeatBackground.tsx
│   └── visualization/
│       ├── GPUCockpit.tsx        ← WebGL particle system
│       ├── AgentArenaPanel.tsx   ← Adversarial arena
│       ├── TrafficSplitPanel.tsx ← Traffic lane monitor
│       ├── MCPTraceGraph.tsx     ← LangSmith-style trace
│       ├── ElectricBeams.tsx     ← SVG animated beams
│       └── FlowOverlay.tsx       ← Canvas flow particles
│
├── core/
│   ├── agents/
│   │   ├── orchestrator.ts       ← Full pipeline + SRE logging
│   │   ├── fraudAgent.ts         ← Fraud detection (w=0.62)
│   │   ├── revenueAgent.ts       ← Revenue optimization (w=0.23)
│   │   ├── cxAgent.ts            ← Customer experience (w=0.15)
│   │   ├── arenaEngine.ts        ← Live adversarial dynamics
│   │   └── arenaAgents.ts        ← Arena agent definitions
│   ├── mcp/
│   │   ├── traceGraph.ts         ← Causal graph builder
│   │   └── reasoning.ts          ← MCP reasoning chain
│   ├── sre/
│   │   ├── trafficController.ts  ← PROD/CANARY/SHADOW split
│   │   └── rollback.ts           ← Auto-rollback on SLO breach
│   └── shared/
│       └── types.ts              ← ALL TypeScript interfaces
│
├── lib/
│   ├── agentEngine.ts            ← Mock agent outputs generator
│   ├── gpuDecisionMapping.ts     ← Decision → WebGL params
│   ├── heartbeat.ts              ← System health score
│   ├── loadTestSimulator.ts      ← Load test scenarios
│   ├── mockEvents.ts             ← Demo events (5 scenarios)
│   ├── orderBookEngine.ts        ← Bloomberg order book engine
│   ├── incidentReconstructor.ts  ← [V2] Trace DAG → root cause
│   ├── memoryGraph.ts            ← [V2] Influence weight graph
│   ├── observabilityEnvelope.ts  ← [V2] Token cost + latency
│   ├── retryEngine.ts            ← [V2] Exponential backoff
│   ├── replayBuffer.ts           ← [V2] Netflix-style replay
│   └── audioEngine.ts            ← [V2] Web Audio synth alerts
│
├── server/
│   ├── mcp/client.ts             ← MCP HTTP client + cache
│   ├── bloomreach/writeApi.ts    ← REST write operations
│   ├── paypal/client.ts          ← PayPal OAuth + webhooks
│   ├── websocket/gateway.ts      ← WS broadcast server
│   └── firebase/sync.ts          ← Firebase fallback
│
├── hooks/
│   └── useCockpit.ts             ← React state + WS connection
│
├── public/shaders/
│   ├── points.vert.glsl          ← Vertex shader (particle pos)
│   └── heatmap.frag.glsl         ← Fragment shader (glow + tint)
│
├── scripts/
│   ├── test-connections.ts       ← All external connections
│   ├── test-agents.ts            ← [V2] Agent unit tests
│   ├── test-pipeline.ts          ← [V2] E2E pipeline test
│   └── test-observability.ts     ← [V2] V2 modules test
│
├── docs/
│   ├── ARCHITECTURE.md           ← [V2] Full arch diagrams
│   ├── AGENTS_GUIDE.md           ← [V2] Agent deep-dive
│   ├── MCP_GUIDE.md              ← [V2] MCP tools + patterns
│   ├── DEMO_SCRIPT.md            ← Hackathon demo 5-min script
│   ├── TRACK6_ALIGNMENT.md       ← Track 6 criteria mapping
│   └── MCP_INTEGRATION.md        ← MCP integration notes
│
├── local-proofs/                 ← 🔒 LOCAL ONLY - proof files
├── local-prints/                 ← 🔒 LOCAL ONLY - console logs
├── .env.local                    ← 🔒 LOCAL ONLY - credentials
├── .gitignore                    ← covers local-* and .env.local
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 5. Variables d'Environnement

### `.env.local` - Template complet

```bash
# ══════════════════════════════════════════════════════
# LOOMIFLOW AI - ENVIRONMENT - NE PAS COMMITTER
# ══════════════════════════════════════════════════════

# ── BLOOMREACH ENGAGEMENT ─────────────────────────────
BLOOMREACH_ENGAGEMENT_URL=https://uqa.app.exponea.dev/p/silent-ukulele
BLOOMREACH_PROJECT_TOKEN=silent-ukulele
BLOOMREACH_API_BASE=https://api.exponea.com
BLOOMREACH_STOREFRONT_URL=https://sandbox-sales11.bloomreach.com/silent-ukulele

# ── LOOMI CONNECT MCP ─────────────────────────────────
# ⚠️  SANS trailing slash (confirmation officielle Saurav Saxenna @here May 27)
MCP_URL=https://loomi-mcp-alpha.bloomreach.com/mcp
MCP_CONVERSATION_URL=https://uqa.api.exponea.dev/cocoaas/public/api/clarity-search/v1/mcp/019d4917-3c76-7479-9f00-06c620b231bb

# ── BLOOMREACH WRITE CREDENTIALS ──────────────────────
# Obtenir depuis: Bloomreach UI > Settings > Access Management > API
LOOMI_PROJECT_ID=           # UUID visible dans l'URL Bloomreach
BLOOMREACH_API_TOKEN=        # Permissions: Customer properties Set + Campaigns API trigger

# ── PAYPAL SANDBOX ────────────────────────────────────
PAYPAL_SANDBOX_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_CLIENT_ID=AeNqNMpYM3nqGukeGid07QCdAhO0vlPilLzx_H6Or0by2q9Q-AtcyhIf6NtLlx3Tm-krgQQ98vuzPo1u
PAYPAL_CLIENT_SECRET=EPTzHHkDOFO6CLAht4O5POy92Tbk4cdjZp2U-67FDnPofK_gwuXnTo55Ne6CwOSNkjgr5vVpaTLNwpnlI
PAYPAL_PERSONAL_ACCOUNT_ID=FLHWH8L3UG4PN
PAYPAL_PERSONAL_EMAIL=sb-bjh9x51322925@personal.example.com
PAYPAL_BUSINESS_ACCOUNT_ID=JSSMJG3ZP668G
PAYPAL_BUSINESS_EMAIL=sb-qa43lx51322931@business.example.com

# ── OPENAI (optionnel - mock mode disponible) ─────────
OPENAI_API_KEY=             # Laisser vide → USE_MOCK_AGENTS=true automatique

# ── APP ───────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NODE_ENV=development
USE_GCP_PUBSUB=false
USE_MOCK_AGENTS=true         # false = appels OpenAI réels

# ── FIREBASE (optionnel - fallback WS) ────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
```

### Variables critiques à vérifier

| Variable | Requis | Valeur si manquante |
|---|---|---|
| `MCP_URL` | ✅ Oui | MCP context désactivé |
| `PAYPAL_CLIENT_ID` | ✅ Oui | Webhooks ignorés |
| `BLOOMREACH_PROJECT_TOKEN` | ✅ Oui | Sandbox inaccessible |
| `BLOOMREACH_API_TOKEN` | ⚠️ Writes | Writes skipped, reads OK |
| `LOOMI_PROJECT_ID` | ⚠️ Writes | Writes skipped |
| `OPENAI_API_KEY` | ❌ Non | Mock mode (excellent pour démo) |

---

## 6. Bootstrap from Scratch

### Étape 1 - Cloner et installer

```bash
git clone <repo-url> loomiflow
cd loomiflow
npm install
```

### Étape 2 - Configurer l'environnement

```bash
cp .env.example .env.local
# Editer .env.local avec les credentials ci-dessus
```

### Étape 3 - Vérifier toutes les connexions

```bash
npm run test:connections
# Output attendu:
# ✅ MCP_URL
# ✅ PAYPAL_CLIENT_ID
# ✅ BLOOMREACH_ENGAGEMENT_URL
# ✅ 12 MCP tools found
# ✅ PayPal token obtained in 432ms
```

### Étape 4 - Lancer le dev server

```bash
npm run dev
# Puis ouvrir: http://localhost:3000/cockpit
```

### Étape 5 - Tester les agents

```bash
npx tsx scripts/test-agents.ts
npx tsx scripts/test-pipeline.ts
npx tsx scripts/test-observability.ts
```

### Étape 6 - Configurer MCP pour Claude

```bash
# ✅ CORRECT (mcp-remote, sans trailing slash)
claude mcp add loomi-mcp -- npx -y mcp-remote https://loomi-mcp-alpha.bloomreach.com/mcp

# ❌ INCORRECT (ne pas utiliser --transport http)
# claude mcp add loomi-mcp --transport http https://...
```

### Étape 7 - Trigger de démo

```bash
# Via curl:
curl -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"scenario": "vipPaymentFailure"}'

# Scénarios disponibles:
# vipPaymentFailure | highFraudLowLTV | cartAbandonment
# conversionAnomaly | normalTransaction
```

---

## 7. Modules Core - Code complet

### 7.1 Types centraux (core/shared/types.ts)

Les types clés à connaître:

```typescript
// Entrée du système
interface CommerceEvent {
  id: string; type: CommerceEventType; timestamp: number
  customerId: string; value?: number; fraudScore?: number
  mcpContext?: MCPCustomerContext; paypalData?: PayPalEventData
}

// Sortie complète du pipeline
interface DecisionTrace {
  id: string; transactionId: string
  timeline: TraceEntry[]       // spans du pipeline
  agents: { fraud, revenue, cx }
  orchestrator: OrchestratorDecision
  finalDecision: string        // BLOCK|ALLOW|HOLD|STEP_UP_AUTH|THROTTLE
  confidence: number           // 0–1
  mcpContextSources: string[]  // outils MCP utilisés
  writeActions?: WriteActionResult[]
  observability?: ObservabilityEnvelope  // [V2] tokens, cost, latency
  memoryGraph?: AgentMemoryGraph         // [V2] influence weights
  timestamp: number
}

// Consensus weights (constants)
const WEIGHTS = { fraud: 0.62, revenue: 0.23, cx: 0.15 }
```

### 7.2 Orchestrator Rules (core/agents/orchestrator.ts)

```typescript
// Règle 1 - Safety first
if (fraud.fraudScore > 0.85 && revenue.customerLTV < 500)
  → BLOCK

// Règle 2 - VIP protection (Peter Centgraf pattern)
if (fraud.fraudScore > 0.60 && revenue.customerLTV > 1000)
  → STEP_UP_AUTH

// Règle 3 - Revenue recovery
if (fraud.fraudScore < 0.40 && revenue.revenueAtRisk > 200)
  → ALLOW

// Règle 4 - Mixed signals
else → HOLD

// Confidence
confidence = 0.62*fraud.confidence + 0.23*revenue.confidence + 0.15*cx.confidence
```

### 7.3 MCP Client pattern (server/mcp/client.ts)

```typescript
// Auth: OAuth2 PKCE via mcp-remote proxy
// Direct HTTP call pattern:
const response = await fetch(process.env.MCP_URL!, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    id: 1,
    params: { name: "get_customer_properties", arguments: { customerId } }
  })
})
```

### 7.4 Bloomreach Write pattern (server/bloomreach/writeApi.ts)

```typescript
// Pattern confirmé Paul Edwards (Bloomreach):
// 1. Marquer recovery
await updateCustomerProperty(customerId, { recovery_initiated: true })
// 2. Trigger scenario
await trackCustomerEvent(customerId, "payment_recovery_triggered", { decision, revenueAtRisk })
// → Bloomreach scenario → Mailgun → email client
```

### 7.5 V2 Observability (lib/observabilityEnvelope.ts)

```typescript
const envelope = buildObservabilityEnvelope(trace)
// envelope.tokens.costUsd    → ex: 0.0001 USD
// envelope.latency.bottleneck → "llm" | "mcp" | "agents" | "decision"
// envelope.anomalies          → ["HIGH_LATENCY"] si > 5000ms
```

### 7.6 V2 Memory Graph (lib/memoryGraph.ts)

```typescript
const graph = buildAgentMemoryGraph(trace)
const explanation = explainAgentDecision(graph, trace.finalDecision)
// explanation.topDrivers[0].node     → "Fraud Score: 72%"
// explanation.topDrivers[0].influence → "0.95"
// explanation.confidenceSummary      → "87% orchestrator confidence..."
```

### 7.7 V2 Incident Reconstructor (lib/incidentReconstructor.ts)

```typescript
const incident = reconstructIncidentFromTrace(trace)
// incident?.type      → "FRAUD_SPIKE" | "MCP_LATENCY" | ...
// incident?.severity  → 0–100
// incident?.narrative → "Fraud detection subsystem flagged..."
// incident?.rootCause → SpanNode avec latencyMs, service, name
```

### 7.8 V2 Audio Engine (lib/audioEngine.ts)

```typescript
// Client-side seulement (guard typeof window)
await unlockAudio()              // appeler sur user gesture
playForEvent("BLOCK")            // → siren critique
playForEvent("ALLOW")            // → chirp success
playForEvent("MCP_TICK")         // → tick haute freq
playForEvent("ROLLBACK")         // → thud grave
```

---

## 8. API Routes

| Route | Method | Body | Response |
|---|---|---|---|
| `/api/decision` | POST | `CommerceEvent` | `{ success, trace: DecisionTrace }` |
| `/api/simulate` | POST | `{ scenario: string }` | `{ success, scenario, trace }` |
| `/api/health` | GET | - | `{ mcp, paypal, bloomreach, overall }` |
| `/api/mcp-test` | GET | - | `{ tools: string[], count }` |
| `/api/paypal-webhook` | POST | PayPal payload | `{ processed }` |

### Print statements attendus dans la console serveur

```
[PIPELINE] Starting for event: evt_xxx type=payment_failed
[ORCHESTRATOR][START] {"fraud":"BLOCK","revenue":"ALLOW","cx":"HOLD"}
[ORCHESTRATOR][DECISION] {"final":"STEP_UP_AUTH","confidence":0.87}
[PIPELINE] Complete in 1234ms - Decision: STEP_UP_AUTH (87% confidence)
[BLOOMREACH_WRITE] updateCustomerProperty → cust_xxx
[BLOOMREACH_WRITE] trackCustomerEvent → payment_recovery_triggered
```

---

## 9. Pipeline de décision - Decision Flow

```
PIPELINE TIMELINE (exemple VIP Payment Failure)
═══════════════════════════════════════════════

T+0ms    COMMERCE_EVENT_RECEIVED        [event]
T+10ms   MCP_CONTEXT_FETCH_START        [mcp]
T+350ms  MCP_CONTEXT_FETCH_COMPLETE     [mcp]   ← 340ms pour 6 tools
T+351ms  AGENTS_STARTED_PARALLEL        [agent]
         │
         ├─ fraud agent  ─────────────────────── 890ms (slowest)
         ├─ revenue agent ────────────────────── 620ms
         └─ cx agent ─────────────────────────── 510ms
         │
T+1241ms ALL_AGENTS_COMPLETE            [agent]  ← max(890,620,510) = 890ms
T+1242ms CONSENSUS_ENGINE_START         [consensus]
T+1287ms CONSENSUS_ENGINE_COMPLETE      [consensus] ← 45ms
T+1290ms BLOOMREACH_WRITE_START         [write]
T+1540ms BLOOMREACH_WRITE_COMPLETE      [write]  ← 250ms
T+1541ms FINAL_DECISION: STEP_UP_AUTH  [decision]

TOTAL: ~1541ms
Observability: { bottleneck: "llm", cost: "$0.0001", anomalies: [] }
```

---

## 10. Visualisation Layer

### 10.1 Vue COCKPIT (défaut)

```
┌────────────────────────────────────────────────────────────┐
│ StatusBar ─ Connected ● WS │ FRAUD_SPIKE │ 47 events       │
├────────────────────────────────────────────────────────────┤
│ [COCKPIT] [ARENA] [TRACE] [TRAFFIC]                        │
├────────────┬──────────────────────┬───────────────────────┤
│ EventStream│    AgentGrid         │ AIConfidenceMeter      │
│ (live feed)│  ┌──────────────┐   │ ████████░░ 87%         │
│            │  │ FRAUD  AGENT │   ├───────────────────────┤
│ LoadTest   │  │ BLOCK  0.72  │   │ ActionPanel            │
│ Panel      │  │ REVENUE AGENT│   │ → Send retry link      │
│            │  │ ALLOW  €1250 │   │ → Apply 10% discount   │
│ MCPStatus  │  │ CX AGENT     │   ├───────────────────────┤
│ 12 tools ✅│  │ STEP UP 0.8  │   │ DecisionOrderBook      │
│            │  └──────────────┘   │ BLOCK ██ 1             │
│            │  TimeHeatmap        │ HOLD  ███ 2            │
│            │  CanaryPanel        │ ALLOW ████████ 7       │
│            │  DecisionDebugger   ├───────────────────────┤
│            │  [🔍 Inspect...]    │ ObservabilityMini      │
│            │                     │ 1395ms │ $0.0001       │
└────────────┴─────────────────────┴───────────────────────┘
```

### 10.2 Vue ARENA

```
┌─────────────────────────────────────────────────────────────┐
│  AGENT ARENA - Live adversarial force fields                 │
│                                                              │
│     ◉ FRAUD (w=0.62)    ◉ REVENUE (w=0.23)                  │
│      72% intensity       45% intensity                       │
│                                                              │
│              ⚡ CONFLICT ZONE ⚡                              │
│         → Orchestrator resolving tradeoff                    │
│              ← STEP_UP_AUTH →                                │
│                                                              │
│     ◉ CX (w=0.15)                                           │
│      80% churn risk                                          │
└─────────────────────────────────────────────────────────────┘
```

### 10.3 Vue TRACE (LangSmith-style)

```
MCP TRACE GRAPH
───────────────────────────────────────────────
[Event] payment_failed
   ├-> [MCP] get_customer_properties   340ms ✅
   │       └-> tier: VIP, LTV: €1250
   ├-> [MCP] get_customer_prediction_score 480ms ✅
   │       └-> churnRisk: HIGH, score: 0.78
   ├-> [FRAUD AGENT]  score: 0.72  → STEP_UP_AUTH
   ├-> [REVENUE AGENT] ltv: 1250  → ALLOW
   ├-> [CX AGENT]  churn: high    → STEP_UP_AUTH
   └-> [ORCHESTRATOR] → STEP_UP_AUTH (87% conf)
           └-> [WRITE] trackCustomerEvent ✅
```

---

## 11. SRE Layer - Résilience

### Modules SRE

```typescript
// core/sre/trafficController.ts
updateTrafficSplit({ prod: 85, canary: 10, shadow: 5 })

// core/sre/rollback.ts - déclenchement auto
if (fraud_rate > 0.30 || error_rate > 0.05) {
  rollbackCanary()  // → prod: 100, canary: 0, shadow: 0
  logToSRE("CANARY_ROLLBACK", { reason, severity })
}

// lib/retryEngine.ts
await withMCPRetry(() => fetchCustomerContext(id))
// → 3 attempts, 500ms base, full jitter

// lib/replayBuffer.ts
globalReplayBuffer.push(trace)
await globalReplayBuffer.replay(onTrace, "2x")  // Netflix replay
```

### Logs SRE

```
local-prints/sre-decisions.log (JSONL, local only):
{"ts":"2026-05-30T03:14:22Z","traceId":"trace_evt_xxx","incidentType":"FRAUD_SPIKE","severity":65,"rootCause":"fraud_agent_analysis","narrative":"Fraud detection...","decision":"BLOCK"}
```

---

## 12. Tests & Debug

### Tests disponibles

```bash
npm run test:connections    # Toutes les connexions externes
npx tsx scripts/test-agents.ts        # Unit tests agents
npx tsx scripts/test-pipeline.ts      # E2E pipeline (5 scénarios)
npx tsx scripts/test-observability.ts # V2 modules (envelope, graph, retry)
```

### Print statements clés à surveiller

| Console | Signification | Action si absent |
|---|---|---|
| `[PIPELINE] Starting for event:` | Pipeline lancé | Vérifier /api/decision |
| `[MCP] Fetching customer context` | MCP actif | Vérifier MCP_URL |
| `[ORCHESTRATOR][DECISION]` | Decision prise | Normal flow |
| `[BLOOMREACH_WRITE]` | Write exécuté | Vérifier BLOOMREACH_API_TOKEN |
| `[COCKPIT] WebSocket connected` | WS OK | WS server lancé ? |
| `[RETRY]` | Retry en cours | Check latence MCP |

### Debug MCP (test curl)

```bash
# Test direct MCP sans trailing slash:
curl -X POST https://loomi-mcp-alpha.bloomreach.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1,"params":{}}'

# Si 401: OAuth PKCE requis → utiliser mcp-remote
npx -y mcp-remote https://loomi-mcp-alpha.bloomreach.com/mcp
```

### Erreurs connues et solutions

| Erreur | Cause | Solution |
|---|---|---|
| `404 on MCP` | Trailing slash | Enlever le `/` final |
| `401 Unauthorized` | No PKCE token | `npx -y mcp-remote <url>` |
| `WS not connecting` | Port 8080 occupé | `lsof -i :8080 && kill -9 PID` |
| `Build failed: fs/path` | Next.js browser bundle | `next.config.js` webpack externals |
| `[PIPELINE] MCP fetch failed` | Network / auth | Mock mode: `USE_MOCK_AGENTS=true` |

---

## 13. Demo Script (5 minutes)

```
00:00 - Ouvrir /cockpit → "Voici ACOA, le cockpit de Commerce Ops"
00:30 - Cliquer "🚨 VIP Payment Failure"
         → Montrer: 3 agents s'allument en parallèle
         → Montrer: STEP_UP_AUTH avec 87% confidence
         → Montrer: Audio alert (🔊)
01:30 - Ouvrir Decision Debugger → tab MEMORY
         → "Voici comment l'IA a décidé - influence weights"
         → "Le fraud score à 72% pèse 62%, le LTV €1250 pèse 23%"
02:00 - Aller sur ARENA view
         → "Les 3 agents s'affrontent en temps réel"
         → Cliquer "⚡ Fraud Storm" → Arena s'emballe
02:30 - Aller sur TRACE view
         → "Voici l'équivalent LangSmith mais pour du commerce"
         → "Chaque MCP tool call tracé avec latence"
03:00 - Aller sur TRAFFIC view
         → "SRE layer: 85% prod, 10% canary, 5% shadow"
         → "Rollback auto si fraud rate > 30%"
03:30 - Montrer ObservabilityMiniPanel
         → "Coût par décision: $0.0001 - scalable à 1M événements/jour"
04:00 - "Read loop: 6 MCP tools → Write loop: trackCustomerEvent → Mailgun"
04:30 - "C'est ça Track 6: 3 MCP surfaces + orchestration + write-back complet"
05:00 - Questions
```

---

## 14. Proof of Capture

### Items capturés dans ce MASTER_BUILD_GUIDE V2

| # | Item | Source | Statut |
|---|---|---|---|
| 1 | Architecture complète ASCII | Parts 1-6 + E1-E7 | ✅ §2 |
| 2 | Decision matrix fraud*LTV | Parts 3+E4 | ✅ §2.2 |
| 3 | Consensus weights 62/23/15 | E6 | ✅ §2.1 |
| 4 | MCP URL sans trailing slash | E6 (Saurav @here) | ✅ §5+§12 |
| 5 | OAuth2 PKCE via mcp-remote | E7 (Ard+Dima) | ✅ §6 |
| 6 | Write pattern Paul Edwards | E2+E3 | ✅ §2.1+§7.4 |
| 7 | Credentials sandbox complets | E2 | ✅ §5 |
| 8 | STEP_UP_AUTH VIP pattern | E4 (Peter Centgraf) | ✅ §2.2+§7.2 |
| 9 | Memory graph (E7 spec) | E7 | ✅ §2.4+§7.6 |
| 10 | Observability envelope | E7 | ✅ §2.5+§7.5 |
| 11 | Incident reconstructor | E7 | ✅ §7.7 |
| 12 | Retry engine | E3 | ✅ §7+§11 |
| 13 | Replay buffer 1x/2x/5x/10x | E4 | ✅ §11 |
| 14 | Audio engine (Web Audio API) | E5 | ✅ §7.8 |
| 15 | WebGL particle system | E4 | ✅ §10 |
| 16 | Agent Arena adversarial | E4 | ✅ §10.2 |
| 17 | Traffic split SRE | E3 | ✅ §11 |
| 18 | SRE logs local-prints | E5 | ✅ §11 |
| 19 | Bootstrap from scratch | Prompt original | ✅ §6 |
| 20 | Demo script 5 min | Parts 4+E1 | ✅ §13 |
| 21 | Print statements debug | Prompt original | ✅ §12 |
| 22 | Tests connexions | E2 | ✅ §12 |
| 23 | Track 6 alignment | E1 | ✅ §1 |
| 24 | File tree complet | Global | ✅ §4 |
| 25 | Tous les env vars | E2 | ✅ §5 |

**Score: 25/25 items capturés ✅**

---

*LOOMIFLOW AI V2 - MASTER BUILD GUIDE - May 30, 2026*  
*loomiflow/MASTER_BUILD_GUIDE.md*
