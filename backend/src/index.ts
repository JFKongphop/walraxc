/*!
WALRAXC — RAG-based smart contract vulnerability analysis with MemWal + OpenAI.
*/

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { OpenAiClient } from "./openai-withmemwal-client.ts";
import { WalrusClient, type RagResult } from "./walrus-client.ts";

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { OpenAiClient } from "./openai-withmemwal-client.ts";
export { WalrusClient } from "./walrus-client.ts";
export type { RagResult } from "./walrus-client.ts";
export { SuiMoveClient } from "./sui-client.ts";
export {
  AccessControlTool,
  FlashLoanTool,
  GasAnalyzerTool,
  MemoryTool,
  PatternDetectorTool,
  ReflectionTool,
} from "./tools.ts";
export type { Tool, ToolSignal } from "./tools.ts";
export {
  AgentCore,
  ConfidenceEngine,
  ConsensusEngine,
  FinalDecisionEngine,
  AttackSimulationEngine,
  GraphConstructionEngine,
  MemoryLayer,
  WalraxcAnalyzer,
  WalraxcAnalyzerRemote,
  ReportEngine,
  RiskScoringEngine,
  SeverityLock,
  SignalNormalizer,
  ToolRegistry,
  ToolTrustWeighting,
  ExploitabilityEstimator,
  AttestationEngine,
  ConsistencyEngineVerifier,
  AttackSuccessProbability,
  AttackerPersona,
} from "./agent.ts";
export type {
  AgentVote,
  AnalysisResult,
  AttackSimulation,
  AttackerCapabilities,
  AttackerModel,
  AttestationProof,
  ConsistencyCheck,
  DecisionResult,
  DeterministicReplay,
  ExecutionStep,
  ExploitGraph,
  ExploitVerdict,
  FinalDecision,
  IntelligenceReport,
  SeverityProof,
  StateProof,
  StateTransition,
  ToolSignalReference,
} from "./agent.ts";

// ─── Constants ────────────────────────────────────────────────────────────────

export const TOP_K = 5;

// ─── Environment setup ────────────────────────────────────────────────────────

/** Load .env from the project root */
export function loadEnv(): void {
  dotenv.config();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(__dirname, "..");
  dotenv.config({ path: path.join(root, ".env"), override: false });
}

/** Build OpenAI client (LLM reasoning + embeddings). */
export function buildOpenAiClient(): OpenAiClient {
  return OpenAiClient.fromEnv();
}

// ─── Analysis workflow ────────────────────────────────────────────────────────

/** Analyze contract using MemWal semantic recall. */
export async function analyzeMemWal(
  walrus: WalrusClient,
  compute: OpenAiClient,
  contract: string,
): Promise<string> {
  console.log("[WalraxcAnalyzer]   Recalling exploit patterns from MemWal (walraxc/defi-cases)...");
  const topMatches = await walrus.recallRag(contract, TOP_K);
  console.log(`[WalraxcAnalyzer]   Top ${topMatches.length} matches recalled`);

  if (topMatches.length === 0) {
    console.log("[!] No similar exploits recalled — contract appears safe.");
    return "✅ NO EXPLOITABLE VULNERABILITY FOUND\nNo similar exploit patterns found in RAG database.";
  }

  const topScore = topMatches[0]?.score ?? 0;
  console.log(`[WalraxcAnalyzer]   Top score: ${topScore.toFixed(3)} (MemWal distance→score)`);

  console.log("[WalraxcAnalyzer]   Building RAG context...");
  const context = buildRagContextMemWal(topMatches);

  console.log("[LLM]            Sending for analysis...");
  const prompt = buildAnalysisPrompt(context, contract);
  return compute.infer(prompt);
}

/** Build RAG context string from MemWal recall results */
export function buildRagContextMemWal(top: RagResult[]): string {
  let ctx = "";
  for (let i = 0; i < top.length; i++) {
    const scoreRounded = Math.round((top[i].score || 0) * 1000) / 1000;
    ctx += `\n--- Reference ${i + 1} [score: ${scoreRounded}] ---\n${top[i].text.slice(0, 2000)}\n`;
  }
  return ctx;
}

function buildAnalysisPrompt(context: string, contract: string): string {
  return `You are a smart contract security expert specializing in DeFi vulnerabilities.

Analyze the following Solidity contract for potential vulnerabilities.
Use the reference cases below as context — retrieved from DeFiHackLabs (real protocol attacks) and DeFiVulnLabs (educational vulnerability patterns).

## Similar Reference Cases (DeFiHackLabs real exploits + DeFiVulnLabs educational patterns):
${context}

## Contract to Analyze:
${contract}

## Critical instructions before answering:
1. The exploit cases show HOW past vulnerabilities worked. Your job is to determine if THIS contract has the same UNMITIGATED flaw — not just a similar structure.
2. Actively check for these mitigations. If any are correctly implemented, they PREVENT exploitation:
   - ReentrancyGuard modifier or Checks-Effects-Interactions (state update before external call)
   - TWAP / time-weighted average price oracle (resistant to single-block manipulation)
   - onlyOwner / role-based access control on sensitive functions
   - Solidity 0.8+ built-in overflow protection or SafeMath
3. Structural similarity to an exploit is NOT sufficient. The contract must have the same exploitable flaw WITH NO mitigation present.
4. Include a CONFIDENCE score (0-100) reflecting how certain you are a real exploitable vulnerability exists with no mitigation.
5. For EXPLOIT_TX in your report: only cite the exact Attack Tx URLs present in the reference cases above. If a reference shows "N/A" or no real tx, write N/A. Do NOT fabricate or invent transaction hashes.

## Provide a structured security report with the following sections:

**Vulnerability Found:** Yes / No
**Risk Level:** Critical / High / Medium / Low / None
**Vulnerability Type:** (e.g. Reentrancy, Flash Loan, Price Manipulation, Access Control, etc.)
**Confidence:** (0-100 — certainty that a real exploitable vulnerability exists with no mitigation present)
**Similar Exploit Reference:** (which exploit case above is most relevant and why)
**Explanation:** (describe the exact vulnerability and how an attacker could exploit it step-by-step)
**Recommendation:**
IMPORTANT: Provide AT LEAST 3-4 detailed cases (A, B, C, D, ...). Each case must be a complete, standalone solution.
Separate each distinct issue or improvement into its own labeled case (A, B, C, D, ...). For each case:
- State the problem in one sentence.
- Show ONLY the one affected function rewritten in full — do NOT include contract declaration, constructor, imports, structs, or any other functions.
- Every line of the function must be written out completely — the words "existing code", "existing logic", "..." and any placeholder comments are FORBIDDEN.
- Add an inline comment on every line you changed explaining what was fixed and why.
- If a vulnerability was found: each case must directly correspond to one finding named in the Explanation section.
- If no vulnerability was found: each case must apply a concrete proactive improvement.
- You MUST write ALL cases completely. Do NOT summarize, skip, or abbreviate any case.`;
}
