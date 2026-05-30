import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { runFullAgentPipeline } from "../core/agents/orchestrator";
import { DEMO_SCENARIOS } from "../lib/mockEvents";
import * as fs from "fs";
import * as path from "path";

const LOG_DIR = path.join(process.cwd(), "local-prints");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const logFile = path.join(LOG_DIR, `test-pipeline-${Date.now()}.log`);

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + "\n");
}

async function runTests() {
  log("============================================================");
  log("🚀 LOOMIFLOW AI — PIPELINE E2E TESTS");
  log("============================================================\n");

  const scenarios = Object.keys(DEMO_SCENARIOS) as (keyof typeof DEMO_SCENARIOS)[];
  let passed = 0;

  for (const scenario of scenarios) {
    log(`\n▶ PIPELINE: ${scenario}`);
    const t0 = Date.now();
    
    try {
      const event = DEMO_SCENARIOS[scenario];
      const mcpCtx = event.mcpContext || { customerId: event.customerId, fetchedAt: Date.now() };
      
      const trace = await runFullAgentPipeline(event, mcpCtx, false);
      
      log(`  [TRACE] Decision: ${trace.finalDecision}`);
      log(`  [TRACE] Timeline spans: ${trace.timeline.length}`);
      log(`  [TRACE] Observability: ${trace.observability ? "Attached ✅" : "Missing ❌"}`);
      if (trace.observability) {
          log(`    - Cost: $${trace.observability.tokens.costUsd.toFixed(5)}`);
          log(`    - Latency Bottleneck: ${trace.observability.latency.bottleneck}`);
      }
      log(`  [TRACE] Memory Graph: ${trace.memoryGraph ? "Attached ✅" : "Missing ❌"}`);

      if (!trace.observability || !trace.memoryGraph || trace.timeline.length < 5) {
          throw new Error("Missing required V2 trace data");
      }

      log(`  ✅ PASS (${Date.now() - t0}ms)`);
      passed++;
    } catch (e: any) {
      log(`  ❌ FAIL (${Date.now() - t0}ms): ${e.message}`);
    }
  }

  log("\n============================================================");
  log(`SUMMARY: ${passed}/${scenarios.length} pipelines passed.`);
  log("============================================================");
}

runTests().catch(e => console.error(e));
