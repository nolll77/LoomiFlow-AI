# 🛒 Scénario 4 : Récupération de Panier Abandonné (Cart Abandonment Recovery)
### *Orchestration Commerciale Standard & Relance Personnalisée*

Ce scénario représente le fonctionnement nominal (sans urgence critique ni fraude suspectée) de LoomiFlow. Il montre comment les agents marketing collaborent pour récupérer un panier abandonné en s'adaptant à l'historique d'un client standard.

---

## 👥 Profil du Client
*   **Identité :** John Doe (`user_pacific_442`)
*   **Segment :** Standard (LTV cumulée : **420 €** sur 3 commandes)
*   **État critique :** Risque de churn modéré (**45%**).

---

## 📡 Signal Déclencheur (Cart Abandonment Event)
LoomiFlow reçoit un signal indiquant qu'un panier d'une valeur de **89,00 €** a été laissé de côté depuis plus de 30 minutes sans transaction finalisée :

```json
{
  "id": "evt_cart_1717319000",
  "type": "cart_abandonment",
  "customerId": "user_pacific_442",
  "value": 89.00,
  "currency": "EUR",
  "deviceId": "device_A"
}
```

---

## 🧠 Flux de Traitement V4 (Step-by-Step)

```text
[Signal] ──► MCP (get_customer_properties) ──► Revenue Council & Customer Council ──► ALLOW (Campaign Triggered)
```

### Étape 1 : Enrichissement par le MCP
Le `Context Engine` récupère l'état :
*   Le client est `standard` avec une LTV modeste de 420 €.
*   L'historique montre que John ouvre environ 50% de ses emails promotionnels.

### Étape 2 : Délibération des Councils
1.  **Revenue Council (Growth Agent: Recovery)**
    *   *Opinion :* Le panier est de 89 €. Comme la LTV est faible, proposer un code promo trop élevé (ex: -15% ou -20%) détruirait notre marge commerciale. Une relance simple ou un petit coupon de 5% suffit.
    *   *Recommandation :* `ALLOW` (Déclencher la campagne de récupération par email avec coupon de 5%).
    *   *Confiance :* **75%**

2.  **Customer Council (Growth Agent: Retention)**
    *   *Opinion :* Le risque de churn est modéré (45%). L'envoi d'un email de relance personnalisé avec le produit abandonné est la meilleure solution pour maintenir le contact.
    *   *Recommandation :* `ALLOW`
    *   *Confiance :* **80%**

3.  **Risk Council**
    *   *Opinion :* Aucun signal suspect détecté. Transaction à bas risque.
    *   *Recommandation :* `ALLOW`
    *   *Confiance :* **95%**

### Étape 3 : Opinion Market
*   **Décision finale :** `ALLOW`
*   **Type de Coalition :** `UNANIMOUS COALITION` (Les trois conseils approuvent la décision commerciale d'envoi de la campagne).

---

## ✍️ Actions d'Écriture (Bloomreach Engagement)
Le système écrit dans Bloomreach Engagement pour exécuter le plan de remédiation :
1.  **Déclenchement du scénario :** `recovery_campaign_triggered`.
2.  **Payload d'action :**
    *   *Canal :* Email (en raison du taux d'ouverture de 50%).
    *   *Stratégie :* Offre promotionnelle douce (-5%).
    *   *Lien de panier auto-rempli* avec le produit stocké dans l'événement.

---

## 📝 Rapport Narratif (Narrative Engine)
> *"John Doe (Client Standard, LTV 420 €) a abandonné un panier de 89,00 €. Une coalition UNANIME des conseils a approuvé le déclenchement d'une campagne de récupération commerciale. Un email contenant un lien de paiement et un coupon de 5% de réduction a été envoyé automatiquement, avec une estimation de gain de 42 € sur la probabilité de conversion."*
