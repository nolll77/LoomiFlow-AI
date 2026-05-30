# 🤖 Moteur Multi-Agent (Core)

Ce dossier contient la logique d'exécution des agents de **LoomiFlow AI**.

## Les 3 Agents Spécialisés
1. **`fraudAgent.ts` (Poids : 62%)** : Bloque ou demande une authentification forte (STEP_UP_AUTH) en cas de comportement suspect.
2. **`revenueAgent.ts` (Poids : 23%)** : Protège le panier moyen et les clients à forte valeur (VIP, LTV élevée).
3. **`cxAgent.ts` (Poids : 15%)** : S'assure que l'expérience reste fluide, surtout si le risque d'attrition (Churn Risk) est élevé.

## L'Orchestrateur (`orchestrator.ts`)
Il exécute les 3 agents en parallèle (`Promise.all`) et utilise une **Matrice de Décision** pour résoudre les conflits. Par exemple :
- Si la Fraude demande `BLOCK` mais que le LTV > 1000€, la décision est adoucie en `STEP_UP_AUTH` (VIP Protection Pattern).
- Il calcule également le score de `confidence` final.

## Arène (`arenaEngine.ts`)
Moteur de simulation permettant de faire "s'affronter" les agents visuellement dans le Cockpit WebGL.

[🇬🇧 English Version](./README.md)
