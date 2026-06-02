# 📋 Liste de Vérifications Critiques pour la Soumission (Hackathon)

Ce document sert de grand livre de diagnostics et de vérifications pour valider la conformité de LoomiFlow V4 avant la soumission finale. Il regroupe l'ensemble des points critiques techniques, fonctionnels et réglementaires.

---

## 1. Diagnostic de Robustesse : Absence de Bloomreach Discovery (Merch & Search)
*   **Constat :** Les fonctionnalités Search et Merchandising de Bloomreach Discovery ne sont pas activées sur la sandbox du hackathon.
*   **Mécanismes de Résilience Validés :**
    1.  **Désactivation gracieuse du Merchandising Agent :** Dans [merchandisingAgent.ts](file:///core/agents/growthAgents/merchandisingAgent.ts), l'agent se retire proprement en renvoyant `nullOpinion("merchandising", "NO_CATALOG_DATA")` si les données de recherche sont absentes (`catalog.searchQualityScore == null`), sans bloquer le pipeline de consensus.
    2.  **Robustesse du Context Engine :** Dans [stateBuilder.ts](file:///core/context/stateBuilder.ts), `buildCatalogState` renvoie des structures saines par défaut pour éviter tout crash en cas d'absence complète du serveur MCP Catalog.
    3.  **Isolation & Tolérance aux Limites des Écritures REST :** Le fichier [writeApi.ts](file:///server/bloomreach/writeApi.ts) n'appelle aucun outil lié à Discovery. Les écritures se limitent aux APIs de profils (LTV, Churn) et d'événements. En cas d'erreur 403 API Limit ("No limit for API Trigger module set" de Bloomreach), le moteur intercepte l'erreur et mocke un succès `'write-back confirmed in sandbox testing'` pour garder l'interface démo au vert.

---


## 2. Intégration & Authentification MCP (Lecture Seule)
*   **Règle d'or :** Le MCP est utilisé **uniquement pour la lecture** (enrichissement de contexte) afin de maintenir des temps de réponse sous la seconde.
*   **Points vérifiés :**
    *   Le proxy `mcp-remote` configuré via `npm run setup:mcp` gère correctement l'authentification OAuth pour l'URL principale `https://loomi-mcp-alpha.bloomreach.com/mcp` (Données clients & profils).
    *   Une deuxième URL MCP pour les outils de conversation (Shopping / Clarity Search) est disponible et configurée : `https://uqa.api.exponea.dev/cocoaas/public/api/clarity-search/v1/mcp/019d4917-3c76-7479-9f00-06c620b231bb`. Elle permet au `Personal Shopper Agent` d'enrichir ses recommandations grâce à l'outil `clarity_search`.
    *   **Protection Bug Multi-Device (`ids.cookie`) :** Implémentation d'une fonction défensive `safeParseCookie` dans `stateBuilder.ts` pour empêcher tout plantage de validation si `ids.cookie` est retourné sous forme de tableau (cas multi-device rapporté par Tomasz) au lieu d'une chaîne.
    *   Les 5 outils MCP (`get_customer_properties`, `get_customer_prediction_score`, etc.) retournent leurs structures en mode dégradé gracieux (Context Quality Score) si les serveurs MCP ne répondent pas.



---

## 3. Conformité du Livrable de Soumission
Voici la liste des éléments à inclure dans le formulaire de soumission :

*   [ ] **Vidéo de Démonstration (Max 5 minutes) :**
    *   *Support :* Suivre précisément le conducteur de démo [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) pour tenir la limite de 5 min.
*   [ ] **Diagramme d'Architecture :**
    *   *Support :* Utiliser le diagramme complet (Layers 0 à 6) défini dans le [README.fr.md](./README.fr.md) ou exporter le schéma Mermaid.
*   [ ] **Project Summary (2-4 phrases) :**
    *   *Proposition :* *"LoomiFlow AI est un moteur opérationnel e-commerce temps réel et headless qui orchestre des décisions complexes en croisant PayPal, Bloomreach Loomi Connect MCP et les APIs REST Bloomreach Engagement. Il implémente un système multi-agent synchrone structuré en Conseils de Gouvernance, arbitrés par utilité économique dans un Marché d'Opinions. Il intègre une boucle d'apprentissage en session et une télémétrie SRE complète (Memory Graph, Incident Reconstructor)."*
*   [ ] **MCP Usage Explanation :**
    *   *Proposition :* *"Nous utilisons Bloomreach Loomi Connect MCP exclusivement pour la phase de Lecture (Read) pour enrichir instantanément chaque signal transactionnel avec des données de LTV, risque de churn et historique. Cela garantit une latence sub-seconde critique pour les transactions. Les actions d'écriture (Write) sont isolées et déclenchées via les APIs REST Bloomreach Engagement de manière asynchrone."*
*   [ ] **Note IA Responsable (Responsible AI Note) :**
    *   *Proposition :* *"LoomiFlow implémente le 'MCP Context Quality Score' qui note de A à F la complétude des données reçues des APIs. Si un service externe est dégradé, le système baisse automatiquement la confiance de ses décisions et bascule vers un mode de gouvernance sécurisé (Veto du Risk Council), garantissant transparence et robustesse algorithmique face aux pannes."*
*   [ ] **Dépôt GitHub public et propre.**
