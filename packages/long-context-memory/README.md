# @walraxc/long-context-memory

Persistent agent memory via **Walrus blobs** + **Sui Move `agent_nft` Merkle trail**.

Every session summary is stored as a content-addressed Walrus blob. The blob ID is
appended to your agent's on-chain NFT Merkle trail — verifiable, permanent, trustless.

## Install

```bash
npm install @walraxc/long-context-memory
```

## Quick Start

```ts
import { AgentMemory } from "@walraxc/long-context-memory";

const memory = AgentMemory.init({
  suiPrivateKey:    "suiprivkey1qza...",       // your Sui private key
  packageId:        "0x79db...f1694",           // walraxc package on Sui
  nftId:            "0x926b...",                // optional — auto-discovers
  nftRegistryId:    "0x6e65...",                // agent_nft::Registry
  auditRegistryId:  "0xe3bf...",                // agent_nft::AuditRegistry
  adminCapId:       "0x51c7...",                // agent_nft::AdminCap
  walrusPublisher:  "https://publisher.walrus-testnet.walrus.space/v1/blobs",
  walrusAggregator: "https://aggregator.walrus-testnet.walrus.space/v1/blobs",
});

// Store a session (auto-appends to on-chain Merkle trail)
const { blobId } = await memory.store({
  contract_name:      "DeFiVault",
  audited_at:         new Date().toISOString(),
  vulnerability_type: "Reentrancy",
  risk_level:         "High",
  confidence:         85,
});

// Recall ALL past sessions from on-chain agent_nft → Walrus
const sessions = await memory.recall();
// [{ contract_name: "DeFiVault", vulnerability_type: "Reentrancy", ... }, ...]
```

## API

### `AgentMemory.init(config)`

Create an instance with full config injection (no env required).

### `memory.store(session: SessionSummary): Promise<StoreResult>`

1. Writes JSON to Walrus blob → gets content-addressed `blobId`
2. Appends blobId to on-chain `agent_nft` Merkle trail (auto-mints NFT if first time)

### `memory.recall(): Promise<SessionSummary[]>`

1. Reads all blob IDs from on-chain `agent_nft` Merkle trail
2. Fetches each blob from Walrus
3. Returns parsed session summaries

### `memory.storeReport(markdown: string): Promise<ReportBlob>`

Store a full audit report as a Walrus blob (not appended to Merkle trail).

### `memory.getReport(blobId: string): Promise<ReportBlob>`

Read a report blob from Walrus by ID.

## Architecture

```
agent_nft (Sui)              Walrus (blob storage)
┌──────────────────┐        ┌──────────────────────────┐
│ Merkle trail:     │        │                          │
│  leaf[0]→blob_0 ──┼──fetch─→ session_0.json           │
│  leaf[1]→blob_1 ──┼──fetch─→ session_1.json           │
│  leaf[2]→blob_2 ──┼──fetch─→ session_2.json           │
└──────────────────┘        └──────────────────────────┘
```

- **Write**: blob → Walrus, blobId → agent_nft
- **Read**: agent_nft → blobIds → Walrus → sessions
- **No local database**. The blockchain IS the index.
- **Any agent** can use this — not tied to RAXC.

## License

MIT
