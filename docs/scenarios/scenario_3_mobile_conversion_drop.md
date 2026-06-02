# 📱 Scénario 3 : Chute de Conversion Mobile (Mobile Conversion Drop)
### *Alerte SRE & Optimisation Dynamique du Merchandising*

Ce scénario illustre l'aspect **State-Aware / SRE** de LoomiFlow. Contrairement aux scénarios transactionnels centrés sur un utilisateur unique, cet événement cible une anomalie de performance globale affectant un segment entier de la plateforme.

---

## 📡 Signal Déclencheur (Conversion Anomaly Event)
Le système de monitoring des performances de LoomiFlow détecte une chute brutale du taux de conversion sur le segment mobile en Europe :
*   **Taux de chute (dropRate) :** -34% en 5 minutes.
*   **Utilisateurs impactés :** 847 visiteurs simultanés.
*   **Perte financière estimée :** 1 200 € / heure de dysfonctionnement.

```json
{
  "id": "evt_anomaly_1717318200",
  "type": "conversion_anomaly",
  "customerId": "system",
  "value": 1200,
  "metadata": {
    "segment": "mobile_eu",
    "dropRate": 0.34,
    "affectedUsers": 847
  }
}
```

---

## 🧠 Flux de Traitement V4 (Step-by-Step)

```text
[Signal Anomaly] ──► MCP (Vitesse pages & logs) ──► Revenue Council (THROTTLE / RERANK) ──► Rerank & Shadow Routing
```

### Étape 1 : Diagnostic par le Context Engine
Le routeur intelligent appelle les outils MCP pour analyser les logs système récents :
*   **Vitesse de chargement (LCP) :** Dégradation du temps de chargement des images produits sur mobile (LCP passé de 1.8s à 4.2s).
*   **Erreurs de recherche :** Le moteur Bloomreach Search sur mobile renvoie des temps de réponse supérieurs à 800ms sur les requêtes de la catégorie `premium-fashion`.

### Étape 2 : Délibération des Councils
1.  **Revenue Council (Growth Agent: Merchandising)**
    *   *Opinion :* Le taux de conversion s'effondre car les images et résultats de recherche prennent trop de temps à s'afficher. Il faut simplifier les requêtes de tri et réduire la taille des payloads.
    *   *Recommandation :* `THROTTLE` (Simplifier le classement de recherche et ré-ordonner dynamiquement pour prioriser les articles légers sans facettes lourdes).
    *   *Confiance :* **88%**

2.  **Risk Council (Guardian Agent: SRE)**
    *   *Opinion :* Risque opérationnel élevé. Si le serveur de recherche sature, toute la plateforme peut tomber.
    *   *Recommandation :* `THROTTLE` (Activer le mode dégradé).
    *   *Confiance :* **90%**

3.  **Customer Council (Growth Agent: Personal Shopper)**
    *   *Opinion :* Les utilisateurs mobiles subissent une mauvaise expérience. Il faut basculer l'affichage vers des recommandations statiques en cache.
    *   *Recommandation :* `THROTTLE`
    *   *Confiance :* **70%**

### Étape 3 : Décision de l'Opinion Market
*   **Décision finale :** `THROTTLE` (Basculer la plateforme mobile en mode de performance optimisé).
*   **Type de Coalition :** `UNANIMOUS COALITION` (Tous les conseils s'accordent sur l'urgence d'une réduction de charge et d'un réalignement du merchandising).

---

## ✍️ Actions d'Écriture (Bloomreach Engagement & Merchandising)
LoomiFlow déclenche immédiatement des écritures correctrices :
1.  **Modification du Ranking Rule (Rerank) :** Désactivation temporaire des algorithmes de personnalisation lourds (Deep Learning) au profit d'un tri simple par popularité (cache statique de 60s).
2.  **SRE Routing modification :** Ajustement des règles de trafic (basculement de 15% du trafic mobile vers une route CDN allégée).
3.  **Alerte Slack/SRE automatisée** avec l'ensemble des diagnostics techniques.

---

## 📝 Rapport Narratif (Narrative Engine)
> *"Le système a détecté une chute de 34% de la conversion sur mobile EU affectant 847 utilisateurs. Une coalition UNANIME a décidé d'activer le mode THROTTLE pour sauvegarder les performances. Le moteur de recherche a été simplifié (tri par popularité statique) et 15% du trafic a été redirigé vers l'infrastructure de secours, ramenant le LCP mobile sous le seuil critique."*
