# 📋 Critical Submission & Verification Checklist

This document serves as the central register for diagnostics, verifications, and compliance checklists to validate LoomiFlow V4 before final hackathon submission.

---

## 1. Sandbox Robustness Diagnostic: Absence of Bloomreach Discovery
*   **Status**: Search and Merchandising features of Bloomreach Discovery are disabled in the hackathon sandbox (`silent-ukulele`).
*   **Resilience & Graceful Degradation verified in code**:
    1.  **Merchandising Agent Auto-Disable**: In [merchandisingAgent.ts](file:///core/agents/growthAgents/merchandisingAgent.ts), the agent checks `catalog.searchQualityScore`. If it is `null`, it returns `nullOpinion("merchandising", "NO_CATALOG_DATA")` gracefully, preventing any pipeline crashes.
    2.  **MCP Capability Detection**: In [stateBuilder.ts](file:///core/context/stateBuilder.ts), `buildCatalogState` checks the list of active MCP tools in session. If no search or catalog tools are detected, it dynamically sets `searchQualityScore` to `null`, triggering the agent's graceful fallback.
    3.  **API Write Isolation**: The execution engine in [writeApi.ts](file:///server/bloomreach/writeApi.ts) does not execute any Discovery writes (like `updateSearchRanking`). All writes are isolated to standard profile updates (LTV, Churn flag) and transaction tracking events, wrapped in strict `try/catch` blocks.

---

## 2. Integration & MCP Authentication (Read-Only)
*   **Gold Rule**: MCP is used **exclusively for reading data** (context enrichment) to keep response latency below the 1-second mark.
*   **Verifications**:
    *   The `mcp-remote` proxy configured via `npm run setup:mcp` correctly manages OAuth tokens and route parameters for the primary URL `https://loomi-mcp-alpha.bloomreach.com/mcp` (Customer data & profiles).
    *   A second MCP URL for conversation tools (Shopping / Clarity Search) is configured and documented: `https://uqa.api.exponea.dev/cocoaas/public/api/clarity-search/v1/mcp/019d4917-3c76-7479-9f00-06c620b231bb`. This enables the `Personal Shopper Agent` to query products using the `clarity_search` tool.
    *   If remote MCP servers fail, the `Context Quality Scorer` degrades the context score (Grades A-F) and dynamically adjusts council weights, preventing blind automation errors.


---

## 3. Submission Form Checklist
Make sure to copy-paste the following inputs in the final submission form:

*   [ ] **Demo Video (Max 5 minutes, Mandatory)**:
    *   *Script*: Follow the timeline defined in [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) to stay within the 5-minute limit.
*   [ ] **Architecture Diagram (Mandatory)**:
    *   *Asset*: Export the ASCII structure diagram (Layers 0 to 6) or the Mermaid sequence flow in the main [README.md](./README.md).
*   [ ] **Project Summary (2-4 sentences, Mandatory)**:
    *   *"LoomiFlow AI is an autonomous, headless real-time commerce operations engine that orchestrates complex decisions by connecting PayPal, Bloomreach Loomi Connect MCP, and Bloomreach Engagement REST APIs. It implements a synchronous Multi-Agent Consensus model grouped into Governance Councils and arbitrated by economic utility in an Opinion Market. It features in-session learning loops and full SRE telemetry (Memory Graph, Incident Reconstructor)."*
*   [ ] **MCP Usage Explanation (Mandatory & Crucial Grading Criteria)**:
    *   *"We utilize the Bloomreach Loomi Connect MCP exclusively for the Read phase (context prefetching) to enrich transactional triggers with real-time customer data (LTV, churn risk, recent event trails). This keeps execution latency sub-second. All write actions are isolated and triggered asynchronously via Bloomreach Engagement REST APIs."*
*   [ ] **Responsible AI Note (Mandatory)**:
    *   *"LoomiFlow implements an 'MCP Context Quality Score' that grades context completeness from A to F. If third-party APIs or MCP tools return degraded or empty payloads, the engine dynamically penalizes commercial agent weights and shifts authority to the Risk Council veto override, ensuring transparency and algorithmic safety under failure conditions."*
*   [ ] **GitHub Repository link is public and compiles cleanly.**
