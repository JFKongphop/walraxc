/*!
@raxclaw/walrus-memory — Verifiable RAG + memory for AI security agents.

Usage:
  import { RaxcMemory } from "@raxclaw/walrus-memory";
  const m = RaxcMemory.init();
  const exploits = await m.recallRag("reentrancy");
*/

const DEFAULT_API_KEY = "rax-public-2025";
const DEFAULT_RELAY = "https://raxclaw-mantle.fly.dev";

export interface RaxcConfig {
  apiKey?: string;
  relayUrl?: string;
  /** Optional — if set, uses direct MemWal instead of relay */
  privateKey?: string;
  accountId?: string;
}

export interface RagResult {
  text: string;
  score: number;
}

export class RaxcMemory {
  private apiKey: string;
  private relayUrl: string;

  constructor(config: RaxcConfig = {}) {
    this.apiKey = config.apiKey || DEFAULT_API_KEY;
    this.relayUrl = config.relayUrl || DEFAULT_RELAY;
  }

  /** Quick init with defaults — zero config. */
  static init(config?: RaxcConfig): RaxcMemory {
    return new RaxcMemory(config);
  }

  /** Recall exploit patterns from the pre-seeded RAG database. */
  async recallRag(query: string, topK = 5): Promise<RagResult[]> {
    const resp = await fetch(`${this.relayUrl}/v1/recall`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify({ query, topK, apiKey: this.apiKey }),
    });
    if (!resp.ok) throw new Error(`RAXC relay error ${resp.status}`);
    const data = await resp.json();
    return data.results || [];
  }

  /** Check relay health. */
  async health(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.relayUrl}/v1/health`);
      return resp.ok;
    } catch { return false; }
  }
}
