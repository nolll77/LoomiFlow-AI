# LoomiFlow V4 — Demo Script (5 min)

## 00:00 — Ouverture
**Ouvrir `/cockpit`**
> "LoomiFlow n'est pas un agent. C'est une organisation autonome de commerce."

---

## 00:20 — Architecture
**Montrer l'architecture en StatusBar**
> "9 agents spécialisés, 3 Councils, 1 Opinion Market, 1 Learning Agent"

---

## 00:40 — VIP Payment Failure
**Cliquer "VIP Payment Failure"**
> "Regardez les 3 Councils s'activer en parallèle"

- Risk Council: `STEP_UP_AUTH`
- Revenue Council: `RECOVERY_CAMPAIGN` + `RETENTION_OFFER`
- Customer Council: `VIP_OUTREACH` + `PREMIUM_BUNDLE`

---

## 01:15 — Business Impact Panel
**Montrer le BusinessImpactPanel**
> "Fraud prevented: €0 | Revenue recovered: €728 | Retention gain: +18%"
> "Total ROI: €1,036 pour $0.0001 de compute"
> **"ROI multiple: 10,360x"** ← phrase qui fait décrocher les machoires

---

## 01:45 — Opinion Market
**Montrer CouncilsPanel → Opinion Market**
> "Risk utility: 0.847, Revenue: 0.623, Customer: 0.412"
> "Risk Council WINS — STEP_UP_AUTH avec 87% confidence"
> "Mais Revenue et Customer executent aussi leurs actions"

---

## 02:15 — Counterfactuals
**Ouvrir Decision Debugger → onglet WHY NOT?**
> Counterfactuals : "Si fraudScore était 0.39 au lieu de 0.72 → ALLOW"
> "Le système ne dit pas juste NON. Il dit ce qui manque pour dire OUI."

---

## 02:45 — Learning Agent
**Déclencher 15 events via Load Test**
> Montrer LearningPanel qui s'active en violet : "ADAPTING"
> "Threshold block est passé de 0.85 à 0.87 — le système détecte sur-détection"
> "Aucun retraining. Aucun déploiement. Adaptation en session."

---

## 03:15 — Trace View
**Vue TRACE**
> "8 MCP tools appelés, smart routing selon event type"
> "Merchandising Agent a détecté ranking drift 0.34 → search reranked"

---

## 03:45 — Traffic / SRE
**Vue TRAFFIC**
> "SRE: 85/10/5 prod/canary/shadow"
> "Rollback auto si fraud > 30%"

---

## 04:15 — Executive Summary
**ExecutiveSummary en haut du cockpit**
> "STEP_UP_AUTH | Fraud prevented: €0 | Recovery: €728 | LTV protected: €1,250 | ROI: €1,036 (10,360x)"
> **"Une décision. 1.4 secondes. €1,036 de valeur créée."**

---

## 04:45 — Boucle complète
> "Event → 6 MCP tools → 3 Councils → 9 agents → Opinion Market → ExecutionPlan → 3 Bloomreach writes → Learning"
> **"C'est ça Track 6."**

---

## 05:00 — Questions
