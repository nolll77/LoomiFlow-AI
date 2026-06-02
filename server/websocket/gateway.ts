// server/websocket/gateway.ts
import { WebSocketServer, WebSocket } from "ws"

let wss: WebSocketServer | null = null
const clients = new Set<WebSocket>()

export function initWebSocketServer(port = 8080) {
  if (wss) return wss
  wss = new WebSocketServer({ port })

  wss.on("connection", (ws) => {
    clients.add(ws)
    console.log(`[WS] Client connected — total: ${clients.size}`)
    ws.send(JSON.stringify({ type: "CONNECTED", payload: { timestamp: Date.now() } }))

    ws.on("close", () => {
      clients.delete(ws)
      console.log(`[WS] Client disconnected — total: ${clients.size}`)
    })
    ws.on("error", (err) => {
      console.error("[WS] Error:", err.message)
      clients.delete(ws)
    })
  })

  wss.on("error", (err) => console.error("[WS] Server error:", err.message))
  console.log(`[WS] Server started on port ${port}`)
  return wss
}

export function sendWebSocket(message: object) {
  const data = JSON.stringify(message)
  let sent = 0
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
      sent++
    }
  }
  if (clients.size > 0) console.log(`[WS] Sent to ${sent}/${clients.size} clients`)
}

export function getConnectedClients() { return clients.size }

// Auto-start the server when imported on the server-side
if (typeof window === "undefined") {
  try {
    const port = typeof process !== "undefined" ? parseInt(process.env.WS_PORT || "8080", 10) : 8080
    initWebSocketServer(port)
  } catch (err: any) {
    console.warn("[WS] Auto-start skipped or failed:", err.message)
  }
}
