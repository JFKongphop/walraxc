/*!
Example: WALRAXC Multi-Agent Framework — Walrus Execution Mode (TypeScript)

Full pipeline: MemWal (RAG) → OpenAI (LLM with MemWal injection) → Walrus (blob storage).

Run:
    bun run examples/agent-example.ts
*/

import {
  loadEnv,
  buildOpenAiClient,
  WalrusClient,
  SuiMoveClient,
  AgentCore,
  WalraxcAnalyzer,
  WalraxcAnalyzerRemote,
  GasAnalyzerTool,
  PatternDetectorTool,
  FlashLoanTool,
  AccessControlTool,
  ReflectionTool,
  MemoryTool,
} from "../src/index.ts";
import { writeFileSync, mkdirSync } from "fs";
import fs from "fs";
import path from "path";

// ─── Default demo contract with intentional vulnerabilities ──────────────────
const DEFAULT_CONTRACT = `
// DeFiVault — built-in demo contract
pragma solidity ^0.7.0;

contract DeFiVault {
    mapping(address => uint256) public balances;
    address[] public depositors;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
        depositors.push(msg.sender);
    }

    // ❌ Reentrancy: external call before state update
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
        balances[msg.sender] = 0;
    }
}
`;

async function main(): Promise<void> {
  // Load environment variables
  loadEnv();

  console.log(
    "\x1b[1;96m╔══════════════════════════════════════════════════════════════════════════╗\x1b[0m",
  );
  console.log(
    "\x1b[1;96m║\x1b[0m  \x1b[1;96mWALRAXC Autonomous Exploit Intelligence Core — Sovereign Execution Mode\x1b[0m    \x1b[1;96m║\x1b[0m",
  );
  console.log(
    "\x1b[1;96m║\x1b[0m         \x1b[2mDeterministic Exploit Execution + Verification Framework\x1b[0m         \x1b[1;96m║\x1b[0m",
  );
  console.log(
    "\x1b[1;96m╚══════════════════════════════════════════════════════════════════════════╝\x1b[0m\n",
  );

  // ─── Connect to MemWal ──────────────────────────────────────────────────
  console.log("\x1b[33m[*] Connecting to MemWal...\x1b[0m");
  const walrus = WalrusClient.fromEnv();
  const healthy = await walrus.health();
  console.log(
    `\x1b[92m[✓] MemWal online — RAG + agent memory ready\x1b[0m\n`,
  );

  // ─── Initialize OpenAI client ──────────────────────────────────────────────
  const compute = buildOpenAiClient();

  // ─── Create AgentCore ──────────────────────────────────────────────────────
  const core = new AgentCore(walrus, compute);

  // ─── Sui Move: on-chain audit task lifecycle + agent_nft ──────────────────
  const suiMove = SuiMoveClient.fromEnv();
  if (suiMove) {
    await core.attachSuiMove(suiMove);
    console.log("\x1b[92m[✓] Sui Move on-chain proof layer active\x1b[0m\n");
  } else {
    console.log("\x1b[90m[ ] Sui Move disabled — set SUI_PACKAGE_ID to enable on-chain proof\x1b[0m\n");
  }

  // ─── Register tools ────────────────────────────────────────────────────────
  console.log("\x1b[33m[*] Registering tools to ToolRegistry...\x1b[0m");  core.tools.register(new WalraxcAnalyzer(walrus, compute));  core.tools.register(new WalraxcAnalyzerRemote(walrus, compute));
  core.tools.register(new GasAnalyzerTool());
  core.tools.register(new PatternDetectorTool());
  core.tools.register(new FlashLoanTool());
  core.tools.register(new AccessControlTool());
  core.tools.register(new ReflectionTool(compute));
  core.tools.register(new MemoryTool(core.memory));

  // ─── Load contract ─────────────────────────────────────────────────────────
  let contractCode: string;
  let contractName: string;

  if (process.env["WALRAXC_CONTRACT_CODE"]) {
    contractCode = process.env["WALRAXC_CONTRACT_CODE"];
    const words = contractCode.split(/\s+/);
    const contractIdx = words.findIndex((w) => w === "contract");
    contractName =
      contractIdx !== -1
        ? (words[contractIdx + 1] ?? "Contract").replace(/[^a-zA-Z0-9_]/g, "")
        : "Contract";
    console.log(
      `\x1b[33m[*]\x1b[0m Analyzing inline contract: \x1b[97m${contractName}\x1b[0m`,
    );
  } else if (process.env["WALRAXC_CONTRACT_FILE"]) {
    const filePath = process.env["WALRAXC_CONTRACT_FILE"];
    console.log(
      `\x1b[33m[*]\x1b[0m Loading contract from: \x1b[97m${filePath}\x1b[0m`,
    );
    contractCode = fs.readFileSync(filePath, "utf-8");
    contractName =
      path.basename(filePath, path.extname(filePath)) || "Contract";
  } else {
    console.log(
      "\x1b[2m    (no --file given — using built-in DeFiVault demo contract)\x1b[0m",
    );
    contractCode = DEFAULT_CONTRACT;
    contractName = "DeFiVault";
  }

  // ─── Run analysis ──────────────────────────────────────────────────────────
  console.log(
    "\n\x1b[33m[*]\x1b[0m Initiating autonomous exploit analysis — 13-phase verification pipeline...\n",
  );
  const result = await core.analyze(contractCode, contractName);

  // Report already saved by AgentCore to ../reports/
  const reportsDir = new URL("../../reports/", import.meta.url).pathname;
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(`${reportsDir}${result.filename}`, result.markdown);
  console.log(`\n\x1b[92m✅ Report saved to: reports/${result.filename}\x1b[0m\n`);

  console.log(
    "\n\x1b[36m╔══════════════════════════════════════════════════════════════════════════╗\x1b[0m",
  );
  console.log(
    "\x1b[36m║                  AUTONOMOUS EXPLOIT INTELLIGENCE RESULT                  ║\x1b[0m",
  );
  console.log(
    "\x1b[36m╚══════════════════════════════════════════════════════════════════════════╝\x1b[0m\n",
  );

  console.log("\x1b[1;96m📊 BASIC DECISION:\x1b[0m");
  console.log(
    `  Vulnerability Found: ${result.decision.vulnerabilityFound}`,
  );
  console.log(`  Risk Level:          ${result.decision.riskLevel}`);
  if (result.decision.primaryVulnerability) {
    console.log(
      `  Vulnerability Type:  ${result.decision.primaryVulnerability}`,
    );
  }
  console.log(
    `  Confidence:          ${(result.decision.confidence * 100).toFixed(1)}%`,
  );
  console.log(`  Tool Signals:        ${result.signals.length}\n`);

  // ─── Print intelligence + attack simulation ──────────────────────────────
  console.log("\x1b[1;96m📈 INTELLIGENCE REPORT:\x1b[0m");
  console.log(
    `  Risk Score:          ${(result.intelligenceReport.riskScore * 100).toFixed(1)}%`,
  );
  console.log(
    `  Exploitability:      ${(result.intelligenceReport.exploitabilityScore * 100).toFixed(1)}%`,
  );
  console.log(
    `  Attack Likelihood:   ${(result.intelligenceReport.attackLikelihood * 100).toFixed(1)}%`,
  );

  console.log("\n\x1b[1;96m🧪 ATTACK SIMULATION:\x1b[0m");
  console.log(
    `  Execution Path:      ${result.attackSimulation.executionPath.length} steps`,
  );
  console.log(
    `  Attacker Type:       ${result.attackSimulation.attackerModel.attackerType}`,
  );
  console.log(
    `  Success Prob:        ${(result.attackSimulation.exploitVerdict.successProbability * 100).toFixed(1)}%`,
  );

  console.log("\n\x1b[1;96m📊 ATTACK MAP:\x1b[0m");
  console.log(`  Graph Nodes:         ${result.attackGraph.nodes.length}`);
  console.log(`  Root Node:           ${result.attackGraph.rootNode}`);

  console.log("\n\x1b[1;96m🎯 FINAL DECISION:\x1b[0m");
  console.log(
    `  Final Verdict:       ${result.finalDecision.finalVerdict}`,
  );
  console.log(
    `  Final Confidence:    ${(result.finalDecision.finalConfidence * 100).toFixed(2)}%`,
  );
  console.log(
    `  Final Risk Score:    ${(result.finalDecision.finalRiskScore * 100).toFixed(2)}%`,
  );

  console.log("\n\x1b[1;96m🔐 ATTESTATION:\x1b[0m");
  console.log(
    `  Replay ID:           ${result.attestation.replayId}`,
  );
  console.log(
    `  Trace Hash:          ${result.attestation.executionTraceHash}`,
  );

  console.log(
    "\n\x1b[1;35m╔════════════════════════════════════════════════════════════════════════╗\x1b[0m",
  );
  console.log(
    "\x1b[1;35m║                   ON-CHAIN PROOF — Sui Move + Walrus                   ║\x1b[0m",
  );
  console.log(
    "\x1b[1;35m╚════════════════════════════════════════════════════════════════════════╝\x1b[0m\n",
  );

  // ─── audit_task: report blob ID stored on-chain ────────────────────────
  console.log(
    `\x1b[1;35m\x1b[0m  Audit Task #:         \x1b[92m${(result as any).taskId || "N/A"}\x1b[0m`,
  );
  console.log(
    `\x1b[1;35m\x1b[0m  CreateTask TX:        \x1b[94mhttps://testnet.suivision.xyz/txblock/${(result as any).createTaskTx || ""}\x1b[0m`,
  );
  console.log(
    `\x1b[1;35m\x1b[0m  FinalizeTask TX:      \x1b[94mhttps://testnet.suivision.xyz/txblock/${(result as any).finalizeTaskTx || ""}\x1b[0m`,
  );
  if ((result as any).reportBlobId) {
    console.log(
      `\x1b[1;35m\x1b[0m  Report Blob (task):   \x1b[94mhttps://walruscan.com/testnet/blob/${(result as any).reportBlobId}\x1b[0m  ← audit_task`,
    );
  }

  // ─── agent_nft: session blob ID on Merkle trail ────────────────────────
  if ((result as any).summaryBlobId) {
    console.log(
      `\x1b[1;35m\x1b[0m  Memory Blob (agent):  \x1b[94mhttps://walruscan.com/testnet/blob/${(result as any).summaryBlobId}\x1b[0m  ← agent_nft`,
    );
  }
  if ((result as any).agentNftId) {
    console.log(
      `\x1b[1;35m\x1b[0m  Agent NFT ID:         \x1b[92m${(result as any).agentNftId}\x1b[0m`,
    );
  }
  if ((result as any).mintedNftTx) {
    console.log(
      `\x1b[1;35m\x1b[0m  Mint NFT TX:        \x1b[94mhttps://testnet.suivision.xyz/txblock/${(result as any).mintedNftTx}\x1b[0m`,
    );
  }

  console.log(
    "\x1b[36m╔══════════════════════════════════════════════════════════════════════════╗\x1b[0m",
  );
  console.log(
    "\x1b[36m║        AUTONOMOUS ENGINE — SOVEREIGN EXECUTION COMPLETE                  ║\x1b[0m",
  );
  console.log(
    "\x1b[36m╚══════════════════════════════════════════════════════════════════════════╝\x1b[0m",
  );
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
