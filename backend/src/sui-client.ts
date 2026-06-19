/*!
WALRAXC Sui Move Client — On-chain proof layer for audit task lifecycle.

Integrates two Walrus-track Move contracts:
  - audit_task (ERC-8183): audit task lifecycle → create, finalize, verify
  - agent_nft  (ERC-7857): agent identity + Merkle audit trail
*/

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";

// ─── Package IDs (testnet deployment) ─────────────────────────────────────────
// Update these after `sui client publish` in move/
const PACKAGE_ID = process.env["SUI_PACKAGE_ID"] || "";
const TASK_REGISTRY_ID = process.env["SUI_TASK_REGISTRY_ID"] || "";
const NFT_REGISTRY_ID = process.env["SUI_NFT_REGISTRY_ID"] || "";
const AUDIT_REGISTRY_ID = process.env["SUI_AUDIT_REGISTRY_ID"] || "";
const ADMIN_CAP_ID = process.env["SUI_ADMIN_CAP_ID"] || "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SuiMoveConfig {
  suiPrivateKey: string;   // bech32 suiprivkey1...
  packageId: string;
  taskRegistryId: string;
  nftRegistryId: string;
  auditRegistryId: string;
  adminCapId: string;
}

export interface AuditTaskResult {
  taskId: string;
  txDigest: string;
}

export interface FinalizeTaskInput {
  taskId: string;
  verdict: string;
  confidence: number;       // 0-100
  rootHash: Uint8Array;
  replayId: string;
  traceHash: Uint8Array;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class SuiMoveClient {
  private config: SuiMoveConfig;
  private _signer: Ed25519Keypair | null = null;
  private _suiClient: SuiClient | null = null;

  constructor(config: SuiMoveConfig) {
    this.config = config;
  }

  static fromEnv(): SuiMoveClient | null {
    const pk = process.env["SUI_PRIVATE_KEY"];
    const pkg = process.env["SUI_PACKAGE_ID"];
    if (!pk || !pkg) return null;
    return new SuiMoveClient({
      suiPrivateKey: pk,
      packageId: pkg,
      taskRegistryId: process.env["SUI_TASK_REGISTRY_ID"] || "",
      nftRegistryId: process.env["SUI_NFT_REGISTRY_ID"] || "",
      auditRegistryId: process.env["SUI_AUDIT_REGISTRY_ID"] || "",
      adminCapId: process.env["SUI_ADMIN_CAP_ID"] || "",
    });
  }

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

  /** Public: get the Sui address for this signer. */
  getAddress(): string {
    return this.getSigner().toSuiAddress();
  }

  private async getSuiClient(): Promise<SuiClient> {
    if (this._suiClient) return this._suiClient;
    this._suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
    return this._suiClient;
  }

  // ═══ Audit Task Lifecycle ════════════════════════════════════════════════════

  /** Phase 1: Create an on-chain audit task. Returns task_id. */
  async createAuditTask(contractName: string): Promise<AuditTaskResult> {
    const sui = await this.getSuiClient();
    const signer = this.getSigner();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();

    tx.moveCall({
      target: `${this.config.packageId}::audit_task::create_audit_task`,
      arguments: [
        tx.object(this.config.taskRegistryId),
        tx.pure.string(contractName),
        tx.pure.u64(BigInt(Date.now())),
      ],
    });

    const result = await sui.signAndExecuteTransaction({
      transaction: tx,
      signer,
      options: { showEvents: true },
    });

    const taskCreatedEvent = result.events?.find(
      (e: any) => e.type.includes("::audit_task::AuditTaskCreated")
    );
    const taskId = (taskCreatedEvent as any)?.parsedJson?.task_id ?? "unknown";

    console.log(`[SuiMove]        Task created — #${taskId} (${result.digest})`);
    return { taskId: String(taskId), txDigest: result.digest };
  }

  /** Phase 11: Finalize audit task with cryptographic proof on-chain. */
  async finalizeAuditTask(input: FinalizeTaskInput): Promise<string> {
    const sui = await this.getSuiClient();
    const signer = this.getSigner();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();

    tx.moveCall({
      target: `${this.config.packageId}::audit_task::finalize_audit_task`,
      arguments: [
        tx.object(this.config.taskRegistryId),
        tx.pure.u64(BigInt(input.taskId)),
        tx.pure.string(input.verdict),
        tx.pure.u64(BigInt(input.confidence)),
        tx.pure.vector("u8", Array.from(input.rootHash)),
        tx.pure.string(input.replayId),
        tx.pure.vector("u8", Array.from(input.traceHash)),
        tx.pure.u64(BigInt(Date.now())),
      ],
    });

    const result = await sui.signAndExecuteTransaction({
      transaction: tx,
      signer,
    });

    console.log(`[SuiMove]        Task finalized — #${input.taskId} (${result.digest})`);
    return result.digest;
  }

  /** Verify a finalized audit task has valid proof on-chain. */
  async verifyTask(taskId: string): Promise<boolean> {
    const sui = await this.getSuiClient();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();

    tx.moveCall({
      target: `${this.config.packageId}::audit_task::verify_task`,
      arguments: [
        tx.object(this.config.taskRegistryId),
        tx.pure.u64(BigInt(taskId)),
      ],
    });

    const result = await sui.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.getSigner().toSuiAddress(),
    });
    // Parse return value (first return is bool)
    const bytes = result.results?.[0]?.returnValues?.[0]?.[0];
    return bytes?.[0] === 1;
  }

  // ═══ Audit Task Read Functions ═══════════════════════════════════════════════

  /** Get total number of audit tasks */
  async getTaskCount(): Promise<number> {
    const sui = await this.getSuiClient();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::audit_task::get_task_count`,
      arguments: [tx.object(this.config.taskRegistryId)],
    });
    const result = await sui.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.getSigner().toSuiAddress(),
    });
    const bytes = result.results?.[0]?.returnValues?.[0]?.[0];
    return Number(new DataView(new Uint8Array(bytes || []).buffer).getBigUint64(0, true));
  }

  /** Get task requester address */
  async getTaskRequester(taskId: string): Promise<string> {
    const sui = await this.getSuiClient();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::audit_task::get_task_requester`,
      arguments: [tx.object(this.config.taskRegistryId), tx.pure.u64(BigInt(taskId))],
    });
    const result = await sui.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.getSigner().toSuiAddress(),
    });
    const bytes = result.results?.[0]?.returnValues?.[0]?.[0];
    return "0x" + Buffer.from(bytes || []).toString("hex");
  }

  /** Get task contract name */
  async getTaskContractName(taskId: string): Promise<string> {
    const sui = await this.getSuiClient();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::audit_task::get_task_contract_name`,
      arguments: [tx.object(this.config.taskRegistryId), tx.pure.u64(BigInt(taskId))],
    });
    const result = await sui.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.getSigner().toSuiAddress(),
    });
    const bytes = result.results?.[0]?.returnValues?.[0]?.[0];
    return new TextDecoder().decode(new Uint8Array(bytes || []));
  }

  /** Get task state (0=CREATED, 1=COMPLETED) */
  async getTaskState(taskId: string): Promise<number> {
    const sui = await this.getSuiClient();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::audit_task::get_task_state`,
      arguments: [tx.object(this.config.taskRegistryId), tx.pure.u64(BigInt(taskId))],
    });
    const result = await sui.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.getSigner().toSuiAddress(),
    });
    const bytes = result.results?.[0]?.returnValues?.[0]?.[0];
    return bytes?.[0] || 0;
  }

  /** Get task verdict */
  async getTaskVerdict(taskId: string): Promise<string> {
    const sui = await this.getSuiClient();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::audit_task::get_task_verdict`,
      arguments: [tx.object(this.config.taskRegistryId), tx.pure.u64(BigInt(taskId))],
    });
    const result = await sui.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.getSigner().toSuiAddress(),
    });
    const bytes = result.results?.[0]?.returnValues?.[0]?.[0];
    return new TextDecoder().decode(new Uint8Array(bytes || []));
  }

  /** Get task confidence (basis points) */
  async getTaskConfidence(taskId: string): Promise<number> {
    const sui = await this.getSuiClient();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::audit_task::get_task_confidence`,
      arguments: [tx.object(this.config.taskRegistryId), tx.pure.u64(BigInt(taskId))],
    });
    const result = await sui.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.getSigner().toSuiAddress(),
    });
    const bytes = result.results?.[0]?.returnValues?.[0]?.[0];
    return Number(new DataView(new Uint8Array(bytes || []).buffer).getBigUint64(0, true));
  }

  /** Get task root hash */
  async getTaskRootHash(taskId: string): Promise<Uint8Array> {
    const sui = await this.getSuiClient();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::audit_task::get_task_root_hash`,
      arguments: [tx.object(this.config.taskRegistryId), tx.pure.u64(BigInt(taskId))],
    });
    const result = await sui.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.getSigner().toSuiAddress(),
    });
    const bytes = result.results?.[0]?.returnValues?.[0]?.[0];
    return new Uint8Array(bytes || []);
  }

  /** Get task replay ID */
  async getTaskReplayId(taskId: string): Promise<string> {
    const sui = await this.getSuiClient();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::audit_task::get_task_replay_id`,
      arguments: [tx.object(this.config.taskRegistryId), tx.pure.u64(BigInt(taskId))],
    });
    const result = await sui.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.getSigner().toSuiAddress(),
    });
    const bytes = result.results?.[0]?.returnValues?.[0]?.[0];
    return new TextDecoder().decode(new Uint8Array(bytes || []));
  }

  /** Get task trace hash */
  async getTaskTraceHash(taskId: string): Promise<Uint8Array> {
    const sui = await this.getSuiClient();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::audit_task::get_task_trace_hash`,
      arguments: [tx.object(this.config.taskRegistryId), tx.pure.u64(BigInt(taskId))],
    });
    const result = await sui.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.getSigner().toSuiAddress(),
    });
    const bytes = result.results?.[0]?.returnValues?.[0]?.[0];
    return new Uint8Array(bytes || []);
  }

  /** Get task created timestamp */
  async getTaskCreatedAt(taskId: string): Promise<number> {
    const sui = await this.getSuiClient();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::audit_task::get_task_created_at`,
      arguments: [tx.object(this.config.taskRegistryId), tx.pure.u64(BigInt(taskId))],
    });
    const result = await sui.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.getSigner().toSuiAddress(),
    });
    const bytes = result.results?.[0]?.returnValues?.[0]?.[0];
    return Number(new DataView(new Uint8Array(bytes || []).buffer).getBigUint64(0, true));
  }

  /** Get task completed timestamp */
  async getTaskCompletedAt(taskId: string): Promise<number> {
    const sui = await this.getSuiClient();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();
    tx.moveCall({
      target: `${this.config.packageId}::audit_task::get_task_completed_at`,
      arguments: [tx.object(this.config.taskRegistryId), tx.pure.u64(BigInt(taskId))],
    });
    const result = await sui.devInspectTransactionBlock({
      transactionBlock: tx,
      sender: this.getSigner().toSuiAddress(),
    });
    const bytes = result.results?.[0]?.returnValues?.[0]?.[0];
    return Number(new DataView(new Uint8Array(bytes || []).buffer).getBigUint64(0, true));
  }

  /** Query all finalized audit tasks → their report blob IDs (Walrus). */
  async getAllTaskBlobIds(): Promise<Array<{ taskId: string; blobId: string }>> {
    const count = await this.getTaskCount();
    const results: Array<{ taskId: string; blobId: string }> = [];
    for (let i = 0; i < count; i++) {
      try {
        const state = await this.getTaskState(String(i));
        if (state !== 2) continue; // only finalized
        const hash = await this.getTaskRootHash(String(i));
        const blobId = new TextDecoder().decode(hash);
        if (blobId.length > 5) results.push({ taskId: String(i), blobId });
      } catch {}
    }
    return results;
  }

  // ═══ Agent NFT — Intelligence Updates ════════════════════════════════════════

  /** Phase 12: Update agent intelligence + add Merkle leaf to on-chain audit trail. */
  async updateAgentIntelligence(
    nftId: string,
    dataDescription: string,
    dataHash: Uint8Array,
  ): Promise<string> {
    const sui = await this.getSuiClient();
    const signer = this.getSigner();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();

    // Create IntelligentData using the public constructor
    const intelligentData = tx.moveCall({
      target: `${this.config.packageId}::agent_nft::new_intelligent_data`,
      arguments: [
        tx.pure.string(dataDescription),
        tx.pure.vector("u8", Array.from(dataHash)),
      ],
    });

    // Build IntelligentData vector
    const dataVector = tx.makeMoveVec({
      type: `${this.config.packageId}::agent_nft::IntelligentData`,
      elements: [intelligentData],
    });

    tx.moveCall({
      target: `${this.config.packageId}::agent_nft::update`,
      arguments: [
        tx.object(nftId),
        tx.object(this.config.auditRegistryId),
        tx.object("0x6"), // Clock
        dataVector,
      ],
    });

    const result = await sui.signAndExecuteTransaction({
      transaction: tx,
      signer,
    });

    console.log(`[SuiMove]        Agent updated — ${nftId} (${result.digest})`);
    return result.digest;
  }

  /** Mint a new AgentNFT (admin-only, one-time). */
  async mintAgentNFT(
    to: string,
    agent: string,
    datas: Array<{ data_description: string; data_hash: number[] }>,
  ): Promise<string> {
    const sui = await this.getSuiClient();
    const signer = this.getSigner();
    const tx = new (await import("@mysten/sui/transactions")).Transaction();

    // Create IntelligentData objects using the public constructor
    const intelligentDataObjects = datas.map((data) =>
      tx.moveCall({
        target: `${this.config.packageId}::agent_nft::new_intelligent_data`,
        arguments: [
          tx.pure.string(data.data_description),
          tx.pure.vector("u8", data.data_hash),
        ],
      })
    );

    // Build IntelligentData vector
    const dataVector = tx.makeMoveVec({
      type: `${this.config.packageId}::agent_nft::IntelligentData`,
      elements: intelligentDataObjects,
    });

    tx.moveCall({
      target: `${this.config.packageId}::agent_nft::mint`,
      arguments: [
        tx.object(this.config.adminCapId),
        tx.object(this.config.nftRegistryId),
        tx.pure.address(to),
        tx.pure.address(agent),
        dataVector,
      ],
    });

    tx.setSender(this.getSigner().toSuiAddress());
    tx.setGasBudget(50000000);

    const result = await sui.signAndExecuteTransaction({
      transaction: tx,
      signer,
    });

    console.log(`[SuiMove]        NFT minted — ${result.digest}`);
    return result.digest;
  }

  /** Find the agent's NFT ID by owner address. */
  async findAgentNft(owner: string): Promise<string | null> {
    const sui = await this.getSuiClient();
    const nftType = `${this.config.packageId}::agent_nft::AgentNFT`;
    const objs = await sui.getOwnedObjects({
      owner,
      filter: { StructType: nftType },
      options: { showContent: false },
    });
    const first = objs.data[0];
    return first?.data?.objectId || null;
  }

  /** Read all IntelligentData entries from an Agent NFT (Merkle trail).
   *  Structure: fields.intelligent_datas (current) + fields.history[].fields.datas[] */
  async getAgentData(nftId: string): Promise<Array<{ description: string; hash: Uint8Array }>> {
    const sui = await this.getSuiClient();
    const obj = await sui.getObject({
      id: nftId,
      options: { showContent: true },
    });
    const fields = (obj.data?.content as any)?.fields || {};
    const entries: Array<{ description: string; hash: Uint8Array }> = [];

    // Helper to add entries from IntelligentData array
    const addEntries = (datas: any[]) => {
      if (Array.isArray(datas)) {
        for (const entry of datas) {
          const ef = entry?.fields || entry || {};
          const desc: string = ef.data_description || "";
          const hashArr: number[] = ef.data_hash || [];
          entries.push({ description: desc, hash: new Uint8Array(hashArr) });
        }
      }
    };

    // Current intelligent_datas (NOT in history yet)
    addEntries(fields.intelligent_datas || []);

    // Historical snapshots
    const history = fields.history || [];
    if (Array.isArray(history)) {
      for (const snapshot of history) {
        addEntries(snapshot?.fields?.datas || []);
      }
    }

    return entries;
  }

  /** Get agent NFT ID: from env, or auto-discover from chain. */
  async getAgentNftId(): Promise<string | null> {
    const envId = process.env["SUI_AGENT_NFT_ID"];
    if (envId) return envId;
    const address = this.getAddress();
    return this.findAgentNft(address);
  }
}
