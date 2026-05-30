import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { buildObservabilityEnvelope } from "../lib/observabilityEnvelope";
import { buildAgentMemoryGraph } from "../lib/memoryGraph";
import { reconstructIncidentFromTrace } from "../lib/incidentReconstructor";
import { withRetry } from "../lib/retryEngine";
import { ReplayBuffer } from "../lib/replayBuffer";
import { runFullAgentPipeline } from "../core/agents/orchestrator";
import { DEMO_SCENARIOS } from "../lib/mockEvents";
import * as fs from "fs";
import * as path from "path";

const LOG_DIR = path.join(process.cwd(), "local-prints");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const logFile = path.join(LOG_DIR, `test-observability-${Date.now()}.log`);

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + "\n");
}

async function runTests() {
  log("============================================================");
  log("🔭 LOOMIFLOW AI — OBSERVABILITY & V2 MODULE TESTS");
  log("============================================================\n");

  let passed = 0;
  const tests = 5;

  try {
    const event = DEMO_SCENARIOS.vipPaymentFailure;
    const mcpCtx = event.mcpContext || { customerId: event.customerId, fetchedAt: Date.now() };
    const trace = await runFullAgentPipeline(event, mcpCtx, false);
    
    // 1. Envelope
    log("\n▶ TEST: Observability Envelope");
    const envelope = buildObservabilityEnvelope(trace);
    if (envelope.tokens.total > 0 && envelope.tokens.costUsd > 0) {
      log(`  ✅ Cost & Tokens calculated: $${envelope.tokens.costUsd.toFixed(5)}`);
      passed++;
    } else throw new Error("Invalid tokens/cost");

    // 2. Memory Graph
    log("\n▶ TEST: Memory Graph");
    const graph = buildAgentMemoryGraph(trace);
    if (graph.nodes.length > 0 && graph.edges.length > 0) {
      log(`  ✅ Graph built: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
      passed++;
    } else throw new Error("Empty graph");

    // 3. Incident Reconstructor
    log("\n▶ TEST: Incident Reconstructor");
    // Inject a long delay to trigger latency incident
    const slowTrace = { ...trace, timeline: [...trace.timeline, { time: "now", label: "slow_mcp", type: "mcp" as any, durationMs: 3000 }] };
    const incident = reconstructIncidentFromTrace(slowTrace);
    if (incident && incident.severity > 0) {
      log(`  ✅ Incident detected: ${incident.type} (Severity: ${incident.severity})`);
      passed++;
    } else throw new Error("Failed to detect incident");

    // 4. Retry Engine
    log("\n▶ TEST: Retry Engine");
    let attempts = 0;
    const mockFailingCall = async () => {
      attempts++;
      log(`    ...attempt ${attempts}`);
      if (attempts < 3) throw new Error("Transient error");
      return "Success";
    };
    const retryResult = await withRetry(mockFailingCall, { maxAttempts: 3, baseDelayMs: 10, jitter: false });
    if (retryResult.success && retryResult.attempts === 3) {
      log(`  ✅ Retry succeeded after ${retryResult.attempts} attempts`);
      passed++;
    } else throw new Error("Retry logic failed");

    // 5. Replay Buffer
    log("\n▶ TEST: Replay Buffer");
    const buffer = new ReplayBuffer(10);
    buffer.push(trace);
    buffer.push(trace);
    buffer.push(trace);
    log(`    ...buffer size: ${buffer.size()}`);
    const items = buffer.drain();
    log(`    ...buffer drained size: ${buffer.size()}`);
    if (items.length === 3 && buffer.size() === 0) {
      log(`  ✅ Replay buffer pushed and drained successfully`);
      passed++;
    } else throw new Error("Buffer logic failed");

  } catch (e: any) {
    log(`  ❌ FATAL FAIL: ${e.message}`);
  }

  log("\n============================================================");
  log(`SUMMARY: ${passed}/${tests} tests passed.`);
  log("============================================================");
}

runTests().catch(e => console.error(e));
