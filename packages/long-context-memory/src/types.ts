/*!
@walraxc/long-context-memory — Types

Config: all injectable, no process.env dependency.
*/

// ─── Configuration ────────────────────────────────────────────────────────────

export interface AgentMemoryConfig {
  // Sui
  suiPrivateKey: string;          // bech32 suiprivkey1... or hex
  packageId: string;              // walraxc package on Sui testnet
  nftId?: string;                 // existing Agent NFT ID (auto-discover if omitted)
  nftRegistryId: string;          // agent_nft::Registry object
  auditRegistryId: string;        // agent_nft::AuditRegistry object
  adminCapId: string;             // agent_nft::AdminCap (for minting)

  // Walrus
  walrusPublisher: string;        // e.g. https://publisher.walrus-testnet.walrus.space/v1/blobs
  walrusAggregator: string;       // e.g. https://aggregator.walrus-testnet.walrus.space/v1/blobs

  // Sui network
  suiRpcUrl?: string;             // default: testnet fullnode
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface SessionSummary {
  contract_name: string;
  audited_at: string;
  vulnerability_type: string;
  risk_level: string;
  confidence: number;
  explanation?: string;
  report?: string;
}

// ─── Store Result ─────────────────────────────────────────────────────────────

export interface StoreResult {
  blobId: string;                 // Walrus blob ID
  nftTx?: string;                 // Sui TX digest (if agent_nft updated/minted)
  mintedNftId?: string;           // new NFT ID (if auto-minted)
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface ReportBlob {
  blobId: string;
  content: string;
}
