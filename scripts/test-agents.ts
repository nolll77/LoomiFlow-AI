import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { runOrchestrator } from "../core/agents/orchestrator";
import { getMockAgentOutputs } from "../lib/agentEngine";
import { DEMO_SCENARIOS } from "../lib/mockEvents";
import * as fs from "fs";
import * as path from "path";

const LOG_DIR = path.join(process.cwd(), "local-prints");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const logFile = path.join(LOG_DIR, `test-agents-${Date.now()}.log`);
function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + "\n");
}

async function runTests() {
  log("============================================================");
  log("🤖 LOOMIFLOW AI — AGENT UNIT TESTS");
  log("============================================================\n");

  const scenarios = Object.keys(DEMO_SCENARIOS) as (keyof typeof DEMO_SCENARIOS)[];
  let passed = 0;

  for (const scenario of scenarios) {
    log(`\n▶ TESTING SCENARIO: ${scenario}`);
    const t0 = Date.now();
    
    try {
      const event = DEMO_SCENARIOS[scenario];
      const mcpCtx = event.mcpContext || { customerId: event.customerId, fetchedAt: Date.now() };
      
      log(`  [INPUT] Event: ${JSON.stringify(event).substring(0, 100)}...`);
      log(`  [INPUT] MCP: ${JSON.stringify(mcpCtx).substring(0, 100)}...`);

      const { fraudOutput, revenueOutput, cxOutput } = getMockAgentOutputs(event);
      
      log(`  [OUTPUT] Fraud Agent: ${fraudOutput.recommendation} (Score: ${fraudOutput.score})`);
      log(`  [OUTPUT] Revenue Agent: ${revenueOutput.recommendation} (LTV: ${revenueOutput.customerLTV})`);
      log(`  [OUTPUT] CX Agent: ${cxOutput.recommendation} (Churn Risk: ${cxOutput.churnRisk})`);

      const decision = await runOrchestrator(event, mcpCtx, fraudOutput, revenueOutput, cxOutput, false);
      
      log(`  [ORCHESTRATOR] Final Decision: ${decision.finalDecision}`);
      log(`  [ORCHESTRATOR] Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
      log(`  [ORCHESTRATOR] Reasoning: ${decision.reasoning[0]}`);

      if (!decision.finalDecision) throw new Error("Missing finalDecision");
      if (decision.confidence <= 0 || decision.confidence > 1) throw new Error("Invalid confidence");
      if (decision.consensusWeights.fraud !== 0.62) throw new Error("Invalid fraud weight");

      log(`  ✅ PASS (${Date.now() - t0}ms)`);
      passed++;
    } catch (e: any) {
      log(`  ❌ FAIL (${Date.now() - t0}ms): ${e.message}`);
    }
  }

  log("\n============================================================");
  log(`SUMMARY: ${passed}/${scenarios.length} tests passed.`);
  log("============================================================");
}

runTests().catch(e => console.error(e));
