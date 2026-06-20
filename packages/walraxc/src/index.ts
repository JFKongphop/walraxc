/*!
walraxc — Public API

Composes @walraxc/long-context-memory + @walraxc/memwal-rag into one interface.
The agent (13-phase pipeline) lives in backend/ and imports walraxc.

Usage:
  import { RaxcMemory } from "walraxc";

  const memory = RaxcMemory.init({ longContext: {...}, rag: {...} });

  const ctx = await memory.fullContext("reentrancy", contractCode);
  // → sessions + exploits + merged prompt → feed to your agent
*/

import { AgentMemory, type SessionSummary } from "@walraxc/long-context-memory";
import { ExploitRAG, type RagMatch } from "@walraxc/memwal-rag";
import type { RaxcMemoryConfig, FullContext } from "./types";

export type { RaxcMemoryConfig, FullContext, SessionSummary, RagMatch } from "./types";

export class RaxcMemory {
  longContext: AgentMemory;
  rag: ExploitRAG;

  constructor(config: RaxcMemoryConfig) {
    this.longContext = AgentMemory.init(config.longContext);
    this.rag = ExploitRAG.init(config.rag);
  }

  static init(config: RaxcMemoryConfig): RaxcMemory {
    return new RaxcMemory(config);
  }

  static fromEnv(): RaxcMemory {
    return RaxcMemory.init({
      longContext: {
        suiPrivateKey:    process.env["SUI_PRIVATE_KEY"] || "",
        packageId:        process.env["SUI_PACKAGE_ID"] || "",
        nftId:            process.env["SUI_AGENT_NFT_ID"],
        nftRegistryId:    process.env["SUI_NFT_REGISTRY_ID"] || "",
        auditRegistryId:  process.env["SUI_AUDIT_REGISTRY_ID"] || "",
        adminCapId:       process.env["SUI_ADMIN_CAP_ID"] || "",
        walrusPublisher:  "https://publisher.walrus-testnet.walrus.space/v1/blobs",
        walrusAggregator: "https://aggregator.walrus-testnet.walrus.space/v1/blobs",
      },
      rag: {
        privateKey: process.env["MEMWAL_PRIVATE_KEY"] || "",
        accountId:  process.env["MEMWAL_ACCOUNT_ID"] || "",
        serverUrl:  process.env["MEMWAL_SERVER_URL"],
        namespace:  "raxc/defi-cases",
      },
    });
  }

  // ═══ Core ══════════════════════════════════════════════════════════════════

  /** Full context: past sessions + exploit patterns + merged prompt. */
  async fullContext(query: string, contractCode?: string): Promise<FullContext> {
    const [sessions, exploits] = await Promise.all([
      this.longContext.recall(),
      this.rag.search(query),
    ]);

    const mergedPrompt = this.buildPrompt(sessions, exploits, contractCode);

    return { sessions, exploits, mergedPrompt };
  }

  // ═══ Delegated ═════════════════════════════════════════════════════════════

  async store(session: SessionSummary) { return this.longContext.store(session); }
  async recall() { return this.longContext.recall(); }
  async searchExploits(q: string, l?: number) { return this.rag.search(q, l); }
  async storeReport(md: string) { return this.longContext.storeReport(md); }
  async getReport(id: string) { return this.longContext.getReport(id); }

  // ═══ Private ═══════════════════════════════════════════════════════════════

  private buildPrompt(
    sessions: SessionSummary[],
    exploits: RagMatch[],
    contractCode?: string,
  ): string {
    let p = "You are a smart contract security expert.\n\n";

    if (contractCode) {
      p += `## Contract\n\`\`\`solidity\n${contractCode.slice(0, 800)}\n\`\`\`\n\n`;
    }

    if (sessions.length > 0) {
      p += `## Past Audits (${sessions.length})\n`;
      for (const s of sessions.slice(-10)) {
        p += `- [${s.contract_name}] ${s.vulnerability_type} — ${s.risk_level} (${s.confidence}%)\n`;
      }
      p += "\n";
    }

    if (exploits.length > 0) {
      p += `## Similar Exploit Patterns\n`;
      for (const e of exploits) {
        p += `- [${(e.score * 100).toFixed(0)}%] ${e.content.slice(0, 200)}\n`;
      }
      p += "\n";
    }

    p += "## Task\nAnalyze for vulnerabilities. Reference past audits and exploit patterns.";

    return p;
  }
}

// Default export
const walraxc = { init: (c: RaxcMemoryConfig) => RaxcMemory.init(c) };
export default walraxc;
