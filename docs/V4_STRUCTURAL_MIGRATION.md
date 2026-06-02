# LoomiFlow — Plan de migration structurelle V3→V4

> **Statut actuel (juin 2026)** : V4 fonctionnel mais en couche sur V3.  
> Ce document est le plan complet pour faire la migration structurelle propre.  
> Auteur : session Antigravity, vérification code réel.

---

## Diagnostic exact de la dette technique actuelle

### Ce qui existe réellement dans le code

#### 1. `DecisionTrace.agents` — union type instable

```typescript
// core/shared/types.ts — état actuel
agents: {
  fraud:   FraudAgentOutput | Record<string, unknown>   // ← union cassée
  revenue: RevenueAgentOutput | Record<string, unknown>
  cx:      CXAgentOutput | Record<string, unknown>
}
```

**Problème** : `runPipelineV4` remplit `agents` avec des `AgentOpinion` castés en `Record<string, unknown>`. 
Les composants V3 (`AgentGrid`, `DecisionDebugger`, `ElectricBeams`, etc.) accèdent à `agents.fraud.fraudScore` via `as any`. 
C'est de la dette TypeScript pure — 11 fichiers avec `as any` résultant de ce mismatch.

#### 2. `DecisionTrace.orchestrator` — stub reconstitué à la main

```typescript
// core/agents/orchestrator.ts — dans runPipelineV4
orchestrator: {
  finalDecision: marketDecision.finalDecision,
  confidence: marketDecision.confidence,
  severity: "medium",                                          // ← hardcodé
  reasoning: [marketDecision.marketNarrative],
  actions: marketDecision.executionPlan.immediateActions.map(a => a.tool),
  consensusWeights: { fraud: 0.62, revenue: 0.23, cx: 0.15 }, // ← poids V3 figés
}
```

**Problème** : L'Opinion Market calcule des `utilityScores` dynamiques (ex: risk=0.847, revenue=0.623), mais 
`consensusWeights` reste figé à 0.62/0.23/0.15 — les poids V3 statiques.

#### 3. `runFullAgentPipeline` — dead code de 270 lignes

```typescript
// core/agents/orchestrator.ts lignes 165-260
export async function runFullAgentPipeline(...)  // plus appelé par les routes
```

**Encore appelé par** :
- `app/api/paypal-webhook/route.ts` ligne 21
- `scripts/test-observability.ts`
- `scripts/test-pipeline.ts`

#### 4. Types V3 orphelins — encore utilisés partout

| Type | Fichiers qui l'utilisent |
|---|---|
| `FraudAgentOutput` | `orchestrator.ts`, `orderBookEngine.ts`, `agentEngine.ts`, `lib/` |
| `RevenueAgentOutput` | `orchestrator.ts`, `orderBookEngine.ts`, `agentEngine.ts` |
| `CXAgentOutput` | `orchestrator.ts`, `orderBookEngine.ts`, `agentEngine.ts` |

#### 5. `consensusWeights` — champ anachronique

```typescript
// Dans DecisionTrace (types.ts ligne 159)
consensusWeights: { fraud: number; revenue: number; cx: number }

// Encore lu par :
// - hooks/useCockpit.ts ligne 117
// - components/cockpit/AgentGrid.tsx (barre de consensus)
// - core/mcp/traceGraph.ts ligne 121
// - scripts/test-agents.ts (assertion fraud !== 0.62)
```

#### 6. `agentsToOrders` — Order Book basé sur des types V3

```typescript
// lib/orderBookEngine.ts
export function agentsToOrders(
  fraud: FraudAgentOutput,    // ← attend V3
  revenue: RevenueAgentOutput,
  cx: CXAgentOutput,
  transactionId: string
): AgentOrder[]
```

**Problème** : Le DecisionOrderBook lit `agents.fraud` via `as any` pour l'alimenter.

---

## Architecture cible V4 native

### Nouveau `DecisionTrace` (type de référence)

```typescript
// core/shared/types.ts — cible V4 native

export interface DecisionTrace {
  // ── Identité ──────────────────────────────────────────────
  id: string
  transactionId: string
  timestamp: number

  // ── Décision finale ───────────────────────────────────────
  finalDecision: OrchestratorDecision["finalDecision"]
  confidence: number

  // ── V4 Brain (données primaires) ──────────────────────────
  state: CommerceKnowledgeState              // ← NOUVEAU : l'état complet
  councils: {
    risk:     CouncilProposal
    revenue:  CouncilProposal
    customer: CouncilProposal
  }
  marketDecision: MarketDecision             // ← utility scores réels
  executionPlan:  ExecutionPlan
  businessImpact: BusinessImpactSummary
  executiveSummary: string
  learningInsights: LearningInsights

  // ── Observabilité ─────────────────────────────────────────
  timeline:         TraceEntry[]
  mcpContextSources: string[]
  observability?:   ObservabilityEnvelope
  memoryGraph?:     AgentMemoryGraph
  counterfactuals?: Counterfactual[]

  // ── Intégrations ──────────────────────────────────────────
  paypalData?:    PayPalEventData
  writeActions?:  WriteActionResult[]

  // ── SUPPRIMÉ ──────────────────────────────────────────────
  // agents: { fraud, revenue, cx }         ← remplacé par councils
  // orchestrator: OrchestratorDecision     ← remplacé par marketDecision
  // consensusWeights                       ← remplacé par utilityScores
  // reasoning: string[]                    ← remplacé par marketNarrative
}
```

### Remplacement des types agents V3

```typescript
// Les AgentOpinion (V4) remplacent FraudAgentOutput/RevenueAgentOutput/CXAgentOutput

// AVANT (V3)
interface FraudAgentOutput extends AgentOutput {
  fraudScore: number
  behavioralAnomalies: string[]
  // ...
}

// APRÈS (V4) — AgentOpinion unifié, déjà défini dans agentTypes.ts
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
  // Champs legacy mappés depuis V3 (pour compatibilité memoryGraph etc.)
  fraudScore?: number      // ← du fraudAgent V4
  customerLTV?: number     // ← du revenueAgent V4
  churnRisk?: string       // ← du cxAgent V4
  latencyMs?: number       // ← mesuré par le council
}
```

### Nouveau `consensusWeights` → `utilityScores`

```typescript
// AVANT (V3) — poids statiques
consensusWeights: { fraud: 0.62, revenue: 0.23, cx: 0.15 }

// APRÈS (V4) — scores dynamiques de l'Opinion Market
utilityScores: {
  risk:     number   // ex: 0.847 (dynamique)
  revenue:  number   // ex: 0.623
  customer: number   // ex: 0.412
  winningCouncil: "risk" | "revenue" | "customer"
}
```

---

## Plan de migration — 8 phases ordonnées

### PHASE 0 — Préparation (aucun fichier cassé)
**Durée estimée : 30 min**

Créer une branche dédiée. Ne rien merger sur `main` avant la PHASE 7.

```bash
git checkout -b feat/v4-native-migration
```

Créer `core/shared/typesV4.ts` — le nouveau type `DecisionTrace` V4 natif.  
Il coexiste avec `types.ts` pendant toute la migration. Aucun fichier existant n'est modifié dans cette phase.

---

### PHASE 1 — Étendre `AgentOpinion` pour absorber les champs V3
**Durée estimée : 45 min**  
**Fichier : `core/shared/agentTypes.ts`**

Ajouter les champs legacy optionnels à `AgentOpinion` pour que les composants V3 qui lisent 
`fraudScore`, `customerLTV`, `churnRisk`, `latencyMs`, `score`, `agentName`, `recommendation`, `reasons` puissent 
fonctionner SANS `as any` une fois la migration faite.

```typescript
// core/shared/agentTypes.ts — extension de AgentOpinion

export interface AgentOpinion {
  // ── Champs V4 natifs ──────────────────────────────────────
  agentId: string
  recommendation: string
  confidence: number
  dataQuality: number
  reasoning: string[]
  expectedOutcome: AgentExpectedOutcome
  urgency: "critical" | "high" | "medium" | "low"
  requiredActions: ProposedAction[]
  dataQualityFlags?: string[]

  // ── Champs legacy mappés (V3 → V4 bridge) ────────────────
  // Ces champs sont remplis par les agents V4 pour compat descendante
  agentName?: string       // = agentId (pour DecisionDebugger)
  score?: number           // = confidence (pour AgentGrid, ElectricBeams)
  fraudScore?: number      // spécifique fraudAgent
  customerLTV?: number     // spécifique revenueAgent
  revenueAtRisk?: number   // spécifique revenueAgent
  churnRisk?: string       // spécifique cxAgent ("low"|"medium"|"high")
  latencyMs?: number       // mesuré par le council wrapper
  reasons?: string[]       // = reasoning (alias pour V3 UI)
  mcpSourcesUsed?: string[]
}
```

**Modifier les 3 agents V4** (`fraudAgent.ts`, `revenueAgent.ts`, `cxAgent.ts`) pour qu'ils remplissent 
ces champs legacy dans leur `AgentOpinion` :

```typescript
// core/agents/fraudAgent.ts — fonction fraudAgent V4 (à compléter)
export async function fraudAgent(state: CommerceKnowledgeState): Promise<AgentOpinion> {
  const fraudScore = state.fraud.enrichedFraudScore
  return {
    agentId: "fraud",
    agentName: "fraud",                 // ← legacy compat
    recommendation: fraudScore > 0.85 ? "BLOCK" : fraudScore > 0.5 ? "STEP_UP_AUTH" : "ALLOW",
    confidence: fraudScore,
    score: fraudScore,                  // ← legacy compat
    fraudScore,                         // ← legacy compat
    latencyMs: state.contextFetchLatencyMs,
    reasons: [...],                     // ← legacy compat = reasoning
    reasoning: [...],
    mcpSourcesUsed: state.mcpToolsUsed,
    // ...
  }
}
```

---

### PHASE 2 — Migrer `DecisionTrace.agents` vers `CouncilProposal.memberOpinions`
**Durée estimée : 1h**  
**Fichiers : `core/shared/types.ts`, `core/agents/orchestrator.ts`**

#### 2a. Modifier `DecisionTrace`

Remplacer le champ `agents` union par un accès direct aux `memberOpinions` du Risk Council :

```typescript
// core/shared/types.ts — MODIFICATION

export interface DecisionTrace {
  // ...
  
  // SUPPRIMÉ :
  // agents: { fraud: FraudAgentOutput | Record<string, unknown>, ... }
  
  // AJOUTÉ :
  councils: {
    risk:     CouncilProposal     // risk.memberOpinions contient fraud/revenue/cx AgentOpinions
    revenue:  CouncilProposal
    customer: CouncilProposal
  }
  
  // Helper computed (pour la compat des composants V3 pendant transition)
  // À supprimer en PHASE 5
  get agentFraud(): AgentOpinion | undefined   // = councils.risk.memberOpinions.find(o => o.agentId === "fraud")
  get agentRevenue(): AgentOpinion | undefined
  get agentCx(): AgentOpinion | undefined
}
```

> **Note** : TypeScript interfaces ne supportent pas les getters. Utiliser une **classe** ou une 
> **fonction helper** `getAgentFromTrace(trace, agentId)` qui sera importée dans les composants.

#### 2b. Helper d'accès

```typescript
// core/shared/traceHelpers.ts — NOUVEAU FICHIER

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

#### 2c. Modifier `runPipelineV4` dans `orchestrator.ts`

Supprimer le shim `agents: { fraud: {} as any, ... }` et retourner directement :

```typescript
// core/agents/orchestrator.ts — runPipelineV4, bloc return
return {
  ...partialTrace,
  // Plus de champ `agents` — supprimé
  councils: { risk: riskC, revenue: revenueC, customer: customerC },
  marketDecision,
  // ...
}
```

---

### PHASE 3 — Migrer `orchestrator` → `marketDecision`
**Durée estimée : 1h**  
**Fichiers : `core/shared/types.ts`, `core/agents/orchestrator.ts`, `core/mcp/traceGraph.ts`**

#### 3a. Supprimer `OrchestratorDecision` de `DecisionTrace`

```typescript
// AVANT
orchestrator: OrchestratorDecision
consensusWeights: { fraud: number; revenue: number; cx: number }
reasoning: string[]

// APRÈS
marketDecision: MarketDecision   // déjà typé, contient tout
// marketDecision.finalDecision
// marketDecision.confidence
// marketDecision.winningCouncil
// marketDecision.utilityScores  ← remplace consensusWeights
// marketDecision.marketNarrative ← remplace reasoning[0]
```

#### 3b. Adapter `AgentGrid` — barre de consensus

```typescript
// components/cockpit/AgentGrid.tsx — AVANT
const o = decision.orchestrator
<div style={{ width: `${o.consensusWeights.fraud * 100}%` }} />

// APRÈS (avec helper)
import { getConsensusWeights } from "@/core/shared/traceHelpers"
const weights = getConsensusWeights(decision)
<div style={{ width: `${weights.risk * 100}%` }} />
// Note : les labels deviennent "Risk" / "Revenue" / "Customer" au lieu de "Fraud" / "Revenue" / "CX"
```

#### 3c. Adapter `traceGraph.ts`

```typescript
// core/mcp/traceGraph.ts ligne 121 — AVANT
const w = trace.consensusWeights[a.id.split("_")[1] as keyof typeof trace.consensusWeights]

// APRÈS
const weights = getConsensusWeights(trace)
const w = weights[a.id.split("_")[1] as keyof typeof weights] ?? 0.3
```

#### 3d. Adapter `hooks/useCockpit.ts`

```typescript
// hooks/useCockpit.ts ligne 117 — AVANT
partialTrace.consensusWeights = msg.decision.consensusWeights

// APRÈS — plus de champ à setter, marketDecision contient tout
// Supprimer cette ligne
```

---

### PHASE 4 — Migrer les composants V3 (supprimer tous les `as any`)
**Durée estimée : 2h**  
**11 fichiers à modifier**

Pour chaque composant, remplacer les accès `as any` par les helpers de `traceHelpers.ts` :

#### `components/cockpit/AgentGrid.tsx`

```typescript
// AVANT
const agents = decision?.agents as any
<AgentCard agent={agents?.fraud ?? null} />

// APRÈS
import { getAgent } from "@/core/shared/traceHelpers"
const fraudAgent = decision ? getAgent(decision, "fraud") : null
<AgentCard agent={fraudAgent ?? null} />
```

**Note** : `AgentCard` doit accepter `AgentOpinion | null` à la place de `AgentOutput | null`.
Adapter son interface props.

#### `components/cockpit/AgentCard.tsx`

```typescript
// AVANT
interface Props { agent: AgentOutput | null; active: boolean }

// APRÈS
interface Props { agent: AgentOpinion | null; active: boolean }
// AgentOpinion contient score, agentName, recommendation, confidence — compat directe
```

#### `components/cockpit/DecisionDebugger.tsx`

```typescript
// AVANT
const agents = decision.agents as any
const fraudScore = agents?.fraud?.fraudScore

// APRÈS
import { getFraudScore, getAgent } from "@/core/shared/traceHelpers"
const fraudScore = getFraudScore(decision)
const fraudAgentOpinion = getAgent(decision, "fraud")
```

#### `components/cockpit/DecisionOrderBook.tsx`

```typescript
// AVANT
const agents = decision.agents as any
const orders = agentsToOrders(agents?.fraud, agents?.revenue, agents?.cx, ...)

// APRÈS (deux options)
// Option A : adapter agentsToOrders pour accepter AgentOpinion
// Option B : construire les ordres depuis councils directement
import { getAgent } from "@/core/shared/traceHelpers"
const fraudOp  = getAgent(decision, "fraud")
const revenueOp = getAgent(decision, "revenue")
const cxOp     = getAgent(decision, "cx")
const orders = agentsToOrders(fraudOp, revenueOp, cxOp, decision.transactionId)
```

#### `components/cockpit/CanaryStatusPanel.tsx`

```typescript
// APRÈS
import { getFraudScore, getAgent } from "@/core/shared/traceHelpers"
const fraudScore = getFraudScore(lastDecision)
const revenueAtRisk = getAgent(lastDecision, "revenue")?.revenueAtRisk ?? 0
```

#### `components/visualization/ElectricBeams.tsx`

```typescript
// APRÈS
import { getAgent, getFraudScore } from "@/core/shared/traceHelpers"
const fraud   = getAgent(decision, "fraud")
const revenue = getAgent(decision, "revenue")
const cx      = getAgent(decision, "cx")
const fraudScore = getFraudScore(decision)
```

#### `components/visualization/GPUCockpit.tsx`

```typescript
// APRÈS
import { getFraudScore } from "@/core/shared/traceHelpers"
{decision.finalDecision} · fraud {(getFraudScore(decision) * 100).toFixed(0)}%
```

#### `components/visualization/TrafficSplitPanel.tsx`

```typescript
// APRÈS
import { getFraudScore, getAgent } from "@/core/shared/traceHelpers"
fraudScore:    getFraudScore(lastDecision),
revenueImpact: getAgent(lastDecision, "revenue")?.revenueAtRisk ?? 0,
```

#### `lib/gpuDecisionMapping.ts`

```typescript
// APRÈS
import { getFraudScore } from "@/core/shared/traceHelpers"
const fraudScore = getFraudScore(trace)
const severity   = (trace.marketDecision?.finalDecision === "BLOCK" ? "critical" : "medium")
```

#### `lib/memoryGraph.ts`

```typescript
// APRÈS
import { getAgent, getFraudScore, getCustomerLTV, getChurnRisk } from "@/core/shared/traceHelpers"
const fraudScore  = getFraudScore(trace)
const ltv         = getCustomerLTV(trace)
const churnRisk   = getChurnRisk(trace)
const fraudOp     = getAgent(trace, "fraud")
const revenueOp   = getAgent(trace, "revenue")
const cxOp        = getAgent(trace, "cx")
```

#### `lib/counterfactualEngine.ts`, `lib/incidentReconstructor.ts`, `lib/observabilityEnvelope.ts`

```typescript
// Pattern identique : remplacer agents as any par les helpers typés
import { getFraudScore, getCustomerLTV, getAgent } from "@/core/shared/traceHelpers"
```

---

### PHASE 5 — Migrer `lib/orderBookEngine.ts` pour accepter `AgentOpinion`
**Durée estimée : 30 min**

```typescript
// lib/orderBookEngine.ts — AVANT
import { FraudAgentOutput, RevenueAgentOutput, CXAgentOutput } from "@/core/shared/types"
export function agentsToOrders(
  fraud: FraudAgentOutput,
  revenue: RevenueAgentOutput,
  cx: CXAgentOutput,
  transactionId: string
): AgentOrder[]

// APRÈS
import { AgentOpinion } from "@/core/shared/agentTypes"
export function agentsToOrders(
  fraud: AgentOpinion | null | undefined,
  revenue: AgentOpinion | null | undefined,
  cx: AgentOpinion | null | undefined,
  transactionId: string
): AgentOrder[] {
  // Utiliser recommendation au lieu de output.recommendation
  // Utiliser confidence au lieu de output.score
  // Utiliser fraudScore ?? confidence pour la taille de l'ordre
}
```

---

### PHASE 6 — Migrer `paypal-webhook` et les scripts
**Durée estimée : 30 min**

#### `app/api/paypal-webhook/route.ts`

```typescript
// AVANT
import { runFullAgentPipeline } from "@/core/agents/orchestrator"
const trace = await runFullAgentPipeline(event, null, false)

// APRÈS
import { runPipelineV4 } from "@/core/agents/orchestrator"
const trace = await runPipelineV4(event)
```

#### `scripts/test-observability.ts`, `scripts/test-pipeline.ts`, `scripts/test-agents.ts`

```typescript
// Remplacer runFullAgentPipeline par runPipelineV4
// Adapter les assertions : trace.consensusWeights.fraud → trace.marketDecision.utilityScores.risk
// Supprimer l'assertion fraud !== 0.62 (les poids sont maintenant dynamiques)
```

---

### PHASE 7 — Supprimer le code mort V3
**Durée estimée : 1h**

Supprimer dans cet ordre (chacun doit compiler avant de passer au suivant) :

1. **`runFullAgentPipeline`** dans `orchestrator.ts` (270 lignes)
2. **`FraudAgentOutput`**, **`RevenueAgentOutput`**, **`CXAgentOutput`** dans `types.ts`
3. **`AgentOutput`** dans `types.ts` (interface de base V3)
4. **`OrchestratorDecision`** dans `types.ts`
5. **`consensusWeights`** dans `DecisionTrace`
6. **`reasoning: string[]`** dans `DecisionTrace`
7. **`runFraudAgentLegacy`**, **`runRevenueAgentLegacy`**, **`runCXAgentLegacy`** dans les agents
8. **`lib/agentEngine.ts`** — simulation V3 basée sur les anciens types

**Vérification après chaque suppression :**
```bash
npm run build && echo "OK"
```

---

### PHASE 8 — Nettoyage final et vérification
**Durée estimée : 30 min**

#### Vérification TypeScript stricte (zéro `as any` dans les chemins V4)

```bash
# Compter les as any restants
grep -rn "as any" components/ lib/ core/ --include="*.ts" --include="*.tsx" | grep -v "node_modules" | wc -l
# Cible : 0 (hors LoadTestPanel et AgentArenaPanel qui ont des cas légitimes)
```

#### Tests de validation post-migration

```bash
# 1. Build propre
npm run build

# 2. Test pipeline V4
curl -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"scenario": "vipPaymentFailure"}' | jq '{
    decision:       .trace.finalDecision,
    confidence:     .trace.confidence,
    winningCouncil: .trace.marketDecision.winningCouncil,
    utilityScores:  .trace.marketDecision.utilityScores,
    fraudScore:     .trace.councils.risk.memberOpinions[0].fraudScore,
    totalROI:       .trace.businessImpact.totalROI,
    executiveSummary: .trace.executiveSummary
  }'

# Attentes :
# decision: "STEP_UP_AUTH" ou "BLOCK"
# winningCouncil: "risk"
# utilityScores: { risk: float, revenue: float, customer: float }  ← DYNAMIQUE
# fraudScore: float (non null)
# totalROI: > 0
# executiveSummary: string non vide

# 3. Test Learning Agent (10 décisions)
for i in {1..10}; do
  curl -s -X POST http://localhost:3000/api/simulate \
    -H "Content-Type: application/json" \
    -d '{"scenario": "vipPaymentFailure"}' > /dev/null
done

# 4. Vérifier l'adaptation
curl -s -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"scenario": "vipPaymentFailure"}' | jq '.trace.learningInsights'
# Attente : adaptationActive === true, sessionSize >= 10

# 5. Vérifier PayPal webhook
curl -X POST http://localhost:3000/api/paypal-webhook \
  -H "Content-Type: application/json" \
  -d '{"event_type":"PAYMENT.CAPTURE.DENIED","resource":{"id":"PAY-test","amount":{"value":"299.00"}}}'
```

---

## Inventaire complet des fichiers à modifier

### Fichiers à créer (nouveaux)
| Fichier | Rôle |
|---|---|
| `core/shared/typesV4.ts` | `DecisionTrace` V4 natif (phase 0) |
| `core/shared/traceHelpers.ts` | Helpers typés `getAgent()`, `getFraudScore()`, etc. |

### Fichiers à modifier
| Fichier | Changement | Phase |
|---|---|---|
| `core/shared/agentTypes.ts` | Étendre `AgentOpinion` avec champs legacy | 1 |
| `core/agents/fraudAgent.ts` | Remplir champs legacy dans retour V4 | 1 |
| `core/agents/revenueAgent.ts` | Remplir champs legacy dans retour V4 | 1 |
| `core/agents/cxAgent.ts` | Remplir champs legacy dans retour V4 | 1 |
| `core/shared/types.ts` | Remplacer `agents` union, supprimer `orchestrator`/`consensusWeights` | 2, 3, 7 |
| `core/agents/orchestrator.ts` | Supprimer shim `agents`, supprimer `runFullAgentPipeline` | 2, 7 |
| `core/mcp/traceGraph.ts` | Remplacer `consensusWeights` par `utilityScores` | 3 |
| `hooks/useCockpit.ts` | Supprimer set de `consensusWeights` | 3 |
| `components/cockpit/AgentGrid.tsx` | Helpers typés, refactor barre consensus | 4 |
| `components/cockpit/AgentCard.tsx` | Props `AgentOpinion` au lieu de `AgentOutput` | 4 |
| `components/cockpit/DecisionDebugger.tsx` | Helpers typés | 4 |
| `components/cockpit/DecisionOrderBook.tsx` | Helpers typés | 4 |
| `components/cockpit/CanaryStatusPanel.tsx` | Helpers typés | 4 |
| `components/visualization/ElectricBeams.tsx` | Helpers typés | 4 |
| `components/visualization/GPUCockpit.tsx` | Helper `getFraudScore` | 4 |
| `components/visualization/TrafficSplitPanel.tsx` | Helpers typés | 4 |
| `lib/gpuDecisionMapping.ts` | Helper `getFraudScore`, severity depuis `marketDecision` | 4 |
| `lib/memoryGraph.ts` | Helpers typés | 4 |
| `lib/counterfactualEngine.ts` | Helpers typés | 4 |
| `lib/incidentReconstructor.ts` | Helpers typés | 4 |
| `lib/observabilityEnvelope.ts` | Helpers typés | 4 |
| `lib/orderBookEngine.ts` | Accepter `AgentOpinion` | 5 |
| `app/api/paypal-webhook/route.ts` | `runPipelineV4` | 6 |
| `scripts/test-agents.ts` | Adapter assertions V4 | 6 |
| `scripts/test-observability.ts` | `runPipelineV4` | 6 |
| `scripts/test-pipeline.ts` | `runPipelineV4` | 6 |

### Fichiers à supprimer (phase 7)
| Fichier | Raison |
|---|---|
| `lib/agentEngine.ts` | Simulation V3 basée sur `FraudAgentOutput` etc. |

---

## Résumé des gains post-migration

### Techniques
- **0 `as any`** dans le chemin d'exécution V4 (actuellement 11)
- **Type safety complète** : `DecisionTrace` est un seul type cohérent
- **`utilityScores` dynamiques** au lieu de `consensusWeights` figés à 0.62/0.23/0.15
- **~350 lignes de dead code supprimées** (`runFullAgentPipeline` + legacy types)
- **1 seule interface agent** : `AgentOpinion` remplace le trio `FraudAgentOutput / RevenueAgentOutput / CXAgentOutput`

### Architecture
- `DecisionTrace.councils.risk.memberOpinions` devient la **source de vérité unique** pour les données agents
- `DecisionTrace.marketDecision.utilityScores` devient la **source de vérité unique** pour les poids de décision
- Le pipeline est **linéaire** : State → Councils → Market → Plan → Trace (plus de shims)

### Démo
- Les composants `AgentGrid` afficheront les **vrais poids dynamiques** de l'Opinion Market (ex: Risk 84.7% au lieu de 62%)
- L'Order Book reflétera les **vrais utility scores** au lieu des poids V3 figés

---

## Estimation de temps totale

| Phase | Durée | Complexité |
|---|---|---|
| Phase 0 — Branche + type cible | 30 min | Faible |
| Phase 1 — Étendre AgentOpinion | 45 min | Moyenne |
| Phase 2 — Migrer `agents` | 1h | Haute |
| Phase 3 — Migrer `orchestrator` | 1h | Haute |
| Phase 4 — Composants (11 fichiers) | 2h | Moyenne × 11 |
| Phase 5 — OrderBook | 30 min | Moyenne |
| Phase 6 — Webhook + scripts | 30 min | Faible |
| Phase 7 — Suppression dead code | 1h | Moyenne |
| Phase 8 — Tests + validation | 30 min | Faible |
| **Total** | **~7h30** | |

---

## Règles pendant la migration

1. **Une phase = un commit**. Ne pas mélanger les phases dans un commit.
2. **`npm run build` doit passer avant chaque commit**.
3. **Ne pas toucher** aux fichiers V4 existants (`councils/`, `orchestration/`, `agents/learningAgent.ts`, `agents/growthAgents/`) — ils sont déjà natifs V4.
4. **Ne pas supprimer** `FraudAgentOutput` avant que tous les fichiers qui l'utilisent soient migrés (grep avant de supprimer).
5. **Garder `typesV4.ts`** en parallèle jusqu'à la PHASE 7, puis le fusionner dans `types.ts` et supprimer `typesV4.ts`.

---

## Phrase d'état actuel (à conserver pour contexte futur)

> Le V4 actuel est **fonctionnel et démo-ready**. L'Opinion Market tourne, les Councils arbitrent,  
> le Learning Agent s'adapte, le Business Impact est calculé. Mais `DecisionTrace` porte encore  
> la structure V3 (`agents.fraud`, `orchestrator`, `consensusWeights`) comme squelette de compatibilité,  
> avec 11 `as any` pour masquer le mismatch de types. La migration structurelle décrite ci-dessus  
> élimine cette couche et rend le V4 **architecturalement propre**.
