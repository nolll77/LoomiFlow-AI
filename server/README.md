# 🌐 LoomiFlow Server — `server/`

> **Read time: ~2 min** | Hackathon Loomi Connect 2026

---

## Files

| File | Role |
|------|------|
| `mcp/client.ts` | MCP protocol client — reads agent context & traces |
| `bloomreach/writeApi.ts` | Bloomreach REST write — pushes decisions to CRM |
| `paypal/client.ts` | PayPal SDK wrapper — charges, refunds, captures |
| `websocket/gateway.ts` | WebSocket gateway — real-time event streaming |
| `firebase/sync.ts` | Firebase Firestore sync — persists state & replays |

---

## Architecture Overview

```
  ┌─────────────────────────────────────────────────────────┐
  │                    LoomiFlow Server                      │
  │                                                         │
  │   ┌───────────────┐       ┌──────────────────────────┐  │
  │   │  MCP Client   │──READ→│  Agent Traces / Context  │  │
  │   │ (mcp/client)  │       │  (core/mcp/traceGraph)   │  │
  │   └───────────────┘       └──────────────────────────┘  │
  │                                                         │
  │   ┌───────────────┐       ┌──────────────────────────┐  │
  │   │  Bloomreach   │←WRITE─│  Agent Decision Output   │  │
  │   │  writeApi     │       │  (fraud/revenue/cx)      │  │
  │   └───────────────┘       └──────────────────────────┘  │
  │                                                         │
  │   ┌───────────────┐       ┌──────────────────────────┐  │
  │   │  PayPal       │←WRITE─│  Charge / Refund / Hold  │  │
  │   │  client       │       │  (fraudAgent BLOCK→hold) │  │
  │   └───────────────┘       └──────────────────────────┘  │
  │                                                         │
  │   ┌───────────────┐       ┌──────────────────────────┐  │
  │   │  WebSocket    │←PUSH──│  Live Event Stream       │  │
  │   │  gateway      │──────→│  Dashboard / Arena UI    │  │
  │   └───────────────┘       └──────────────────────────┘  │
  │                                                         │
  │   ┌───────────────┐                                     │
  │   │  Firebase     │  READ + WRITE  (state persistence)  │
  │   │  sync         │──────────────────────────────────── │
  │   └───────────────┘                                     │
  └─────────────────────────────────────────────────────────┘
```

---

## Read / Write Pattern

> **MCP reads. REST APIs write.**

```
[READ]   MCP Client      ──→  agent context, traces, reasoning chains
[WRITE]  Bloomreach API  ──→  customer segments, campaign triggers
[WRITE]  PayPal Client   ──→  payment actions (hold, charge, refund)
[WRITE]  Firebase sync   ──→  decision state, memory graph persistence
[PUSH]   WebSocket GW    ──→  real-time updates to connected UIs
```

---

## Credentials & Environment Variables

Add these to `.env.local` (never commit):

```bash
# MCP Client
MCP_SERVER_URL=http://localhost:3001
MCP_API_KEY=your_mcp_api_key

# Bloomreach
BLOOMREACH_API_KEY=your_br_api_key
BLOOMREACH_PROJECT_TOKEN=your_project_token
BLOOMREACH_BASE_URL=https://api.exponea.com

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENV=sandbox   # or 'production'

# Firebase
FIREBASE_PROJECT_ID=loomiflow-2026
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@loomiflow-2026.iam.gserviceaccount.com

# WebSocket
WS_PORT=4000
WS_CORS_ORIGIN=http://localhost:3000
```

---

## Quick Usage Examples

### MCP Client — read agent trace

```ts
import { mcpClient } from './mcp/client';

const trace = await mcpClient.getTrace({ traceId: 'trace_8f2a1c' });
// trace.agentName, trace.latencyMs, trace.reasoning
```

### Bloomreach — write a decision

```ts
import { bloomreachWriteApi } from './bloomreach/writeApi';

await bloomreachWriteApi.trackEvent({
  customerId: 'u_42',
  eventType: 'fraud_block',
  properties: { score: 0.91, action: 'BLOCK' },
});
```

### PayPal — place a hold

```ts
import { paypalClient } from './paypal/client';

const auth = await paypalClient.authorizePayment({
  orderId: 'order_xyz',
  amount: { value: '149.99', currencyCode: 'USD' },
});
// auth.status: 'CREATED' | 'APPROVED' | 'VOIDED'
```

### WebSocket — broadcast decision

```ts
import { wsGateway } from './websocket/gateway';

wsGateway.broadcast('agent:decision', {
  agentName: 'fraudAgent',
  action: 'BLOCK',
  eventId: 'evt_abc',
});
```

### Firebase — sync state

```ts
import { firebaseSync } from './firebase/sync';

await firebaseSync.persist('decisions', eventId, {
  action: 'BLOCK',
  score: 0.91,
  ts: Date.now(),
});
```

---

## Common Errors & Solutions

| Error | Cause | Fix |
|-------|-------|-----|
| `MCP_CONNECTION_REFUSED` | MCP server not running | Start with `npm run mcp:server` |
| `BLOOMREACH_401` | Expired API key | Rotate `BLOOMREACH_API_KEY` in `.env.local` |
| `PAYPAL_INVALID_CLIENT` | Wrong credentials or env | Check `PAYPAL_ENV=sandbox` matches key |
| `WS_CORS_BLOCKED` | Origin mismatch | Set `WS_CORS_ORIGIN` to match frontend URL |
| `FIREBASE_PERMISSION_DENIED` | Firestore rules too strict | Check `firestore.rules` allow read/write for service account |
| `ECONNRESET on PayPal` | Network flap | Already wrapped in `retryEngine` — check `PAYPAL_ENV` |

---

## 🐛 Quick Debug

```
[MCPClient]       connected to http://localhost:3001
[MCPClient]       trace fetched traceId=trace_8f2a latencyMs=12
[BloomreachAPI]   event tracked customerId=u_42 type=fraud_block → 200 OK
[PaypalClient]    auth created orderId=order_xyz status=CREATED
[WSGateway]       broadcast agent:decision to 4 clients
[FirebaseSync]    persisted decisions/evt_abc
[FirebaseSync]    PERMISSION_DENIED → check firestore.rules
```

**Tip:** Run `npm run server:dev` to start all server services with hot-reload. WebSocket gateway logs connections in real time.
