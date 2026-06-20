/*!
@walraxc/memwal-rag — MemWal Client

Semantic search over exploit patterns via MemWal.
Zero embedding cost — MemWal relayer handles embedding + indexing.

Uses @mysten-incubation/memwal SDK directly.
*/

import type { MemWalConfig, RagMatch } from "./types";

export class MemWalRagClient {
  private config: MemWalConfig;

  constructor(config: MemWalConfig) {
    this.config = {
      serverUrl: "https://relayer.memory.walrus.xyz",
      namespace: "raxc/defi-cases",
      ...config,
    };
  }

  /** Get the configured namespace. */
  getNamespace(): string {
    return this.config.namespace!;
  }

  /**
   * Search for similar exploit patterns.
   * Returns top-K matches sorted by score (highest first).
   */
  async search(query: string, limit = 5): Promise<RagMatch[]> {
    const m = await this.getNamespace();
    const r = await m.recall({ query });

    return (r.results || []).slice(0, limit).map((x: any) => ({
      id: x.id || x.memoryId || "",
      score: x.distance != null ? 1 / (1 + x.distance) : x.score || 0,
      content: x.text || x.data || x.content || "",
      distance: x.distance,
    }));
  }

  /**
   * Seed exploit patterns into a namespace.
   * Each pattern is embedded + indexed by the MemWal relayer automatically.
   */
  async seed(patterns: string[], onProgress?: (i: number, total: number) => void): Promise<number> {
    const ns = await this.getNamespace();
    let count = 0;

    for (let i = 0; i < patterns.length; i++) {
      try {
        await ns.remember(patterns[i]);
        count++;
      } catch (e: any) {
        if (e?.status === 429) { await new Promise(r => setTimeout(r, 2000)); i--; continue; }
        if (e?.message?.includes("504")) continue;
      }
      onProgress?.(i + 1, patterns.length);
    }
    return count;
  }

  async health(): Promise<boolean> {
    try {
      const ns = await this.getNamespace();
      await ns.health();
      return true;
    } catch { return false; }
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private _ns: any = null;

  private async getNamespace(): Promise<any> {
    if (this._ns) return this._ns;

    const { MemWal } = await import("@mysten-incubation/memwal");
    this._ns = MemWal.create({
      key: this.config.privateKey,
      accountId: this.config.accountId,
      serverUrl: this.config.serverUrl,
      namespace: this.config.namespace,
    });

    return this._ns;
  }
}
