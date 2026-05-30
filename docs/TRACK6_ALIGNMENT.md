# Track 6 — Cross-MCP Orchestration: Alignment Proof

## What Track 6 Requires
Build agents that orchestrate MULTIPLE MCP surfaces into one intelligent workflow.

## What ACOA Does

### MCP Surfaces Crossed (3+):
| Surface | Tools Used | Purpose |
|---|---|---|
| Customer MCP | get_customer_properties, get_customer_prediction_score | Customer intelligence |
| Analytics MCP | execute_analytics, get_funnel | System-level anomalies |
| Scenario MCP | get_scenario, get_api_trigger | Journey state + write triggers |

### Orchestration Layer:
- Fraud Agent + Revenue Agent + CX Agent run in PARALLEL
- Orchestrator synthesizes conflicts → explicit reasoning
- Write back via REST API (confirmed Paul Edwards, May 28)

### Action Loop:
```
MCP reads → Agent decides → Bloomreach writes → Mailgun sends
```

### Pattern Validated by Bloomreach Team:
- Paul Edwards (May 28): confirmed all 3 write operations
- Peter Centgraf (PM Loomi Connect): narrowly-defined edits = our exact pattern
- Saurav Saxenna: Mailgun pre-integrated = email loop complete
