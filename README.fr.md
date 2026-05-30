# 🚀 LoomiFlow AI — Agent Autonome d'Opérations E-Commerce

[![Hackathon](https://img.shields.io/badge/Hackathon-Loomi_Connect_2026-6366f1.svg?style=flat-square)](https://luma.com/loomi-connect-hackathon)
[![Track 6](https://img.shields.io/badge/Track-Cross__MCP__Orchestration-10b981.svg?style=flat-square)](#)
[![Stack](https://img.shields.io/badge/Stack-Next.js_15_|_TypeScript_|_Tailwind-blue.svg?style=flat-square)](#)

*LoomiFlow AI (ACOA)* est un **moteur d'opérations e-commerce temps réel, headless et multi-agent**. Il détecte des signaux transactionnels, orchestre des décisions complexes en croisant plusieurs systèmes, et déclenche des scénarios automatisés (pas de simple "chat wrapper").

---

## 🎯 Ce qu'il fait

LoomiFlow AI connecte **PayPal**, **Bloomreach Loomi Connect MCP**, et les **API REST de Bloomreach Engagement** :

1. 📡 **Écoute** les signaux (ex: échec de paiement PayPal).
2. 🧠 **Enrichit** le contexte en interrogeant le MCP Loomi Connect (LTV, Risque de Churn, Segments).
3. ⚡ **Évalue** la situation via un moteur de consensus multi-agent synchrone (Agent Fraude vs. Agent Revenu vs. Agent CX).
4. 🎯 **Orchestre** les recommandations conflictuelles pour aboutir à une décision déterministe (BLOCK, ALLOW, HOLD, STEP_UP_AUTH).
5. ✍️ **Agit** en écrivant dans Bloomreach via les API REST pour déclencher un scénario de remédiation (ex: email via Mailgun).

*(Note : Le MCP est utilisé exclusivement pour la phase de Lecture/Intelligence. L'Écriture est gérée par les API REST pour des raisons de performance, comme recommandé par l'équipe Bloomreach).*

---

## 🏗️ Architecture

```text
PayPal Webhook ──► MCP Context (5 outils) ──► Système Multi-Agent ──► Bloomreach Write
                         │                          │
                   get_customer_            ┌───────┴────────┐
                   properties,             Fraud   Revenue   CX
                   prediction_score,       Agent   Agent     Agent
                   list_customer_events    (62%)   (23%)     (15%)
                                                │
                                          Orchestrator
                                      (BLOCK|ALLOW|HOLD|STEP)
                                                │
                                    Observability + Memory Graph
```

*(Voir [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) pour l'architecture complète).*

---

## 🏁 Démarrage Rapide

```bash
git clone <repo-url> loomiflow && cd loomiflow
npm install
cp .env.example .env.local   # Renseigner les clés API
npm run dev                  # Lancer le serveur de développement
# → Ouvrir http://localhost:3000/cockpit
```

### Commandes utiles

- `npm run test:all` : Lance la suite de tests complète (Agents, Pipeline E2E, Observabilité V2).
- `npm run setup:mcp` : Configure le proxy `mcp-remote` pour l'authentification OAuth.

---

## 🧩 Composants Clés

### 1. Moteur Multi-Agent
- **Agent Fraude (62%)** : Gère les risques et la sécurité.
- **Agent Revenu (23%)** : Protège la LTV et minimise les pertes.
- **Agent CX (15%)** : Assure une expérience sans friction et prévient le churn des VIPs.
- **Orchestrateur** : Résout les conflits via une matrice de décision stricte.

### 2. Couche SRE & Observabilité (V2)
- **Traffic Controller** : Divise le trafic (85% Prod, 10% Canary, 5% Shadow) avec rollback automatique.
- **Memory Graph** : Cartographie les décisions pour une explicabilité totale (Le bouton "Pourquoi").
- **Incident Reconstructor** : Analyse les DAGs pour générer des diagnostics automatiques en cas de crise.
- **Replay Buffer** : Permet de rejouer les traces dans l'interface (façon Netflix).

---

## 📚 Documentation

- [🇬🇧 Read the README in English](./README.md)
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Schémas ASCII de l'architecture.
- [AGENTS_GUIDE.md](./docs/AGENTS_GUIDE.md) — Matrice de décision et poids des agents.
- [MCP_GUIDE.md](./docs/MCP_GUIDE.md) — Authentification MCP et boucle de Write-back.
- [MASTER_BUILD_GUIDE.md](./MASTER_BUILD_GUIDE.md) — Guide complet de compilation.
- **Sous-dossiers** : [`core/agents`](./core/agents/README.fr.md), [`core/sre`](./core/sre/README.fr.md), [`lib`](./lib/README.fr.md), [`server`](./server/README.fr.md)

---
*Construit par la Team nöL pour le Hackathon Loomi Connect 2026. Sandbox : silent-ukulele.*
