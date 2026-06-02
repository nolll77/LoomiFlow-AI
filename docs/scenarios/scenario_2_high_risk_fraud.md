# 🛡️ Scénario 2 : Fraude Bancaire Critique (High Risk Fraud)
### *Override Absolu par Veto du Risk Council*

Ce scénario montre le mécanisme de sécurité ultime de LoomiFlow V4 : le **Veto Absolu**. Lorsque le niveau de suspicion de fraude dépasse les limites de tolérance, le système court-circuite l'évaluation commerciale et bloque immédiatement la transaction.

---

## 👥 Profil du Client
*   **Identité :** John Doe (`user_pacific_442`)
*   **Segment :** Standard (LTV cumulée : **420 €** sur 3 commandes)
*   **État critique :** Client sain, aucun risque de churn particulier.

---

## 📡 Signal Déclencheur (PayPal Webhook)
Un événement suspect est reçu avec des signaux de fraude multiples et convergents :
*   Le compte PayPal de l'acheteur tente une transaction de **450,00 €** (inhabituellement élevée par rapport au panier moyen du client).
*   **Alerte vélocité critique :** 5 tentatives en moins de 60 secondes.
*   Incohérence géographique majeure (IP provenant d'un pays blacklisté alors que le device habituel est localisé en Europe).
*   Score de risque PayPal : **0.96** (Extrêmement élevé).

```json
{
  "id": "evt_fraud_1717317800",
  "type": "payment_failed",
  "customerId": "user_pacific_442",
  "value": 450.00,
  "currency": "EUR",
  "deviceId": "device_Z",
  "paypalData": {
    "transactionId": "PAYPAL_TX_FRAUD_999",
    "status": "DECLINED",
    "declineReason": "SUSPECTED_FRAUD",
    "fraudSignals": {
      "velocityAnomaly": true,
      "deviceMismatch": true,
      "geoInconsistency": true,
      "riskScore": 0.96
    }
  }
}
```

---

## 🧠 Flux de Traitement V4 (Step-by-Step)

```text
[Signal] ──► MCP (Vérifications) ──► Risk Council (BLOCK, Conf: 98%) ──► VETO instantané ──► BLOCK (Sans négociation)
```

### Étape 1 : Analyse Contextuelle MCP
*   Le `Context Engine` tente d'enrichir l'historique de John Doe. 
*   L'historique montre des paniers habituels à moins de 80 € et aucun changement d'appareil récent. L'apparition soudaine de `device_Z` avec 5 tentatives de paiement à 450 € confirme une anomalie de comportement radicale.

### Étape 2 : Délibération des Councils & Veto
1.  **Risk Council (Guardian Agent: Fraud)**
    *   *Opinion :* Attaque par vol de session ou vol de carte bancaire confirmée.
    *   *Recommandation :* `BLOCK` (Blocage immédiat).
    *   *Confiance :* **98%**

2.  **Revenue Council**
    *   *Opinion :* Le client a une faible LTV (420 €) et le panier frauduleux représente un risque de chargeback (frais de rétrofacturation) supérieur au gain commercial potentiel.
    *   *Recommandation :* `BLOCK`
    *   *Confiance :* **90%**

3.  **Customer Council**
    *   *Opinion :* Bien qu'il s'agisse d'un utilisateur existant, la sécurisation du compte est prioritaire.
    *   *Recommandation :* `BLOCK` (avec mise en quarantaine du compte).
    *   *Confiance :* **85%**

### Étape 3 : Application du Veto dans l'Opinion Market
Dès que le **Risk Council** propose `BLOCK` avec une confiance supérieure au seuil critique de **0.85** (ici **98%**), l'Opinion Market active son garde-fou de sécurité :
*   **Décision finale :** `BLOCK`
*   **Type de Coalition :** `VETO COALITION` (Le Risk Council impose son veto absolu. Les négociations d'utilité et de ROI commercial sont désactivées).

---

## ✍️ Actions d'Écriture (Bloomreach Engagement)
Aucune tentative de récupération commerciale n'est tentée pour limiter l'exposition :
1.  **Blacklist de l'empreinte de l'appareil** (`device_Z`) et de l'adresse IP associée dans Bloomreach Engagement.
2.  **Verrouillage temporaire du compte client** `user_pacific_442` pour prévenir d'autres attaques.
3.  **Envoi d'une alerte SRE de niveau Critique** pour signaler une tentative d'attaque par brute-force ou usurpation d'identité.

---

## 📝 Rapport Narratif (Narrative Engine)
> *"Risk Council VETO: Le Risk Council a imposé un VETO absolu avec une confiance de 98% pour bloquer la transaction. Des anomalies majeures de vélocité et de géolocalisation indiquent une tentative de piratage du compte de John Doe. Le compte a été mis en quarantaine et aucune campagne marketing n'a été déclenchée."*
