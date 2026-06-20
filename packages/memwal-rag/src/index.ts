/*!
@walraxc/memwal-rag — Public API

Semantic exploit pattern search via MemWal.
Pre-seeded with 781 DeFi exploit patterns (raxc/defi-cases namespace).

Usage:
  import { ExploitRAG } from "@walraxc/memwal-rag";

  const rag = ExploitRAG.init({ privateKey, accountId });

  const matches = await rag.search("reentrancy external call");
  // [{ score: 0.747, content: "DAO reentrancy...", ... }, ...]
*/

import { MemWalRagClient } from "./rag";
import type { MemWalConfig, RagMatch } from "./types";

export type { MemWalConfig, RagMatch } from "./types";

export class ExploitRAG {
  private rag: MemWalRagClient;

  constructor(config: MemWalConfig) {
    this.rag = new MemWalRagClient(config);
  }

  /** Create from config (no env needed). */
  static init(config: MemWalConfig): ExploitRAG {
    return new ExploitRAG(config);
  }

  /** Create from environment variables. */
  static fromEnv(): ExploitRAG {
    return new ExploitRAG({
      privateKey: process.env["MEMWAL_PRIVATE_KEY"] || "",
      accountId: process.env["MEMWAL_ACCOUNT_ID"] || "",
      serverUrl: process.env["MEMWAL_SERVER_URL"],
      namespace: process.env["MEMWAL_NAMESPACE"] || "raxc/defi-cases",
    });
  }

  // ═══ Core API ═════════════════════════════════════════════════════════════

  /** Search for exploit patterns similar to the query. */
  async search(query: string, limit = 5): Promise<RagMatch[]> {
    return this.rag.search(query, limit);
  }

  /** Seed a set of exploit patterns into the namespace. */
  async seed(patterns: string[], onProgress?: (i: number, total: number) => void): Promise<number> {
    return this.rag.seed(patterns, onProgress);
  }

  /** Health check. */
  async health(): Promise<boolean> {
    return this.rag.health();
  }

  /** Get the namespace being used. */
  getNamespace(): string {
    return this.rag.getNamespace();
  }
}
