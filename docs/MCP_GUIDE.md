# 🔗 LoomiFlow AI — MCP Integration Guide

**Loomi Connect AI Hackathon 2026**  

This document explains how LoomiFlow AI communicates with the Bloomreach Loomi Connect MCP.

---

## 1. Official Connection Data

- **MCP URL**: `https://loomi-mcp-alpha.bloomreach.com/mcp`
  > **CRITICAL**: No trailing slash at the end (Confirmed by Saurav Saxenna @here).
- **Authentication**: OAuth2 PKCE via `mcp-remote`.
- **Command to add to Claude**:
  ```bash
  claude mcp add loomi-mcp -- npx -y mcp-remote https://loomi-mcp-alpha.bloomreach.com/mcp
  ```

---

## 2. Tools Overview

ACOA leverages 5 key Loomi Connect MCP tools for read-phase operations:

1. `get_customer_properties`: Extracts `tier` and `LTV`.
2. `get_customer_prediction_score`: Extracts `churnRisk`.
3. `list_customer_events`: Infers recent journey states and velocity.
4. `execute_analytics`: Aggregates funnel metrics.
5. `get_api_trigger`: Identifies the write-back URL for scenario execution.

*(Note: Per discussions with Peter Centgraf on Slack, real-time telemetry for running scenarios is not currently exposed via MCP, so `list_customer_events` is used instead to infer journey states rather than querying `get_scenario`).*

---

## 3. The Write-Back Pattern (Closed Loop)
*Confirmed by Paul Edwards (Bloomreach)*

The MCP strictly performs the READ phase. For the WRITE phase, we use Bloomreach Engagement REST APIs directly to close the loop:

1. **Read**: MCP calls gather customer context.
2. **Decide**: Agents determine the action.
3. **Write 1**: Call `updateCustomerProperty` to mark `recovery_initiated = true`.
4. **Write 2**: Call `trackCustomerEvent` to trigger a specific journey scenario.
5. **Action**: The Bloomreach scenario uses Mailgun to send the recovery email.

---

## 4. MCP Testing via curl

You can test the MCP connection using this curl command (it will return a 401 if PKCE auth isn't setup locally, which is expected behavior without the `mcp-remote` proxy):

```bash
curl -X POST https://loomi-mcp-alpha.bloomreach.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1,"params":{}}'
```

---

## 5. Known Issues & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `404 Not Found` | Trailing slash on MCP URL | Remove the `/` from `.env.local` |
| `401 Unauthorized` | Missing OAuth PKCE | Use `npx -y mcp-remote` proxy |
| `ECONNREFUSED` | `mcp-remote` not running | Run the setup script again |

## 📝 Proof of Capture
- Correct MCP URL and auth command.
- Detailed list of the 6 core tools.
- Explanation of the Read/Write loop pattern.
- Known issues and resolutions table.
