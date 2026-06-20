# walraxc

**One call = full AI agent context.** Composes `@walraxc/long-context-memory` + `@walraxc/memwal-rag` into a single unified interface.

## Install

```bash
npm install walraxc
```

## Quick Start

```ts
import { RaxcMemory } from "walraxc";

const memory = RaxcMemory.init({
  longContext: {
    suiPrivateKey:    process.env.SUI_PRIVATE_KEY!,
    packageId:        process.env.SUI_PACKAGE_ID!,
    nftRegistryId:    process.env.SUI_NFT_REGISTRY_ID!,
    auditRegistryId:  process.env.SUI_AUDIT_REGISTRY_ID!,
    adminCapId:       process.env.SUI_ADMIN_CAP_ID!,
    walrusPublisher:  "https://publisher.walrus-testnet.walrus.space/v1/blobs",
    walrusAggregator: "https://aggregator.walrus-testnet.walrus.space/v1/blobs",
  },
  rag: {
    privateKey: process.env.MEMWAL_PRIVATE_KEY!,
    accountId:  process.env.MEMWAL_ACCOUNT_ID!,
    namespace:  "raxc/defi-cases",
  },
});

// One call → everything your LLM needs
const ctx = await memory.fullContext("reentrancy", contractCode);

// ctx.sessions      → [{ contract_name: "DeFiVault", vulnerability_type: "Reentrancy", ... }, ...]
// ctx.exploits      → [{ score: 0.747, content: "DAO reentrancy pattern..." }, ...]
// ctx.mergedPrompt  → paste this into any LLM

// Send to OpenAI / Anthropic / any LLM:
const answer = await openai.chat(ctx.mergedPrompt);

// Store the result:
await memory.store({ contract_name: "MyContract", vulnerability_type: "Reentrancy", ... });
```

## API

### `memory.fullContext(query, contractCode?)`

| Returns | Description |
|---|---|
| `sessions` | All past audit summaries from on-chain `agent_nft` → Walrus |
| `exploits` | Relevant exploit patterns from MemWal RAG |
| `mergedPrompt` | Formatted prompt ready for any LLM |

### `memory.store(session)` / `memory.recall()`
Delegated to `@walraxc/long-context-memory`.

### `memory.searchExploits(query)`
Delegated to `@walraxc/memwal-rag`.

## Architecture

```
@walraxc/raxc-memory
├── @walraxc/long-context-memory  (Walrus blobs + agent_nft Merkle trail)
└── @walraxc/memwal-rag           (MemWal exploit pattern search)
         │
         ▼
   fullContext(query)
         │
         ├── sessions   (past audit memory)
         ├── exploits   (similar vulnerability patterns)
         └── mergedPrompt (paste into any LLM)
```

## License

MIT
