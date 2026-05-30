# MCP Integration Guide

## Connection
URL: https://loomi-mcp-alpha.bloomreach.com/mcp (NO trailing slash)
Auth: OAuth2 via mcp-remote

## For Claude Code:
```bash
# Se déconnecter de https://uqa.app.exponea.dev/ d'abord
claude mcp add loomi-mcp -- npx -y mcp-remote https://loomi-mcp-alpha.bloomreach.com/mcp
```

## Key Tools (83 available):
1. get_customer_properties → tier, LTV, preferences
2. get_customer_prediction_score → churn risk (0-1)
3. list_customer_events → behavioral history
4. execute_analytics → real-time metrics
5. get_scenario → active journey state
6. get_api_trigger → trigger URL for write operations

## Known Issues:
- list_catalogs returns empty → use get_catalog with direct ID
- MCP calls can take 10-30s → implement timeout of 35s
- Auth: must log out of Engagement UI before authenticating MCP

## Sandbox:
- Project: silent-ukulele (Pacific Apparel data)
- ~123K customers with apparel purchase history
