/*!
@walraxc/long-context-memory — Public API

Persistent agent memory via Walrus blobs + Sui Move agent_nft Merkle trail.

Usage:
  import { AgentMemory } from "@walraxc/long-context-memory";

  const memory = AgentMemory.init({ suiPrivateKey, packageId, walrusPublisher, ... });
  const { blobId } = await memory.store({ contract_name: "DeFiVault", ... });
  const sessions = await memory.recall();
*/

import { SuiAgentClient } from "./sui-client";
import { WalrusBlobClient } from "./walrus-client";
import type {
  AgentMemoryConfig,
  SessionSummary,
  StoreResult,
  ReportBlob,
} from "./types";

export type { AgentMemoryConfig, SessionSummary, StoreResult, ReportBlob } from "./types";

export class AgentMemory {
  private config: AgentMemoryConfig;
  private sui: SuiAgentClient;
  private walrus: WalrusBlobClient;

  constructor(config: AgentMemoryConfig) {
    this.config = config;
    this.sui = new SuiAgentClient(config);
    this.walrus = new WalrusBlobClient(config);
  }

  /** Create from config (no env needed). */
  static init(config: AgentMemoryConfig): AgentMemory {
    return new AgentMemory(config);
  }

  /** Create from environment variables (backward compatibility). */
  static fromEnv(): AgentMemory {
    return new AgentMemory({
      suiPrivateKey: process.env["SUI_PRIVATE_KEY"] || "",
      packageId: process.env["SUI_PACKAGE_ID"] || "",
      nftId: process.env["SUI_AGENT_NFT_ID"],
      nftRegistryId: process.env["SUI_NFT_REGISTRY_ID"] || "",
      auditRegistryId: process.env["SUI_AUDIT_REGISTRY_ID"] || "",
      adminCapId: process.env["SUI_ADMIN_CAP_ID"] || "",
      walrusPublisher: "https://publisher.walrus-testnet.walrus.space/v1/blobs",
      walrusAggregator: "https://aggregator.walrus-testnet.walrus.space/v1/blobs",
    });
  }

  // ═══ Core API ═══════════════════════════════════════════════════════════════

  /**
   * Store a session summary:
   *  1. Write JSON to Walrus blob
   *  2. Append blobId to agent_nft Merkle trail (or mint if first time)
   *
   * Returns blobId + optional Sui TX digest.
   */
  async store(session: SessionSummary): Promise<StoreResult> {
    const json = JSON.stringify(session);
    const blobId = await this.walrus.store(json);

    let nftTx: string | undefined;
    let mintedNftId: string | undefined;

    try {
      let nftId = await this.sui.resolveNftId();
      const desc = `Session: ${session.contract_name} — ${session.vulnerability_type} (${session.confidence}%)`;

      if (!nftId) {
        // First time — mint the agent NFT
        nftTx = await this.sui.mint(desc, blobId);
        nftId = await this.sui.findAgentNft();
        if (nftId) mintedNftId = nftId;
      } else {
        // Append to existing Merkle trail
        nftTx = await this.sui.update(nftId, desc, blobId);
      }
    } catch (e) {
      // Blob stored OK, NFT update best-effort
      console.error("[AgentMemory] NFT update failed:", e);
    }

    return { blobId, nftTx, mintedNftId };
  }

  /**
   * Recall ALL past sessions from the agent_nft Merkle trail.
   * Reads blob IDs from on-chain NFT → fetches each from Walrus.
   */
  async recall(): Promise<SessionSummary[]> {
    const nftId = await this.sui.resolveNftId();
    if (!nftId) return [];

    const trail = await this.sui.readTrail(nftId);
    const sessions: SessionSummary[] = [];

    for (const entry of trail) {
      const blobId = new TextDecoder().decode(entry.hash).replace(/[^a-zA-Z0-9_-]/g, "");
      if (blobId.length < 10) continue; // skip placeholders
      try {
        const raw = await this.walrus.read(blobId);
        sessions.push(JSON.parse(raw) as SessionSummary);
      } catch {
        // blob expired — skip
      }
    }

    return sessions;
  }

  // ═══ Report Storage (separate from memory trail) ═════════════════════════════

  /** Store a full audit report (markdown). Not appended to agent_nft trail. */
  async storeReport(markdown: string): Promise<ReportBlob> {
    return this.walrus.storeReport(markdown);
  }

  /** Read a full audit report by blob ID. */
  async getReport(blobId: string): Promise<ReportBlob> {
    return this.walrus.getReport(blobId);
  }

  // ═── Utilities ────────────────────────────────────────────────────────────

  getSuiClient(): SuiAgentClient { return this.sui; }
  getWalrusClient(): WalrusBlobClient { return this.walrus; }

  async getNftId(): Promise<string | null> {
    return this.sui.resolveNftId();
  }
}
