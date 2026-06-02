"use client"
import { useState } from "react"

interface SequenceDiagramPanelProps {
  lastDecision: any
}

export default function SequenceDiagramPanel({ lastDecision }: SequenceDiagramPanelProps) {
  const [activeStep, setActiveStep] = useState<number | null>(null)

  // Default mock values if no decision has run yet
  const event = lastDecision?.commerceState?.event ?? {
    id: "evt_demo",
    type: "checkout",
    value: 1200,
    customerId: "cust_vip",
    timestamp: Date.now()
  }

  const mcp = lastDecision?.commerceState ?? {
    mcpToolsUsed: ["get_customer_profile", "get_fraud_signals", "list_customer_events"],
    contextFetchLatencyMs: 120
  }

  const fraudAgent = lastDecision?.councils?.risk?.memberOpinions?.find((o: any) => o.agentId === "fraud") ?? {
    recommendation: "BLOCK",
    confidence: 0.95,
    fraudScore: 0.85,
    signals: ["velocity_anomaly", "device_change"]
  }

  const revenueAgent = lastDecision?.councils?.revenue?.memberOpinions?.find((o: any) => o.agentId === "revenue") ?? {
    recommendation: "PRIORITY_RECOVERY",
    confidence: 0.88,
    customerLTV: 6000
  }

  const cxAgent = lastDecision?.councils?.customer?.memberOpinions?.find((o: any) => o.agentId === "cx") ?? {
    recommendation: "RETENTION_OFFER",
    confidence: 0.85,
    churnRisk: "high"
  }

  const marketDecision = lastDecision?.marketDecision ?? {
    winningCouncil: "risk",
    finalDecision: lastDecision?.finalDecision ?? "ALLOW",
    confidence: 0.78,
    coalitionType: "VETO"
  }

  const writeActions = lastDecision?.writeActions ?? [
    { tool: "blockPayment", success: true }
  ]

  const steps = [
    {
      id: 0,
      title: "1. Événement Entrant",
      subtitle: "Ingestion du flux",
      desc: "L'événement e-commerce est reçu par la passerelle de transaction.",
      color: "from-blue-500 to-indigo-600",
      glow: "rgba(59,130,246,0.3)",
      details: [
        { label: "ID Event", val: event.id },
        { label: "Type", val: event.type },
        { label: "Valeur", val: `€${event.value}` },
        { label: "Client", val: event.customerId }
      ]
    },
    {
      id: 1,
      title: "2. Enrichissement MCP",
      subtitle: "Appels de contextes",
      desc: "Interrogation des serveurs de contexte MCP pour récupérer le profil client, le score de fraude et l'historique.",
      color: "from-purple-500 to-indigo-600",
      glow: "rgba(167,139,250,0.3)",
      details: [
        { label: "Outils MCP", val: mcp.mcpToolsUsed?.join(", ") || "Aucun" },
        { label: "Latence", val: `${mcp.contextFetchLatencyMs}ms` }
      ]
    },
    {
      id: 2,
      title: "3. Analyse des Agents",
      subtitle: "Évaluation d'opinions",
      desc: "Les agents V4 (Fraude, Revenu et CX) évaluent en parallèle l'état du système.",
      color: "from-sky-500 to-blue-600",
      glow: "rgba(14,165,233,0.3)",
      details: [
        { label: "Fraude (score)", val: `${((fraudAgent.fraudScore ?? 0.1) * 100).toFixed(0)}%` },
        { label: "Revenu (LTV)", val: `€${revenueAgent.customerLTV ?? 0}` },
        { label: "CX (Churn)", val: cxAgent.churnRisk ?? "low" }
      ]
    },
    {
      id: 3,
      title: "4. Alignement des Conseils",
      subtitle: "Propositions de consensus",
      desc: "Les conseils (Risk, Revenue, Customer) agrègent les opinions pour former des propositions d'actions.",
      color: "from-emerald-500 to-teal-600",
      glow: "rgba(16,185,129,0.3)",
      details: [
        { label: "Risque (Proposal)", val: lastDecision?.councils?.risk?.recommendation ?? "ALLOW" },
        { label: "Revenu (Proposal)", val: lastDecision?.councils?.revenue?.recommendation ?? "MONITOR" },
        { label: "Client (Proposal)", val: lastDecision?.councils?.customer?.recommendation ?? "STANDARD" }
      ]
    },
    {
      id: 4,
      title: "5. Opinion Market",
      subtitle: "Arbitrage & Consensus",
      desc: "Le marché d'opinion arbitre les intérêts conflictuels selon le type de coalition et la confiance globale.",
      color: "from-amber-500 to-orange-600",
      glow: "rgba(245,158,11,0.3)",
      details: [
        { label: "Gagnant", val: marketDecision.winningCouncil },
        { label: "Consensus", val: marketDecision.coalitionType },
        { label: "Confiance", val: `${(marketDecision.confidence * 100).toFixed(0)}%` }
      ]
    },
    {
      id: 5,
      title: "6. Exécution & Écriture",
      subtitle: "Actions finales",
      desc: "Enregistrement de la décision finale (BLOCK, ALLOW, etc.) et déclenchement des actions d'écritures Bloomreach.",
      color: "from-red-500 to-pink-600",
      glow: "rgba(239,68,68,0.3)",
      details: [
        { label: "Décision", val: lastDecision?.finalDecision ?? "HOLD" },
        { label: "Actions exécutées", val: writeActions?.map((a: any) => a.tool).join(", ") || "Aucune" }
      ]
    }
  ]

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-6 shadow-xl backdrop-blur-md">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Parcours de Requête Interactif (V4 Brain)</h2>
          <p className="text-xs text-slate-500">Passez votre curseur sur une étape pour zoomer sur la structure de données.</p>
        </div>
        {lastDecision?.id && (
          <div className="rounded-full bg-slate-900 px-3 py-1 text-2xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
            {lastDecision.id}
          </div>
        )}
      </div>

      {/* Horizontal Sequence Flow */}
      <div className="relative mt-12 mb-8 flex flex-col items-stretch gap-6 xl:flex-row xl:items-start xl:justify-between">
        
        {/* Connection line between nodes (desktop-only) */}
        <div className="absolute top-24 left-10 right-10 hidden h-[2px] bg-slate-200 xl:block -z-10" />

        {steps.map((step) => {
          const isActive = activeStep === step.id
          return (
            <div key={step.id} 
              onMouseEnter={() => setActiveStep(step.id)}
              onMouseLeave={() => setActiveStep(null)}
              className="flex-1 cursor-pointer transition-all duration-300">
              
              {/* Step Circle Card */}
              <div className={`relative flex flex-col items-center rounded-2xl border bg-white p-4 transition-all duration-300 ${isActive ? "border-slate-800 shadow-lg scale-105" : "border-slate-200/80 shadow-sm"}`}>
                
                {/* Visual Glow Circle */}
                <div className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${step.color} text-white shadow-md`}
                  style={{ boxShadow: isActive ? `0 0 20px ${step.glow}` : "none" }}>
                  <span className="text-lg font-bold font-mono">{step.id + 1}</span>
                </div>

                <div className="mt-4 text-center">
                  <div className="text-xs font-bold text-slate-800 tracking-tight">{step.title}</div>
                  <div className="text-3xs font-semibold uppercase tracking-wider text-slate-400 mt-0.5">{step.subtitle}</div>
                </div>

              </div>

              {/* Responsive Details / Interactive Tooltip Area */}
              <div className={`mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all duration-300 ${isActive ? "opacity-100 translate-y-0 scale-100 shadow-md bg-slate-50 border-slate-200" : "xl:opacity-40 xl:scale-95"}`}>
                <p className="text-3xs leading-relaxed text-slate-600">{step.desc}</p>
                
                <div className="mt-3 space-y-1.5 border-t border-slate-200/50 pt-2.5">
                  {step.details.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-4xs">
                      <span className="font-semibold text-slate-400 uppercase tracking-wider">{d.label}</span>
                      <span className="font-mono font-bold text-slate-800 break-all text-right max-w-[150px]">{d.val}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )
        })}

      </div>
    </div>
  )
}
