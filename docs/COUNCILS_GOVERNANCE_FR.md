# 🏛️ Gouvernance Multi-Agent : Conseils & Marché d'Opinions

Ce document propose une analyse technique approfondie de la couche de gouvernance de LoomiFlow V4. Il détaille la philosophie de conception, les modélisations mathématiques et les mécanismes de consensus en session pour arbitrer les décisions.

---

## 1. Philosophie : Séparer l'Avis de l'Agent de la Décision Finale

La plupart des systèmes multi-agents souffrent d'une dérive de complexité (**Agent Sprawl**) : ajouter de nouveaux agents génère un comportement chaotique, des latences réseau élevées et des conflits de décision difficiles à coder.

LoomiFlow V4 résout ce problème en séparant l'**Analyse Spécialisée** de la **Gouvernance Stratégique** :
*   **Layer 2 (Agents / Les Voix)** : Des agents experts et légers analysent l'état global du commerce (`CommerceKnowledgeState`) et renvoient une opinion. Ils se focalisent uniquement sur leur indicateur (ex: score de fraude, risque de churn, taux d'ouverture d'email) sans vision d'ensemble.
*   **Layer 3 (Councils / La Gouvernance)** : Les agents ne prennent pas de décision finale directement. Ils soumettent leurs avis à l'un des trois **Conseils de Gouvernance**. Chaque conseil consolide ces voix dans une proposition unique via un consensus interne propre.
*   **Layer 4 (Opinion Market / L'Arbitrage)** : Les trois propositions de conseils sont soumises à un marché d'opinions. Au lieu de règles logiques codées en dur, l'arbitrage est réalisé via des **fonctions d'utilité économique** et des pondérations dynamiques.

---

## 2. Les Trois Conseils de Gouvernance

```text
 🛡️ RISK COUNCIL             💰 REVENUE COUNCIL         👤 CUSTOMER COUNCIL
 ┌──────────────────────┐    ┌─────────────────────┐    ┌──────────────────────┐
 │ - Agent Fraude       │    │ - Agent Récupération│    │ - Agent Rétention    │
 │ - Agent SRE / Infra  │    │ - Agent Merch.      │    │ - Agent Pers. Shopper│
 └──────────┬───────────┘    └──────────┬──────────┘    └──────────┬───────────┘
            │                           │                          │
            ▼                           ▼                          ▼
      Risk Proposal              Revenue Proposal          Customer Proposal
 (BLOCK | STEP_UP_AUTH | HOLD)   (ALLOW | STEP_UP)      (ALLOW | HOLD | voucher)
```

### A. Le Risk Council (🚨 Risque & Solvabilité)
*   **Rôle** : Sécurité de la plateforme, prévention des impayés (chargebacks), détection des fraudes et surveillance de l'infrastructure.
*   **Consensus Interne** : **Veto de Sécurité Strict**.
    *   Si l'agent Fraude détecte un risque critique supérieur au seuil de sécurité, le Risk Council impose un `BLOCK` sans négociation possible.
    *   *Confiance du consensus* :
        $$C_{\text{risk}} = \max(C_{\text{fraude}}, C_{\text{sre}})$$

### B. Le Revenue Council (💰 Optimisation Financière)
*   **Rôle** : Maximisation de la conversion de paiement, relance des paniers abandonnés, et optimisation du merchandising.
*   **Consensus Interne** : **Maximisation du ROI Commercial**.
    *   Calcule le chiffre d'affaires récupérable pondéré par la probabilité de réussite des relances.
    *   *Recommandation* : Choisit la stratégie maximisant la marge nette récupérée à court terme.

### C. Le Customer Council (👤 Expérience & Valeur Client LTV)
*   **Rôle** : Protection de la valeur à vie du client (LTV), réduction du churn des VIPs et satisfaction client.
*   **Consensus Interne** : **Minimisation de la Friction & Churn**.
    *   Priorise l'absence de friction pour les clients à forte valeur LTV. Si un client VIP présente un risque de churn élevé, le conseil vote systématiquement pour éviter des mesures d'authentification bloquantes.

---

## 3. Le Moteur d'Utilité de l'Opinion Market (Les Mathématiques)

Le **Marché d'Opinions** arbitre les trois propositions de conseils en calculant un score d'utilité économique $U(c)$ pour chaque conseil $c$ :

$$U(c) = W_c \times \left( \alpha \cdot \text{Gain}(p) - \beta \cdot \text{Risque}(p) + \gamma \cdot \text{Confiance}(p) \right)$$

Où :
*   $W_c$ est le **Poids du Conseil** ($W_c = \text{BaseWeight}_c \times \text{PerformanceMultiplier}_c$).
*   $\text{Gain}(p)$ représente le ROI estimé normalisé de la proposition :
    $$\text{Gain}(p) = \frac{\text{ROI\_Attendu}}{1000}$$
*   $\text{Risque}(p)$ représente la pénalité de friction de l'action recommandée :
    *   `BLOCK` = $0.8$ (Friction maximale pour l'acheteur, risque de perte client)
    *   `STEP_UP_AUTH` = $0.3$ (Friction modérée)
    *   `ALLOW` / `HOLD` = $0.1$ (Aucune friction utilisateur)
*   $\text{Confiance}(p)$ correspond à la confiance du conseil dans sa proposition (de $0.0$ à $1.0$).
*   **Constantes d'importance** : $\alpha = 0.4$ (poids du gain), $\beta = 0.4$ (poids du risque), $\gamma = 0.2$ (poids de la confiance).

### Budgets de Base des Conseils
Au démarrage, les budgets privilégient la sécurité de la boutique :
1.  **Risk Council** : Poids de base $0.45$
2.  **Revenue Council** : Poids de base $0.30$
3.  **Customer Council** : Poids de base $0.20$
4.  **Intelligence Layer** : Poids de base $0.05$

---

## 4. Apprentissage Continu : Ajustement des Budgets en Session

Pour s'adapter en continu aux variations de trafic (ex: soldes ou cyber-attaques), l'**Agent d'Apprentissage de Session** réévalue les poids $W_c$ en tâche de fond :

```text
Décision exécutée ──► Session Ledger (Log) ──► Learning Agent ──► Modification du performanceMultiplier
```

*   **Règle d'ajustement** :
    *   Si les propositions passées d'un conseil ont été validées avec succès (ex: une transaction suspectée qui a réussi son authentification double facteur), son `performanceMultiplier` augmente de $+0.05$ (limite à $2.0$).
    *   Si sa proposition a causé une erreur (ex: un paiement accepté entraînant un chargeback, ou un blocage poussant un VIP au churn), son `performanceMultiplier` diminue de $-0.10$ (limite à $0.5$).
*   Cette boucle de rétroaction s'exécute **en mémoire, en cours de session**, évitant des phases de ré-entraînement de modèle ou de redéploiement de code lourds.

---

## 5. Classification des Coalitions

Pour assurer la transparence des choix, le système identifie le type d'accord trouvé entre les conseils :

| Type de Coalition | Condition de Détection | Signification Métier | Couleur UI |
| :--- | :--- | :--- | :--- |
| **`VETO`** | Proposition du Risk Council = `BLOCK` avec Confiance > $0.85$ | Mesure d'urgence. Le Risk Council court-circuite la négociation commerciale. | Rouge 🔴 |
| **`UNANIMOUS`** | Les 3 conseils proposent exactement la même action | Consensus parfait au sein de l'organisation. | Vert 🟢 |
| **`MAJORITY`** | 2 conseils sur 3 proposent la même action | Arbitrage démocratique des opinions contradictoires. | Bleu 🔵 |
| **`SPLIT`** | Les 3 conseils proposent 3 actions différentes | Tension maximale. Décision prise uniquement sur l'utilité mathématique. | Violet 🟣 |
