/*!
WALRAXC Walrus Client — MemWal RAG + agent memory + blob storage.

Step 2 + 6: Core library. MemWal handles RAG recall and agent memory.
Walrus blob writes via @mysten/walrus SDK (SuiGrpcClient).
*/

import { MemWal } from "@mysten-incubation/memwal";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import type { WalrusClient as WalrusSDK } from "@mysten/walrus";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalrusConfig {
  memwalKey: string;
  memwalAccountId: string;
  memwalServerUrl: string;
  suiPrivateKey?: string;       // bech32 suiprivkey1... for Walrus blob signing
}

export interface RagResult {
  text: string;
  score: number;
}

export interface BlobInfo {
  blobId: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class WalrusClient {
  private config: WalrusConfig;
  private _walrusSDK: (WalrusSDK & { readBlob: any }) | null = null;

  constructor(config: WalrusConfig) {
    this.config = config;
  }

  /** Create from env vars. */
  static fromEnv(): WalrusClient {
    return new WalrusClient({
      memwalKey: process.env["MEMWAL_PRIVATE_KEY"] || "",
      memwalAccountId: process.env["MEMWAL_ACCOUNT_ID"] || "",
      memwalServerUrl: process.env["MEMWAL_SERVER_URL"] || "https://relayer.memory.walrus.xyz",
      suiPrivateKey: process.env["SUI_PRIVATE_KEY"] || "",
    });
  }

  // ═══ SDK Client (lazy-init) ═════════════════════════════════════════════════

  private async getSDK(): Promise<WalrusSDK & { readBlob: any }> {
    if (this._walrusSDK) return this._walrusSDK;
    const { SuiGrpcClient } = await import("@mysten/sui/grpc");
    const { walrus } = await import("@mysten/walrus");
    const client = new (SuiGrpcClient as any)({
      network: "testnet",
      baseUrl: "https://fullnode.testnet.sui.io:443",
    }).$extend(walrus());
    this._walrusSDK = client.walrus;
    return this._walrusSDK as any;
  }

  private getSigner(): Ed25519Keypair | null {
    const pk = this.config.suiPrivateKey;
    if (!pk) return null;
    try {
      if (pk.startsWith("suiprivkey")) {
        const { secretKey } = decodeSuiPrivateKey(pk);
        return Ed25519Keypair.fromSecretKey(secretKey);
      }
      const { fromHex } = require("@mysten/sui/utils");
      return Ed25519Keypair.fromSecretKey(fromHex(pk));
    } catch { return null; }
  }

  // ═══ RAG — Exploit Pattern Search (replaces Qdrant) ═════════════════════════

  async recallRag(query: string, topK = 5): Promise<RagResult[]> {
    const m = this.ns("raxc/defi-cases");
    const r = await m.recall({ query });
    return (r.results || []).slice(0, topK).map((x: any) => ({
      text: x.text || "",
      score: x.distance != null ? 1 / (1 + x.distance) : 0,
    }));
  }

  // ═══ Agent Memory — Walrus blobs (reliable storage) ═══════════════════════

  /** Store session JSON to Walrus blob. */
  async saveSession(summaryJson: string): Promise<string> {
    return this.saveAuditSummary(summaryJson);
  }

  /** Load sessions from Walrus manifest + optional agent_nft trail blob IDs. */
  async loadSessions(limit = 30, nftTrailBlobIds: string[] = []): Promise<any[]> {
    const sessions: any[] = [];
    const seen = new Set<string>();

    // 1. Load from manifest (local cache)
    try {
      const manifestId = require("fs").readFileSync(".raxc-manifest", "utf-8").trim();
      const text = await this.getReport(manifestId);
      const ids: string[] = JSON.parse(text);
      for (const id of ids.slice(-limit)) {
        if (seen.has(id)) continue;
        seen.add(id);
        try {
          const parsed = JSON.parse(await this.getReport(id));
          sessions.push(parsed);
        } catch {}
      }
    } catch { /* manifest missing — fall through to nft trail */ }

    // 2. Load from agent_nft trail (on-chain, all-time)
    for (const id of nftTrailBlobIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      try {
        const parsed = JSON.parse(await this.getReport(id));
        sessions.push(parsed);
      } catch {}
    }

    return sessions;
  }

  /** Append session blob ID to manifest. */
  async appendToManifest(sessionBlobId: string): Promise<void> {
    const fs = require("fs");
    let manifestId = "";
    let ids: string[] = [];
    try { manifestId = fs.readFileSync(".raxc-manifest", "utf-8").trim(); } catch {}
    try { ids = JSON.parse(await this.getReport(manifestId)); } catch {}
    ids.push(sessionBlobId);
    const url = "https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=10";
    const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: JSON.stringify(ids) });
    if (res.ok) {
      const json: any = await res.json();
      const newId = json.newlyCreated?.blobObject?.blobId || json.blobId;
      fs.writeFileSync(".raxc-manifest", newId);
    }
  }

  // ═══ Audit Summary — Walrus blob (no rate limit) ═══════════════════════════

  /** Store audit summary as a Walrus blob. Returns blobId. */
  async saveAuditSummary(summary: string): Promise<string> {
    const url = "https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=5";
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: summary,
    });
    if (!res.ok) throw new Error(`Walrus summary save failed (${res.status})`);
    const json: any = await res.json();
    return json.newlyCreated?.blobObject?.blobId || json.blobId;
  }

  // ═══ Blob Storage — Audit Reports (Walrus HTTP API / Native SDK) ══════════

  async storeReport(markdown: string): Promise<BlobInfo> {
    // Try native SDK first (if WAL available), fall back to HTTP API
    const signer = this.getSigner();
    if (signer) {
      try {
        const sdk = await this.getSDK();
        const blob = new TextEncoder().encode(markdown);
        const { blobId } = await sdk.writeBlob({ blob, epochs: 3, deletable: false, signer });
        console.log(`[Walrus]         Blob stored (SDK) — ${blobId}`);
        return { blobId };
      } catch (e: any) {
        // SDK unavailable (missing WAL, import error, etc.) — fall through to HTTP
        if (e.message?.includes("Insufficient balance")) { /* fall through */ }
        // else: import error from mismatched SDK version, also fall through
      }
    }

    // Fallback: HTTP API (Mysten Labs covers testnet costs)
    const url = "https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=3";
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: markdown,
    });
    if (!res.ok) throw new Error(`Walrus HTTP failed (${res.status})`);
    const json: any = await res.json();
    const blobId: string = json.newlyCreated?.blobObject?.blobId || json.blobId;
    console.log(`[Walrus]         Blob stored (HTTP) — ${blobId}`);
    return { blobId };
  }

  async getReport(blobId: string): Promise<string> {
    // Try native SDK first
    try {
      const sdk = await this.getSDK();
      const data: Uint8Array = await sdk.readBlob({ blobId });
      return new TextDecoder().decode(data);
    } catch { /* fall through */ }

    // Fallback: HTTP aggregator
    const url = `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${encodeURIComponent(blobId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Walrus read failed (${res.status})`);
    return await res.text();
  }

  // ═══ Utility ════════════════════════════════════════════════════════════════

  async health(): Promise<boolean> {
    try {
      await this.ns("raxc/defi-cases").health();
      return true;
    } catch { return false; }
  }

  private ns(namespace: string) {
    return MemWal.create({
      key: this.config.memwalKey,
      accountId: this.config.memwalAccountId,
      serverUrl: this.config.memwalServerUrl,
      namespace,
    });
  }
}
