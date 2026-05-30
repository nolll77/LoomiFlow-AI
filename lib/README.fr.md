# 🧰 Utilitaires & Observabilité (V2)

Bibliothèque partagée contenant les outils d'observabilité avancés.

## Modules V2 (Hackathon Exclusives)
- **`observabilityEnvelope.ts`** : Calcule le coût en tokens, la latence de chaque étape (MCP, LLM, Agents) et détecte les anomalies.
- **`memoryGraph.ts`** : Transforme les appels d'outils MCP en un graphe directionnel (DAG) pour expliquer précisément *pourquoi* une décision a été prise.
- **`incidentReconstructor.ts`** : Outil de debug de crise. En cas de décision catastrophique (faux positif), il rejoue la trace pour trouver la "Root Cause".
- **`replayBuffer.ts`** : Stocke les 100 dernières décisions en mémoire circulaire pour permettre un replay UI à différentes vitesses.

[🇬🇧 English Version](./README.md)
