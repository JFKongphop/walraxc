/*!
walraxc packages — all 4 + backend agent pipeline

Run from backend/ (where .env lives):
  cd backend && bun run ../packages/examples/all-packages.ts
*/

import { writeFileSync, mkdirSync } from "fs";

// ═══ Published packages (install via npm) ═════════════════════════
// npm i walraxc @walraxc/memwal-rag @walraxc/long-context-memory @walraxc/agent
import { RaxcMemory } from "walraxc";
import { AgentMemory } from "@walraxc/long-context-memory";
import { ExploitRAG } from "@walraxc/memwal-rag";

// ═══ @walraxc/agent — the 13-phase orchestrator ═════════════════════
import {
  AgentCore, WalraxcAnalyzer, WalraxcAnalyzerRemote,
  GasAnalyzerTool, PatternDetectorTool, FlashLoanTool,
  AccessControlTool, ReflectionTool, MemoryTool,
} from "@walraxc/agent";
import { WalrusClient } from "@walraxc/agent/walrus-client";
import { OpenAiWithMemwalClient } from "@walraxc/agent/openai-client";
import { SuiMoveClient } from "@walraxc/agent/sui-client";

async function main() {
  // ═══ RAG: search exploit patterns ══════════════════════════════════════
  const rag = ExploitRAG.fromEnv();
  const matches = await rag.search("reentrancy external call");
  console.log(`RAG: ${matches.length} patterns`);

  // ═══ Memory: recall past sessions ══════════════════════════════════════
  const mem = AgentMemory.fromEnv();
  const sessions = await mem.recall();
  console.log(`Memory: ${sessions.length} audits`);

  // ═══ Backend Agent: run 13-phase pipeline ══════════════════════════════
  const walrus = WalrusClient.fromEnv();
  const compute = OpenAiWithMemwalClient.fromEnv();
  const core = new AgentCore(walrus, compute);
  core.tools.register(new WalraxcAnalyzer(walrus, compute));
  core.tools.register(new WalraxcAnalyzerRemote(walrus, compute));
  core.tools.register(new GasAnalyzerTool());
  core.tools.register(new PatternDetectorTool());
  core.tools.register(new FlashLoanTool());
  core.tools.register(new AccessControlTool());
  core.tools.register(new ReflectionTool(compute));
  core.tools.register(new MemoryTool(core.memory));

  // Attach Sui Move → audit_task + agent_nft on-chain proof
  const suiMove = SuiMoveClient.fromEnv();
  if (suiMove) {
    await core.attachSuiMove(suiMove);
    console.log();
  }

  const result = await core.analyze(`contract Vault {
    mapping(address => uint) balances;
    function withdraw() external {
      uint amount = balances[msg.sender];
      (bool ok,) = msg.sender.call{value: amount}("");
      balances[msg.sender] = 0;
    }
  }`, "Vault");

  console.log(`\nAgent: ${result.decision.primaryVulnerability} — ${result.decision.riskLevel} (${(result.decision.confidence*100).toFixed(0)}%)`);

  // ═══ Save report locally (root reports/ folder) ═════════════════════
  const reportsDir = new URL("../../reports/", import.meta.url).pathname;
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(`${reportsDir}${result.filename}`, result.markdown);

  // ═══ ON-CHAIN PROOF ══════════════════════════════════════════════════
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  ON-CHAIN PROOF — Sui Testnet + Walrus       ║");
  console.log("╚══════════════════════════════════════════════╝\n");
  if (result.taskId)   console.log(`  Audit Task #:         ${result.taskId}`);
  if (result.createTaskTx) console.log(`  CreateTask TX:        https://testnet.suivision.xyz/txblock/${result.createTaskTx}`);
  if (result.finalizeTaskTx) console.log(`  FinalizeTask TX:      https://testnet.suivision.xyz/txblock/${result.finalizeTaskTx}`);
  if (result.reportBlobId)  console.log(`  Report Blob (task):   https://walruscan.com/testnet/blob/${result.reportBlobId}  ← audit_task`);
  if (result.summaryBlobId) console.log(`  Memory Blob (agent):  https://walruscan.com/testnet/blob/${result.summaryBlobId}  ← agent_nft`);
  if (result.agentNftId)    console.log(`  Agent NFT ID:         ${result.agentNftId}`);
  console.log();

  // ═══ Store result (fed by agent output, not hardcoded) ════════════════
  const { blobId } = await mem.store({
    contract_name:      "Vault",
    audited_at:         new Date().toISOString(),
    vulnerability_type: result.decision.primaryVulnerability ?? "Unknown",
    risk_level:         result.decision.riskLevel,
    confidence:         Math.floor(result.decision.confidence * 100),
    explanation:        result.explanation.slice(0, 500),
  });
  console.log(`Stored: ${blobId}`);

  // ═══ Unified: full context ════════════════════════════════════════════
  const all = RaxcMemory.fromEnv();
  const ctx = await all.fullContext("reentrancy");
  console.log(`Full: ${ctx.sessions.length} sessions + ${ctx.exploits.length} exploits → ${ctx.mergedPrompt.length} chars`);
}

main().catch(console.error);
