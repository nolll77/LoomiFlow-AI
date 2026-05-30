# 🛡️ Couche SRE & Résilience (Core)

Ce dossier gère la fiabilité de la production (*Site Reliability Engineering*).

## Fonctionnalités
- **`trafficController.ts`** : Implémente le "Traffic Split". Les événements sont routés dynamiquement :
  - **Prod (85%)** : Exécution normale et écriture dans Bloomreach.
  - **Canary (10%)** : Test de nouveaux comportements.
  - **Shadow (5%)** : Simulation en arrière-plan sans impacter le client.
- **`rollback.ts`** : Surveillance automatisée. Si le taux d'erreur dépasse 5% ou le taux de fraude explose au-dessus de 30%, le Kill Switch est activé et la production est coupée pour protéger l'e-commerce.

[🇬🇧 English Version](./README.md)
