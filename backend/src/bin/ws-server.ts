/*!
WALRAXC WebSocket Server — real-time exploit intelligence over WebSocket.

Connect: ws://localhost:3001/ws
Send a JSON message to trigger analysis:
  { "contract": "pragma solidity ^0.8.0; contract Foo { ... }" }
  { "contract": "module hacker::exploit { ... }" }          ← Sui Move

The server streams phase-by-phase progress then sends the final result,
mirroring the terminal output of the CLI example.

Run:
    bun run src/bin/ws-server.ts
*/

/// <reference types="bun" />

import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";

const { upgradeWebSocket, websocket } = createBunWebSocket();
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
} from "../index.ts";
import type { AnalysisResult } from "../agent.ts";

// ─── Load environment ─────────────────────────────────────────────────────────

loadEnv();

// ─── Analysis runner (identical pipeline to agent-example) ────────────────────

async function runAnalysis(
  contractCode: string,
  send: (data: Record<string, unknown>) => void,
): Promise<AnalysisResult> {
  send({ type: "info", text: "[*] Connecting to MemWal..." });
  const walrus = WalrusClient.fromEnv();
  const healthy = await walrus.health();
  send({
    type: "info",
    text: `[✓] MemWal online — RAG + agent memory ready`,
  });

  const compute = buildOpenAiClient();

  const core = new AgentCore(walrus, compute);

  // Attach Sui Move for on-chain proof
  const suiMove = SuiMoveClient.fromEnv();
  if (suiMove) {
    await core.attachSuiMove(suiMove);
    send({ type: "info", text: "[✓] Sui Move on-chain proof layer active" });
  }

  // Register tools
  core.tools.register(new WalraxcAnalyzer(walrus, compute));
  core.tools.register(new WalraxcAnalyzerRemote(walrus, compute));
  core.tools.register(new GasAnalyzerTool());
  core.tools.register(new PatternDetectorTool());
  core.tools.register(new FlashLoanTool());
  core.tools.register(new AccessControlTool());
  core.tools.register(new ReflectionTool(compute));
  core.tools.register(new MemoryTool(core.memory));
  send({ type: "info", text: "[✓] 8 analysis tools registered" });

  // Extract contract/module name (Solidity or Move)
  // Strip comments first to avoid false matches on // contract / // module in comments
  const codeLines = contractCode.split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('/*') && !l.trimStart().startsWith('*'));
  const cleanCode = codeLines.join(' ');
  const words = cleanCode.split(/\s+/);
  let contractName = "Contract";
  // Try Move first: "module addr::name" or "module name::sub"
  const moduleIdx = words.findIndex((w) => w === "module");
  if (moduleIdx !== -1) {
    const raw = words[moduleIdx + 1] ?? "unknown";
    contractName = raw.split("::").pop()?.replace(/[^a-zA-Z0-9_]/g, "") || raw;
  }
  // Try Solidity: "contract Foo" (only if no module found)
  if (contractName === "Contract") {
    const contractIdx = words.findIndex((w) => w === "contract");
    if (contractIdx !== -1) {
      contractName = (words[contractIdx + 1] ?? "Contract").replace(/[^a-zA-Z0-9_]/g, "");
    }
  }

  send({ type: "info", text: `[*] Analyzing contract: ${contractName}` });
  send({
    type: "info",
    text: "[*] Initiating autonomous exploit analysis — 13-phase verification pipeline...",
  });

  // Set up progress streaming
  core.setProgressSender((msg: string) => {
    send({ type: "progress", text: msg });
  });

  // Run the full pipeline
  const result = await core.analyze(contractCode, contractName);

  // ─── Stream results ─────────────────────────────────────────────────────

  // Header box
  send({
    type: "banner",
    text: "\n╔══════════════════════════════════════════════════════════════════════════╗\n║                  AUTONOMOUS EXPLOIT INTELLIGENCE RESULT                  ║\n╚══════════════════════════════════════════════════════════════════════════╝",
  });

  // Phase: Basic Decision
  let basic = `  Vulnerability Found:  ${result.decision.vulnerabilityFound}\n  Risk Level:          ${result.decision.riskLevel}\n  Confidence:          ${(result.decision.confidence * 100).toFixed(1)}%\n  Tool Signals:        ${result.signals.length}`;
  if (result.decision.primaryVulnerability) {
    basic = `  Vulnerability Type:  ${result.decision.primaryVulnerability}\n${basic}`;
  }
  send({ type: "info", text: `📊 BASIC DECISION:\n${basic}` });
  await sleep(800);

  // Phase: Intelligence Report
  send({
    type: "info",
    text: `📈 INTELLIGENCE REPORT:\n  Risk Score:          ${(result.intelligenceReport.riskScore * 100).toFixed(2)}%\n  Exploitability:      ${(result.intelligenceReport.exploitabilityScore * 100).toFixed(2)}%\n  Attack Likelihood:   ${(result.intelligenceReport.attackLikelihood * 100).toFixed(2)}%\n  Classification:      ${result.intelligenceReport.finalClassification}`,
  });
  await sleep(800);

  // Phase: Attack Simulation
  send({
    type: "info",
    text: `🧪 ATTACK SIMULATION:\n  Execution Path:      ${result.attackSimulation.executionPath.length} steps\n  State Transitions:   ${result.attackSimulation.stateTransitions.length} tracked\n  Attacker Type:       ${result.attackSimulation.attackerModel.attackerType}\n  Exploit Status:      ${result.attackSimulation.exploitVerdict.status}\n  Success Probability: ${(result.attackSimulation.exploitVerdict.successProbability * 100).toFixed(1)}%\n  Replay ID:           ${result.attackSimulation.replayInfo.replayId}`,
  });
  await sleep(800);

  // Phase: Graph Construction
  send({
    type: "info",
    text: `📊 ATTACK MAP ENGINE:\n  Graph Nodes:         ${result.attackGraph.nodes.length}\n  Graph Edges:         ${result.attackGraph.edges.length}\n  Root Node:           ${result.attackGraph.rootNode}`,
  });
  await sleep(800);

  // Phase: Consistency Verification
  send({
    type: "info",
    text: `✅ CONSISTENCY VERIFICATION:\n  Simulation Valid:    ${result.consistencyCheck.simulationValid ? "✅ PASS" : "❌ FAIL"}\n  Graph Consistent:    ${result.consistencyCheck.graphConsistent ? "✅ PASS" : "❌ FAIL"}\n  State Correct:       ${result.consistencyCheck.stateCorrect ? "✅ PASS" : "❌ FAIL"}\n  Tool Conflict:       ${result.consistencyCheck.toolConflict ? "⚠️  YES" : "✅ NO"}\n  Consistency Score:   ${(result.consistencyCheck.consistencyScore * 100).toFixed(2)}%`,
  });
  await sleep(800);

  // Phase: Final Decision
  send({
    type: "info",
    text: `🎯 FINAL DECISION:\n  Final Verdict:       ${result.finalDecision.finalVerdict}\n  Final Confidence:    ${(result.finalDecision.finalConfidence * 100).toFixed(2)}%\n  Final Attack Prob:   ${(result.finalDecision.finalAttackProbability * 100).toFixed(2)}%\n  Final Risk Score:    ${(result.finalDecision.finalRiskScore * 100).toFixed(2)}%`,
  });
  await sleep(800);

  // Phase: Attestation
  send({
    type: "info",
    text: `🔐 ATTESTATION:\n  Replay ID:           ${result.attestation.replayId}\n  Seed:                ${result.attestation.seed}\n  Trace Hash:          ${result.attestation.executionTraceHash}\n  Timestamp:           ${result.attestation.timestamp}\n  Verdict:             ${result.attestation.finalVerdict}`,
  });
  await sleep(800);

  // Phase: LLM Explanation
  send({ type: "explanation", text: result.explanation });
  await sleep(800);

  // On-Chain Proof
  send({
    type: "banner",
    text: "\n╔══════════════════════════════════════════╗\n║  ON-CHAIN PROOF — Sui Testnet + Walrus   ║\n╚══════════════════════════════════════════╝",
  });
  if (result.taskId) send({ type: "info", text: `  Audit Task #:         ${result.taskId}` });
  if (result.createTaskTx) send({ type: "info", text: `  CreateTask TX:        https://testnet.suivision.xyz/txblock/${result.createTaskTx}` });
  if (result.finalizeTaskTx) send({ type: "info", text: `  FinalizeTask TX:      https://testnet.suivision.xyz/txblock/${result.finalizeTaskTx}` });
  if (result.reportBlobId) {
    send({ type: "info", text: `  Report Blob (task):   https://walruscan.com/testnet/blob/${result.reportBlobId}  ← audit_task` });
    const frontend = process.env["FRONTEND_URL"];
    if (frontend) send({ type: "info", text: `  View Report:          ${frontend}/tx-report/${result.reportBlobId}` });
  }
  if (result.summaryBlobId) send({ type: "info", text: `  Memory Blob (agent):  https://walruscan.com/testnet/blob/${result.summaryBlobId}  ← agent_nft` });
  if (result.agentNftId) send({ type: "info", text: `  Agent NFT ID:         ${result.agentNftId}` });

  // Build summary
  send({
    type: "complete",
    reportPath: result.filename,
    markdown: result.markdown,
    summary: {
      contract: contractName,
      vulnerability_found: result.decision.vulnerabilityFound,
      risk_level: result.decision.riskLevel,
      confidence: result.decision.confidence,
      final_verdict: result.finalDecision.finalVerdict,
      report_path: result.filename,
      storage_tx: result.storageRootHash,
      report_tx: result.reportTx,
      attestation_replay_id: result.attestation.replayId,
      execution_trace_hash: result.attestation.executionTraceHash,
      task_id: result.taskId,
      report_blob: result.reportBlobId,
      summary_blob: result.summaryBlobId,
      agent_nft_id: result.agentNftId,
    },
  });

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Server ───────────────────────────────────────────────────────────────────

const port = parseInt(process.env["WS_PORT"] ?? "3001", 10);

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║             WALRAXC WebSocket Server (TypeScript)            ║");
console.log(`║                       ws://0.0.0.0:${port}                      ║`);
console.log('║        Send: {"contract": "<Solidity or Move code>"}         ║');
console.log("╚══════════════════════════════════════════════════════════════╝\n");

const app = new Hono();

app.get("/", (c) => c.text("WALRAXC WebSocket Server — connect to /ws"));

app.get("/health", (c) => c.json({ status: "ok", uptime: process.uptime() }));

app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen: (_event, ws) => {
      // Send welcome banner
      ws.send(
        JSON.stringify({
          type: "banner",
          text: "╔══════════════════════════════════════════════════════════════════════════╗\n║         WALRAXC Autonomous Exploit Intelligence Core — WebSocket API     ║\n║         Deterministic Exploit Execution + Verification Framework         ║\n╚══════════════════════════════════════════════════════════════════════════╝",
        }),
      );
      ws.send(
        JSON.stringify({
          type: "info",
          text: 'Start auditing...',
        }),
      );
    },
    onMessage: async (event, ws) => {
      const text = typeof event.data === "string" ? event.data : "";
      let contractCode: string;

      try {
        const json = JSON.parse(text);
        contractCode =
          typeof json.contract === "string" ? json.contract : text;
      } catch {
        contractCode = text;
      }

      try {
        await runAnalysis(contractCode, (data) => {
          ws.send(JSON.stringify(data));
        });
      } catch (e) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: (e as Error).message ?? String(e),
          }),
        );
      }
    },
    onClose: () => {
      // Client disconnected
    },
  })),
);

const server = Bun.serve({
  port,
  fetch: app.fetch,
  websocket,
});

console.log(`[✓] WebSocket server listening on ws://0.0.0.0:${port}/ws\n`);

// Prevent the process from exiting
process.on("SIGINT", () => {
  server.stop();
  process.exit(0);
});
