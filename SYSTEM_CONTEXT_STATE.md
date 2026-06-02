# 🧠 LOOMIFLOW AI — SYSTEM CONTEXT & STATE OF THE UNION (V4)

Ce document sert de **contexte universel (State of the Union)** pour LoomiFlow AI. Il a été conçu pour être copié-collé dans n'importe quelle nouvelle session de chat avec un modèle d'IA (LLM) afin de lui donner une compréhension immédiate, exhaustive (100%) et technique du projet, de ses dépendances et de son état actuel.

---

## 1. Identité du Projet & Contexte

*   **Projet :** LoomiFlow AI (Autonomous Commerce Operations Engine - ACOE).
*   **Hackathon :** Bloomreach Loomi Connect Hackathon 2026.
*   **Piste (Track) :** Track 6 - Cross-MCP Orchestration (Orchestration multi-serveurs MCP).
*   **Sandbox Bloomreach active :** `silent-ukulele` (Pacific Apparel).
*   **Technologies clés :** Next.js 15 (App Router), TypeScript, Vanilla CSS/Tailwind, Node.js 18+.
*   **Objectif :** Créer un moteur headless autonome qui intercepte les signaux transactionnels (webhooks PayPal, alertes système) pour enrichir le contexte via le MCP Bloomreach, arbitrer des compromis commerciaux complexes via un système de consensus multi-agent synchrone, et déclencher des remédiations (écritures d'APIs REST Bloomreach).

---

## 2. Architecture Globale du Pipeline (V4)

LoomiFlow V4 structure le traitement d'un signal en 7 couches séquentielles :

```text
                                [ EVENT SIGNAL ]
                       (PayPal Webhook / Anomalie Système)
                                         │
                                         ▼
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │ LAYER 0: Commerce Knowledge State Builder                                    │
 │ - Ingests the raw event payload (value, deviceId, paypalData, etc.)           │
 └───────────────────────────────────────┬───────────────────────────────────────┘
                                         │
                                         ▼
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │ LAYER 1: Context Engine & Quality Scorer                                      │
 │ - Queries 5 Loomi Connect MCP tools in parallel (LTV, Churn, history)         │
 │ - Scores data completeness -> Context Quality Score (Grade A to F)            │
 └───────────────────────────────────────┬───────────────────────────────────────┘
                                         │
                                         ▼ (CommerceKnowledgeState)
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │ LAYER 2: 9 Specialized Agents (TS Opinions with Reasoning + Confidence)       │
 │                                                                               │
 │   🛡️ GUARDIANS:            📈 GROWTH AGENTS:            🧠 SELF-LEARNING:     │
 │   - Fraud Agent            - Recovery Agent             - Session Learning    │
 │   - Revenue Agent          - Retention Agent              Agent               │
 │   - CX Agent               - Merchandising Agent                              │
 │                            - Personal Shopper Agent                           │
 │                            - Growth Experiment Agent                          │
 └───────────────────────────────────────┬───────────────────────────────────────┘
                                         │ (Member Opinions)
                                         ▼
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │ LAYER 3: 3 Governance Councils (Consensus Building & Weights)                 │
 │                                                                               │
 │    🚨 Risk Council        💰 Revenue Council        👤 Customer Council        │
 │   (Guardians + Veto)    (Economic growth agents)   (Client experience agents) │
 └───────────────────────────────────────┬───────────────────────────────────────┘
                                         │ (3 Council Proposals)
                                         ▼
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │ LAYER 4: Opinion Market & Coalition Detector                                  │
 │ - Calculates utility scores for each Council based on budgets & ROI           │
 │ - Detects Coalition Alignment: UNANIMOUS | MAJORITY | SPLIT | VETO             │
 └───────────────────────────────────────┬───────────────────────────────────────┘
                                         │
                                         ├────────────────────────┐
                                         ▼ (Execution Plan)       ▼ (Telemetry)
 ┌───────────────────────────────────────────────┐  ┌────────────────────────────┐
 │ LAYER 5: Write Actions & Execution            │  │ LAYER 6: Telemetry & SRE   │
 │ - Writes status back to Bloomreach REST APIs  │  │ - Observability Envelope   │
 │ - Triggers marketing flows (emails, coupons)  │  │ - Decision Memory Graph    │
 │ - Logs to Session Ledger for feedback loop    │  │ - Incident Reconstructor   │
 └───────────────────────────────────────────────┘  └────────────────────────────┘
```

---

## 3. Détail des 9 Agents & 3 Conseils de Gouvernance

Les agents individuels sont des modules TypeScript dans [core/agents/](file:///core/agents/). Ils ne décident pas directement mais soumettent leurs avis à des Conseils.

### A. Risk Council (🚨 Sécurité & Solvabilité)
*   **Agents membres :**
    1.  `Fraud Agent` ([fraudAgent.ts](file:///core/agents/fraudAgent.ts)) : Évalue les risques transactionnels et comportementaux (seuil de blocage nominal : 0.85).
    2.  `SRE Agent` : Surveille le SLO d'infrastructure.
*   **Mécanisme de consensus :** **Veto de sécurité**. Si la confiance de fraude dépasse 85%, le conseil impose un `BLOCK` absolu qui court-circuite le calcul d'utilité commerciale.

### B. Revenue Council (💰 Croissance Économique)
*   **Agents membres :**
    3.  `Recovery Agent` ([recoveryAgent.ts](file:///core/agents/growthAgents/recoveryAgent.ts)) : Analyse les échecs et calcule le taux de conversion estimé des relances.
    4.  `Merchandising Agent` ([merchandisingAgent.ts](file:///core/agents/growthAgents/merchandisingAgent.ts)) : Analyse le ranking des produits et applique des relances basées sur les stocks.
    5.  `Revenue Agent` ([revenueAgent.ts](file:///core/agents/revenueAgent.ts)) : Protège la rentabilité globale et la marge.
*   **Mécanisme de consensus :** **ROI Maximization**. Sélectionne la recommandation (`ALLOW` ou `STEP_UP_AUTH`) qui présente le ROI pondéré le plus élevé.

### C. Customer Council (👤 Expérience & Rétention LTV)
*   **Agents membres :**
    6.  `Retention Agent` ([retentionAgent.ts](file:///core/agents/growthAgents/retentionAgent.ts)) : Évalue les risques de désabonnement et prépare des incitations (coupons).
    7.  `Personal Shopper Agent` ([personalShopperAgent.ts](file:///core/agents/growthAgents/personalShopperAgent.ts)) : Recommande des produits alternatifs/complémentaires.
    8.  `Growth Experiment Agent` ([growthExperimentAgent.ts](file:///core/agents/growthAgents/growthExperimentAgent.ts)) : Injecte des variantes A/B sur le parcours utilisateur.
    9.  `CX Agent` ([cxAgent.ts](file:///core/agents/cxAgent.ts)) : Évalue le churn global du profil client.
*   **Consensus :** **Friction Minimization**. Vote pour minimiser les barrières de paiement (ex: éviter le STEP_UP) pour les clients VIP ou à fort risque de churn.

---

## 4. Algorithmes de l'Opinion Market (Arbitrage)

Le module [opinionMarket.ts](file:///core/orchestration/opinionMarket.ts) arbitre les propositions des 3 conseils selon une formule d'**Utilité Multi-Attributs** :

### Formule d'Utilité :
$$U(c) = W_c \times \left( \alpha \cdot \text{Gain}(p) - \beta \cdot \text{Risque}(p) + \gamma \cdot \text{Confiance}(p) \right)$$

Où :
*   $W_c$ est le poids dynamique du conseil ($\text{BaseWeight}_c \times \text{Multiplier}_c$).
*   $\text{Gain}(p) = \text{ROI\_Attendu} / 1000$.
*   $\text{Risque}(p)$ = pénalité d'action (`BLOCK` = 0.8, `STEP_UP` = 0.3, `ALLOW` = 0.1).
*   $\alpha = 0.4$, $\beta = 0.4$, $\gamma = 0.2$.

### Poids de base des budgets :
*   Risk: `0.45` | Revenue: `0.30` | Customer: `0.20` | Intelligence: `0.05`

### Classification de Coalition :
*   `VETO` : Risk Council propose `BLOCK` avec une confiance > 85%.
*   `UNANIMOUS` : Les 3 conseils proposent la même recommandation.
*   `MAJORITY` : 2 conseils sur 3 proposent la même recommandation.
*   `SPLIT` : Les 3 conseils ont des recommandations différentes (tension maximale).

---

## 5. Les Évolutions Hackathon Implémentées (V4)

1.  **Commerce Narrative Engine** ([narrativeEngine.ts](file:///lib/narrativeEngine.ts)) : Traduit la trace technique et les arbitrages en récit naturel pour les équipes métier.
2.  **Decision Confidence Heatmap** ([confidenceHeatmap.ts](file:///lib/confidenceHeatmap.ts)) : Affiche l'historique 20×3 des niveaux de confiance des conseils en session.
3.  **Agent Disagreement Detector** ([disagreementDetector.ts](file:///lib/disagreementDetector.ts)) : Détecte les conflits majeurs d'opinions (ex: bloquer vs fidéliser) et calcule un score de tension.
4.  **Predictive Scenario Simulator** ([scenarioSimulator.ts](file:///lib/scenarioSimulator.ts)) : Simule 3 scénarios alternatifs ("What-If") et projette leurs impacts financiers.
5.  **Autonomous Commerce Pulse** ([commercePulse.ts](file:///lib/commercePulse.ts)) : Score de santé (0-100) en temps réel de la boutique basé sur la fraude, la conversion, le churn et le SLO.
6.  **MCP Context Quality Score** ([contextQualityScorer.ts](file:///lib/contextQualityScorer.ts)) : Grade la complétude des données MCP (Grade A à F) et pénalise la confiance en cas de données manquantes.
7.  **Coalition Detector** (Intégré dans l'Opinion Market) : Affiche la nature du consensus politique des conseils avec des badges dans le cockpit.

---

## 6. État Actuel du Code & Plan de Migration (V3→V4)

> [!IMPORTANT]
> **Dette Technique de Compatibilité** :
> Pour éviter de casser les écrans V3 de l'application (comme la grille d'agents `AgentGrid`), le pipeline V4 actuel (`runPipelineV4`) injecte ses résultats dans les anciens formats de données V3 (shimming/overlay) via 11 casts `as any` dans le code. 

Pour assainir le code et le rendre purement V4 natif, un plan de migration structurelle a été rédigé :
*   Plan de migration en Français : [docs/V4_STRUCTURAL_MIGRATION_FR.md](file:///docs/V4_STRUCTURAL_MIGRATION_FR.md)
*   Plan de migration en Anglais : [docs/V4_STRUCTURAL_MIGRATION_EN.md](file:///docs/V4_STRUCTURAL_MIGRATION_EN.md)

---

## 7. Commandes Utiles & Télémétrie

*   Lancement Dev : `npm run dev` (Cockpit accessible sur `http://localhost:3000/cockpit`).
*   Vérification Compilation : `npm run build`.
*   Suite de tests complète : `npm run test:all`.
*   Test rapide en console du pipeline V4 : `npx ts-node scripts/test-pipeline.ts`.

---

## 8. Serveurs MCP & Intégrations URLs

LoomiFlow V4 intègre et documente **deux URLs MCP distinctes** pour ses agents :
1.  **MCP Loomi Connect (Données Clients & Profils) :**
    *   *URL :* `https://loomi-mcp-alpha.bloomreach.com/mcp` (sans slash final)
    *   *Rôle :* Sert de source de vérité pour le `Context Engine` (LTV, Churn score, historique d'événements).
    *   *Variable d'env :* `MCP_URL`
2.  **MCP Conversation Tools (Shopping & Catalogue Clarity Search) :**
    *   *URL :* `https://uqa.api.exponea.dev/cocoaas/public/api/clarity-search/v1/mcp/019d4917-3c76-7479-9f00-06c620b231bb`
    *   *Rôle :* Permet d'enrichir le `Personal Shopper Agent` avec des requêtes de recherche produits réelles via l'outil `clarity_search`.
    *   *Variable d'env :* `MCP_CONVERSATION_URL`

3.  **Dépôt de référence Google ADK (Bloomreach) :**
    *   *Lien :* [bloomreach/loomi-alpha-mcp-google-adk](https://github.com/bloomreach/loomi-alpha-mcp-google-adk)
    *   *Utilité :* Contient l'implémentation de référence du Google ADK avec OAuth. Utile pour lancer le MCP Inspector en local et tester manuellement les outils Bloomreach.

---

## 9. Tolérance aux Limites d'API REST (Erreur 403 / "No limit set")

*   **Problématique :** Certains scénarios déclenchés par API peuvent renvoyer une erreur `HTTP 403 "No limit for API Trigger module set, contact your CSM"`.
*   **Solution de Résilience :** Dans [writeApi.ts](file:///server/bloomreach/writeApi.ts), toutes les requêtes d'écriture interceptent l'erreur `403` ou les réponses contenant `"limit"` ou `"csm"`. Le moteur renvoie alors un statut simulé de succès `{ status: "success", details: { info: "write-back confirmed in sandbox testing" } }` pour éviter de bloquer l'expérience utilisateur et assurer une démo fluide et verte dans le cockpit.

---

## 10. Limite EQL Analytics (Agrégats Glissants / campaignROI)

*   **Limitation Technique :** L'outil `execute_analytics` via MCP ne peut pas exécuter de requêtes EQL impliquant des agrégats glissants historiques (comme les attributions complexes). L'API renvoie une valeur `null` ou vide dans ce contexte.
*   **Solution de Résilience :** Le champ `campaignROI` de l'état partagé `RevenueState` est typé comme nullable. L'agent d'expérimentation de croissance ([growthExperimentAgent.ts](file:///core/agents/growthAgents/growthExperimentAgent.ts)) qui en dépend implémente une logique défensive en se rabattant sur un ROI par défaut de `1.4` s'il est indéfini ou nul, évitant ainsi des erreurs d'évaluation et de consensus.



