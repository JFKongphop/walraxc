/*!
@walraxc/long-context-memory — Sui Client

Wraps agent_nft (ERC-7857) for on-chain Merkle trail storage.
All config injected — no process.env.
*/

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import type { AgentMemoryConfig } from "./types";

export interface IntelligentDataEntry {
  description: string;
  hash: Uint8Array;
}

export class SuiAgentClient {
  private config: AgentMemoryConfig;
  private _signer: Ed25519Keypair | null = null;
  private _suiClient: SuiClient | null = null;

  constructor(config: AgentMemoryConfig) {
    this.config = config;
  }

  // ─── Key management ──────────────────────────────────────────────────────

  private getSigner(): Ed25519Keypair {
    if (this._signer) return this._signer;
    const pk = this.config.suiPrivateKey;
    if (pk.startsWith("suiprivkey")) {
      const { secretKey } = decodeSuiPrivateKey(pk);
      this._signer = Ed25519Keypair.fromSecretKey(secretKey);
    } else {
      const { fromHex } = require("@mysten/sui/utils");
      this._signer = Ed25519Keypair.fromSecretKey(fromHex(pk));
    }
    return this._signer;
  }

  getAddress(): string {
    return this.getSigner().toSuiAddress();
  }

  private async getSuiClient(): Promise<SuiClient> {
    if (this._suiClient) return this._suiClient;
    const url = this.config.suiRpcUrl || getFullnodeUrl("testnet");
    this._suiClient = new SuiClient({ url });
    return this._suiClient;
  }

  // ─── Agent NFT Discovery ─────────────────────────────────────────────────

  async findAgentNft(owner?: string): Promise<string | null> {
    const sui = await this.getSuiClient();
    const nftType = `${this.config.packageId}::agent_nft::AgentNFT`;
    const objs = await sui.getOwnedObjects({
      owner: owner || this.getAddress(),
      filter: { StructType: nftType },
      options: { showContent: false },
    });
    return objs.data[0]?.data?.objectId || null;
  }

  /** Get or discover the agent NFT ID. */
  async resolveNftId(): Promise<string | null> {
    if (this.config.nftId) return this.config.nftId;
    return this.findAgentNft();
  }

  // ─── Mint (one-time agent registration) ──────────────────────────────────

  async mint(
    description: string,
    blobId: string,
  ): Promise<string> {
    const sui = await this.getSuiClient();
    const signer = this.getSigner();
    const addr = signer.toSuiAddress();
    const { Transaction } = await import("@mysten/sui/transactions");
    const tx = new Transaction();

    const data = tx.moveCall({
      target: `${this.config.packageId}::agent_nft::new_intelligent_data`,
      arguments: [
        tx.pure.string(description),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(blobId))),
      ],
    });

    const dataVec = tx.makeMoveVec({
      type: `${this.config.packageId}::agent_nft::IntelligentData`,
      elements: [data],
    });

    tx.moveCall({
      target: `${this.config.packageId}::agent_nft::mint`,
      arguments: [
        tx.object(this.config.adminCapId),
        tx.object(this.config.nftRegistryId),
        tx.pure.address(addr),
        tx.pure.address(addr),
        dataVec,
      ],
    });

    tx.setSender(addr);
    tx.setGasBudget(50000000);

    const result = await sui.signAndExecuteTransaction({ transaction: tx, signer });
    return result.digest;
  }

  // ─── Update (append blob ID to Merkle trail) ─────────────────────────────

  async update(
    nftId: string,
    description: string,
    blobId: string,
  ): Promise<string> {
    const sui = await this.getSuiClient();
    const signer = this.getSigner();
    const { Transaction } = await import("@mysten/sui/transactions");
    const tx = new Transaction();

    const data = tx.moveCall({
      target: `${this.config.packageId}::agent_nft::new_intelligent_data`,
      arguments: [
        tx.pure.string(description),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(blobId))),
      ],
    });

    const dataVec = tx.makeMoveVec({
      type: `${this.config.packageId}::agent_nft::IntelligentData`,
      elements: [data],
    });

    tx.moveCall({
      target: `${this.config.packageId}::agent_nft::update`,
      arguments: [
        tx.object(nftId),
        tx.object(this.config.auditRegistryId),
        tx.object("0x6"), // Clock
        dataVec,
      ],
    });

    const result = await sui.signAndExecuteTransaction({ transaction: tx, signer });
    return result.digest;
  }

  // ─── Read Merkle trail ───────────────────────────────────────────────────

  /** Read all IntelligentData entries from the agent NFT.
   *  Structure: fields.intelligent_datas (current) + fields.history[].fields.datas[] */
  async readTrail(nftId: string): Promise<IntelligentDataEntry[]> {
    const sui = await this.getSuiClient();
    const obj = await sui.getObject({ id: nftId, options: { showContent: true } });
    const fields = (obj.data?.content as any)?.fields || {};
    const entries: IntelligentDataEntry[] = [];

    const add = (datas: any[]) => {
      if (Array.isArray(datas)) {
        for (const entry of datas) {
          const ef = entry?.fields || entry || {};
          const desc: string = ef.data_description || "";
          const hashArr: number[] = ef.data_hash || [];
          entries.push({ description: desc, hash: new Uint8Array(hashArr) });
        }
      }
    };

    add(fields.intelligent_datas || []);
    for (const snap of fields.history || []) {
      add(snap?.fields?.datas || []);
    }

    return entries;
  }
}
