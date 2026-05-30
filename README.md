# 🚀 LoomiFlow AI — Autonomous Commerce Operations Agent

[![Hackathon](https://img.shields.io/badge/Hackathon-Loomi_Connect_2026-6366f1.svg?style=flat-square)](https://luma.com/loomi-connect-hackathon)
[![Track 6](https://img.shields.io/badge/Track-Cross__MCP__Orchestration-10b981.svg?style=flat-square)](#)
[![Stack](https://img.shields.io/badge/Stack-Next.js_15_|_TypeScript_|_Tailwind-blue.svg?style=flat-square)](#)

*LoomiFlow AI (ACOA)* is a **real-time, headless multi-agent commerce operations engine**. It detects signals, orchestrates cross-system decisions, and triggers automated workflows without building chat wrappers.

---

## 🎯 What It Does

LoomiFlow AI bridges **PayPal**, **Bloomreach Loomi Connect MCP**, and **Bloomreach Engagement REST APIs**:

1. 📡 **Listens** to transactional signals (e.g., PayPal payment failures).
2. 🧠 **Enriches** the signal by querying the Loomi Connect MCP for customer intelligence (LTV, Churn Risk, Segments, Funnel metrics).
3. ⚡ **Evaluates** the context using a synchronous Multi-Agent Consensus Engine (Fraud Agent vs. Revenue Agent vs. CX Agent).
4. 🎯 **Orchestrates** the conflicting outputs into a unified, deterministic decision (BLOCK, ALLOW, HOLD, STEP_UP_AUTH).
5. ✍️ **Takes Action** by writing back to Bloomreach Engagement via REST APIs to trigger a scenario (e.g., recovery email via Mailgun).

*(Note: The MCP is used exclusively for the Read phase to ensure low latency. The Write phase is handled via Bloomreach REST APIs, as advised by the Bloomreach product team).*

---

## 🏗️ Architecture & Diagram

```text
PayPal Webhook ──► MCP Context (5 tools) ──► Multi-Agent System ──► Bloomreach Write
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

*(See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full architecture).*

---

## 🏁 Quick Start

```bash
git clone <repo-url> loomiflow && cd loomiflow
npm install
cp .env.example .env.local   # Fill in Bloomreach & PayPal credentials
npm run dev                  # Start Next.js development server
# → Open http://localhost:3000/cockpit
```

### Commands

- `npm run test:all` : Runs the full test suite (Agents, E2E Pipeline, V2 Observability).
- `npm run setup:mcp` : Configures the `mcp-remote` proxy for authentication.

---

## 🧩 Key Components

### 1. Multi-Agent Engine
- **Fraud Agent (62%)**: Prioritizes safety and risk management.
- **Revenue Agent (23%)**: Safeguards LTV and minimizes cart abandonment loss.
- **CX Agent (15%)**: Ensures frictionless experience and prevents VIP churn.
- **Orchestrator**: Resolves agent conflicts via a strict matrix (e.g., VIP Protection Pattern).

### 2. SRE & Observability Layer (V2)
- **Traffic Controller**: Splits traffic (85% Prod, 10% Canary, 5% Shadow) and triggers auto-rollbacks.
- **Memory Graph**: Maps tool calls to decisions to provide deep explainability (The "Why" button).
- **Incident Reconstructor**: Analyzes DAGs to generate root-cause narratives.
- **Replay Buffer**: Netflix-style fast-forward trace replay.

---

## 📚 Documentation

- [🇫🇷 Lisez le README en Français](./README.fr.md)
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Full ASCII diagrams + pipeline flows
- [AGENTS_GUIDE.md](./docs/AGENTS_GUIDE.md) — Agent deep-dive + decision matrix
- [MCP_GUIDE.md](./docs/MCP_GUIDE.md) — MCP tools + auth + write patterns
- [MASTER_BUILD_GUIDE.md](./MASTER_BUILD_GUIDE.md) — Complete from-scratch build guide
- **Sub-READMEs**: [`core/agents`](./core/agents/README.md), [`core/sre`](./core/sre/README.md), [`lib`](./lib/README.md), [`server`](./server/README.md)

---
*Built by Team nöL for the Loomi Connect AI Hackathon 2026. Sandbox: silent-ukulele.*
