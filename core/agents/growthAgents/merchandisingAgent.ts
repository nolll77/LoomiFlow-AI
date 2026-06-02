// core/agents/growthAgents/merchandisingAgent.ts
import type { CommerceKnowledgeState } from "@/core/shared/commerceState"
import type { AgentOpinion } from "@/core/shared/agentTypes"
import { nullOpinion } from "./helpers"

export async function merchandisingAgent(state: CommerceKnowledgeState): Promise<AgentOpinion> {
  const { catalog, revenue } = state

  if (catalog.searchQualityScore == null) {
    return nullOpinion("merchandising", "NO_CATALOG_DATA")
  }

  const opportunity =
    catalog.rankingDrift > 0.3                      ? "RERANK_SEARCH_RESULTS" :
    catalog.stockAlerts.length > 3                  ? "FEATURE_LOW_STOCK_URGENCY" :
    catalog.trendingProducts.length > 0             ? "BOOST_TRENDING" :
    catalog.topUnderperformingProducts.length > 2   ? "DEMOTE_UNDERPERFORMING" :
                                                      "NO_ACTION"

  const conversionUplift =
    opportunity === "RERANK_SEARCH_RESULTS"       ? 0.08 :
    opportunity === "BOOST_TRENDING"              ? 0.06 :
    opportunity === "FEATURE_LOW_STOCK_URGENCY"   ? 0.12 : 0

  return {
    agentId: "merchandising",
    recommendation: opportunity,
    confidence: catalog.searchQualityScore > 0.7 ? 0.82 : 0.55,
    dataQuality: catalog.searchQualityScore ?? 0.5,
    reasoning: [
      `Search quality: ${(catalog.searchQualityScore * 100).toFixed(0)}%`,
      `Ranking drift: ${catalog.rankingDrift.toFixed(2)}`,
      `Stock alerts: ${catalog.stockAlerts.length} products`,
      `Trending: ${catalog.trendingProducts.slice(0, 3).join(", ") || "none"}`,
      `Underperforming: ${catalog.topUnderperformingProducts.slice(0, 3).join(", ") || "none"}`,
    ],
    expectedOutcome: { conversionUplift },
    urgency: "low",
    requiredActions: opportunity !== "NO_ACTION" ? [{
      type: "search_update",
      tool: "updateSearchRanking",
      params: {
        action: opportunity,
        products: catalog.trendingProducts.slice(0, 5),
        customerId: state.event.customerId,
      },
      estimatedImpact: revenue.aov * conversionUplift * 100,
      rollbackable: true,
    }] : [],
    dataQualityFlags: catalog.searchQualityScore < 0.5 ? ["LOW_CATALOG_DATA_QUALITY"] : [],
  }
}
