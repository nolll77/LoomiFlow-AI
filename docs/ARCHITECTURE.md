# 🏛️ LoomiFlow AI — Architecture Guide

**Loomi Connect AI Hackathon 2026**  
Ce document détaille l'architecture complète de l'Autonomous Commerce Operations Agent (ACOA).

---

## 1. Full Stack Architecture

```text
╔═══════════════════════════════════════════════════════════════════════╗
║                    LOOMIFLOW AI — FULL STACK ARCHITECTURE             ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║   EXTERNAL TRIGGERS                                                   ║
║   ┌─────────────┐   ┌──────────────┐   ┌─────────────────────┐      ║
║   │ PayPal      │   │ Demo Button  │   │ Load Test           │      ║
║   │ Webhook     │   │ /api/simulate│   │ Simulator           │      ║
║   └──────┬──────┘   └──────┬───────┘   └──────────┬──────────┘      ║
║          │                 │                       │                  ║
║          └─────────────────┴───────────────────────┘                 ║
║                            │                                          ║
║                            ▼                                          ║
║   ┌────────────────────────────────────────────────────────────────┐ ║
║   │                  COMMERCE EVENT NORMALIZER                     │ ║
║   │  payment_failed | cart_abandonment | fraud_detected | vip_at_risk│║
║   └────────────────────────┬───────────────────────────────────────┘ ║
║                            │                                          ║
║                            ▼                                          ║
║   ┌────────────────────────────────────────────────────────────────┐ ║
║   │              LOOMI CONNECT MCP — READ PHASE                    │ ║
║   │  https://loomi-mcp-alpha.bloomreach.com/mcp (NO trailing /)    │ ║
║   │                                                                │ ║
║   │  get_customer_properties ──► tier, LTV, segments               │ ║
║   │  get_customer_prediction_score ──► churn_risk, engage_score    │ ║
║   │  list_customer_events ──► infer journey state & patterns       │ ║
║   │  execute_analytics ──► funnel metrics, conversion rate         │ ║
║   │  get_api_trigger ──► identify write-back scenario URL          │ ║
║   └────────────────────────┬───────────────────────────────────────┘ ║
║                            │ MCPCustomerContext                       ║
║                            ▼                                          ║
║   ┌────────────────────────────────────────────────────────────────┐ ║
║   │              MULTI-AGENT PARALLEL ENGINE                       │ ║
║   │                                                                │ ║
║   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │ ║
║   │  │ FRAUD AGENT  │  │REVENUE AGENT │  │   CX AGENT   │        │ ║
║   │  │   w=0.62     │  │   w=0.23     │  │   w=0.15     │        │ ║
║   │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │ ║
║   │         │                 │                   │                │ ║
║   │         └─────────────────┴───────────────────┘                │ ║
║   │                           │ Promise.all()                       │ ║
║   └───────────────────────────┼────────────────────────────────────┘ ║
║                               │                                       ║
║                               ▼                                       ║
║   ┌────────────────────────────────────────────────────────────────┐ ║
║   │                    ORCHESTRATOR ENGINE                         │ ║
║   │                                                                │ ║
║   │  RULE 1: fraud>0.85 + ltv<500  ──────────────► BLOCK          │ ║
║   │  RULE 2: fraud>0.60 + ltv>1000 ──────────────► STEP_UP_AUTH   │ ║
║   │  RULE 3: fraud<0.40 + revenue>200 ────────────► ALLOW         │ ║
║   │  RULE 4: else ────────────────────────────────► HOLD          │ ║
║   └────────────────────────────────────────────────────────────────┘ ║
║                               │                                       ║
║          ┌────────────────────┼─────────────────────┐                ║
║          │                   │                      │                 ║
║          ▼                   ▼                      ▼                 ║
║   [OBSERVABILITY]    [MEMORY GRAPH]       [INCIDENT RECONSTRUCTOR]   ║
║   tokens, cost,      influence weights,   DAG, root-cause,           ║
║   latency breakdown  top drivers          narrative, severity/100    ║
║          │                   │                      │                 ║
║          └────────────────────┴─────────────────────┘                ║
║                               │                                       ║
║                               ▼                                       ║
║   ┌────────────────────────────────────────────────────────────────┐ ║
║   │              BLOOMREACH WRITE PHASE                            │ ║
║   │  1. updateCustomerProperty ──► recovery_initiated = true       │ ║
║   │  2. trackCustomerEvent ──────► fire Bloomreach scenario        │ ║
║   │  3. Bloomreach scenario ─────► Mailgun → customer email        │ ║
║   └────────────────────────────────────────────────────────────────┘ ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

## 2. Multi-Agent Engine

```text
Weights Allocation:
FRAUD ─── 62% (Priority: Safety & Risk Management)
REVENUE ─ 23% (Priority: Business Continuity & LTV)
CX ────── 15% (Priority: Frictionless User Experience)
```

The agents evaluate the context synchronously and provide an action (`BLOCK`, `ALLOW`, `HOLD`, `STEP_UP_AUTH`) paired with a confidence score and reasoning chain. The orchestrator resolves conflicts based on predefined logic (e.g. VIP Protection Pattern).

---

## 3. SRE Layer & Observability (V2)

### 3.1 Traffic Split
```text
PROD: 85%  |  CANARY: 10%  |  SHADOW: 5%
Auto-Rollback Triggered if: fraud_rate > 30% OR error_rate > 5%
```

### 3.2 Memory Graph (Explainability)
Every decision is mapped into a Directed Acyclic Graph (DAG) indicating the influence weights of observations and states leading to the final orchestrator output.
```text
[Observation] --0.9--> [State] --0.85--> [Agent] --0.62--> [Decision]
```

### 3.3 Observability Envelope
Metrics tracked per trace:
- **Tokens/Cost**: Tracks input/output token usage.
- **Latency Bottleneck**: Tracks `mcp`, `agents`, `llm`, `decision` latency.
- **Anomalies**: Flags for extreme latency or malformed data.

### 3.4 Replay Buffer
A circular buffer containing past decisions that can be replayed in the UI at `1x`, `2x`, `5x`, or `10x` speeds for debugging and demonstration.

---

## 4. Components

| Component | Role |
|-----------|------|
| `core/agents/` | AI execution logic (Fraud, Revenue, CX, Orchestrator). |
| `core/sre/` | Resiliency layer (Traffic Control, Rollback, Kill Switch). |
| `lib/` | V2 SRE observability, audio engines, memory graph, replay buffer. |
| `server/mcp/` | Direct Loomi MCP HTTP client and cache. |
| `server/bloomreach/` | Bloomreach REST write APIs. |
| `components/visualization/` | WebGL GPU particle systems and animated trace SVGs. |

---

## 💡 Note Pour les Juges
Cette architecture illustre parfaitement les exigences du **Track 6** en combinant des appels d'outils analytiques complexes, l'extraction de contextes cross-surface (Marketing, Journeys, Analytics) via le **Loomi Connect MCP**, l'évaluation multi-agents avec SRE SRE/Observabilité avancée, et l'intégration de boucle d'écriture (write-back) via les API de Bloomreach. 

## 📝 Proof of Capture
- Diagrammes ASCII complets de l'architecture
- Matrice de poids multi-agent
- SRE Layer et outils V2 (observability, memory graph, replay buffer)
- Tables des composants
- Argumentaire juge Track 6
