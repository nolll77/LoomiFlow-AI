# 📉 Scénario 5 : Dégradation de la Qualité du Contexte MCP
### *Honnêteté Algorithmique & Résilience face aux Pannes d'API*

Ce scénario met en lumière une fonctionnalité d'**IA Responsable** de la V4 : le **MCP Context Quality Score** (Évaluation de la qualité des données). Il montre comment LoomiFlow s'adapte lorsque les sources de données externes (APIs Bloomreach, serveurs MCP) sont indisponibles ou partielles.

---

## 📡 Signal Déclencheur & Panne Réseau
Un webhook transactionnel de **150,00 €** arrive en session, mais le serveur MCP de Bloomreach subit des micro-coupures réseau ou renvoie des données corrompues :
*   L'outil MCP `get_customer_properties` échoue ou renvoie une erreur 503.
*   L'outil `get_customer_prediction_score` renvoie un score nul ou indéterminé (`null`).
*   Seul le signal brut de l'événement transactionnel de base est disponible.

---

## 🧠 Flux de Traitement V4 & Calcul de la Qualité du Contexte

### Étape 1 : Diagnostic par le Context Quality Scorer
Le module [contextQualityScorer.ts](file:///Users/nolll/Documents/loomiflow/lib/contextQualityScorer.ts) évalue les données reçues :
*   **Champs manquants détectés :** `churnScore`, `LTV`, `loyaltyTier`, `categoryPreferences`.
*   **Grade attribué :** `Grade D` ou `Grade F` (Score global : **35/100**).
*   **Impact sur la décision :** `HIGH` (La perte des données client empêche les conseils de calculer précisément les risques de churn et le ROI de rétention).

---

## 🛡️ Adaptation Automatique de la Confiance (Dynamic Weights Degradation)
Lorsque la qualité du contexte chute sous la barre des **50/100** :
1.  **Pénalisation des Poids :** Les poids de consensus des conseils de croissance commerciale (Revenue et Customer) sont réduits de moitié. La formule dynamique réajuste le poids en multipliant la confiance par le score de qualité de données :
    $$\text{Poids Effectif} = \text{Poids de Base} \times \text{Confiance de l'Agent} \times \text{Qualité Données (0.35)}$$
2.  **Alignement Sécuritaire :** Face à l'inconnu, le système privilégie la prudence. Le Risk Council prend le contrôle des décisions pour éviter de valider des transactions risquées sans contexte.

---

## ⚖️ Délibération et Décision de l'Opinion Market
*   **Risk Council :** Propose `HOLD` (Mettre en attente de vérification) en raison de l'impossibilité d'évaluer le comportement de l'utilisateur. Confiance : **75%**.
*   **Revenue Council :** Propose `ALLOW` (Recommander de laisser passer pour ne pas bloquer le chiffre d'affaires). Confiance : **40%** (Fortement dégradée par la qualité de donnée).
*   **Customer Council :** Propose `HOLD`. Confiance : **50%**.

**Décision finale :** `HOLD` (La transaction est suspendue pour revue manuelle car le système refuse de prendre une décision automatique avec un contexte dégradé).

**Type de Coalition :** `MAJORITY COALITION` (Risk et Customer s'accordent sur le HOLD pour des raisons de prudence).

---

## ✍️ Actions d'Écriture
*   **Pas d'action commerciale automatique** pour éviter d'envoyer des coupons erronés ou des relances inappropriées.
*   **Mise en attente de la transaction dans le tableau de bord.**
*   **Enregistrement de la dégradation de donnée** dans les enveloppes d'observabilité de la trace de décision.

---

## 📝 Rapport Narratif (Narrative Engine)
> *"La décision finale a été forcée à HOLD avec une confiance de 75%. Le diagnostic de qualité de données a révélé une dégradation critique (Score : 35/100, Grade D) en raison de l'absence des informations de LTV et de Churn du client. Le système a automatiquement pénalisé les conseils commerciaux et suspendu la transaction pour examen manuel par mesure de sécurité."*
