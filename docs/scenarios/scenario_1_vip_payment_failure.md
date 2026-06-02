# 🚨 Scénario 1 : Échec de Paiement VIP (VIP Payment Failure)
### *Arbitrage de Consensus & Gestion de la Tension Client*

Ce scénario représente le point culminant de la démonstration (**Climax Demo**). Il illustre comment le système gère les signaux contradictoires entre le risque de fraude et la valeur à long terme (LTV) d'un client VIP.

---

## 👥 Profil du Client
*   **Identité :** Sarah Mitchell (`vip_pacific_001`)
*   **Segment :** VIP (LTV accumulée : **3 200 €** sur 14 commandes)
*   **État critique :** Risque de désabonnement (Churn Risk) à **82%** (très élevé).

---

## 📡 Signal Déclencheur (PayPal Webhook)
Un webhook PayPal signale un échec de paiement (`payment_failed`) de **249,90 €** avec des anomalies de sécurité :
*   Utilisation d'un nouvel appareil (`device_B`).
*   Incohérence géographique (IP suspecte).
*   Score de risque PayPal initial : **0.72**.

```json
{
  "id": "evt_vip_1717316719",
  "type": "payment_failed",
  "customerId": "vip_pacific_001",
  "value": 249.90,
  "currency": "EUR",
  "deviceId": "device_B",
  "paypalData": {
    "transactionId": "PAYPAL_TX_987654",
    "status": "DECLINED",
    "declineReason": "AUTHORIZATION_TIMEOUT",
    "fraudSignals": {
      "velocityAnomaly": true,
      "deviceMismatch": true,
      "geoInconsistency": true,
      "riskScore": 0.72
    }
  }
}
```

---

## 🧠 Flux de Traitement V4 (Step-by-Step)

```text
[Signal] ──► MCP (get_customer_properties) ──► 3 Councils (Parallèle) ──► Opinion Market ──► Décision finale (STEP_UP_AUTH)
```

### Étape 1 : Enrichissement MCP (Lecture)
Le `Context Engine` appelle les outils MCP :
*   `get_customer_properties` -> Renvoie le profil de Sarah (VIP, LTV 3200).
*   `get_customer_prediction_score` -> Détecte le Churn Risk (0.82).
*   `list_customer_events` -> Historique des transactions sur le terminal habituel (`device_A`).

### Étape 2 : Délibération des 3 Councils
Trois conseils analysent l'état enrichi de manière autonome :

1.  **Risk Council (Guardian Agent: Fraud)**
    *   *Opinion :* Le score de fraude PayPal est élevé (0.72) sur un nouvel appareil. Le risque de fraude bancaire est critique.
    *   *Recommandation :* `STEP_UP_AUTH` (Authentification renforcée).
    *   *Confiance :* **87%**

2.  **Revenue Council (Growth Agents: Recovery & Merchandising)**
    *   *Opinion :* Il y a 249.90 € de revenus immédiatement menacés. Une perte définitive de ce client VIP coûterait potentiellement 3 200 € à vie.
    *   *Recommandation :* `ALLOW` (Accepter le paiement avec relance immédiate par lien sécurisé).
    *   *Confiance :* **75%**

3.  **Customer Council (Growth Agent: Retention)**
    *   *Opinion :* Sarah Mitchell est déjà sur le point de churner (82%). Un blocage pur et simple (`BLOCK`) détruirait définitivement la relation client.
    *   *Recommandation :* `ALLOW` (avec compensation de fidélité).
    *   *Confiance :* **80%**

### Étape 3 : Arbitrage dans l'Opinion Market
L'Opinion Market calcule l'utilité pondérée de chaque proposition en croisant les scores et le budget des conseils :
*   **Risk Utility Score :** `0.847` (Gagnant 🏆)
*   **Revenue Utility Score :** `0.623`
*   **Customer Utility Score :** `0.412`

**Type de Coalition détecté :** `MAJORITY COALITION` (2 conseils voulaient `ALLOW`, mais la sévérité du Risk Council l'emporte avec l'appui de règles de protection pour forcer une authentification supplémentaire).

---

## ⚡ Tensions Détectées (Disagreement Detector)
Le système lève une alerte de tension **CRITIQUE** :
*   **Divergence :** Risk Council (`STEP_UP_AUTH`) vs Revenue/Customer Councils (`ALLOW`).
*   **Montant financier en jeu :** **3 449,90 €** (Panier à récupérer + valeur LTV menacée).
*   **Tension Score :** `0.92 / 1.0`
*   **Raisonnement :** Le risque de fraude sur un nouvel appareil impose un contrôle (`STEP_UP_AUTH`), mais la fragilité de la fidélité client exige un parcours utilisateur ultra-fluide pour éviter le churn définitif.

---

## ✍️ Actions d'Écriture (Bloomreach Engagement)
Comme la décision finale est `STEP_UP_AUTH` (et non `BLOCK`), le système déclenche des actions compensatoires automatiques :
1.  **Génération d'un lien de paiement sécurisé à double facteur** (SMS/Email).
2.  **Attribution d'un code promotionnel de 10%** pour compenser la friction vécue (Recommandation du Retention Agent).
3.  **Création d'une tâche à priorité haute dans le CRM support** si l'authentification échoue dans les 10 minutes.

---

## 📝 Rapport Narratif (Narrative Engine)
> *"Sarah Mitchell, un client VIP (LTV 3200 €) à fort risque de désabonnement, a subi un échec de paiement de 249,90 € sur un appareil non reconnu (device_B). Le Risk Council a imposé une vérification STEP_UP_AUTH en raison d'anomalies de localisation, mais le Customer Council a obtenu l'envoi immédiat d'un coupon de fidélité pour atténuer la friction générée."*
