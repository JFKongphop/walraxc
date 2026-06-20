# @walraxc/memwal-rag

Semantic exploit pattern search via **MemWal**. Pre-seeded with 781 DeFi exploits.
Zero embedding cost — MemWal relayer handles everything.

## Install

```bash
npm install @walraxc/memwal-rag
```

## Quick Start

```ts
import { ExploitRAG } from "@walraxc/memwal-rag";

const rag = ExploitRAG.init({
  privateKey: process.env.MEMWAL_PRIVATE_KEY!,
  accountId:  process.env.MEMWAL_ACCOUNT_ID!,
  namespace:  "raxc/defi-cases", // 781 patterns pre-seeded
});

// Search for similar exploits
const matches = await rag.search("reentrancy external call before state update");

matches.forEach(m => {
  console.log(`[${(m.score * 100).toFixed(1)}%] ${m.content.slice(0, 100)}`);
});
// [74.7%] DAO reentrancy pattern — external call before balance update...
// [68.2%] Unchecked external call in withdraw function...
// ...
```

## API

### `ExploitRAG.init(config)`

| Param | Type | Description |
|---|---|---|
| `privateKey` | `string` | MemWal private key (hex) |
| `accountId` | `string` | MemWal account ID (0x...) |
| `serverUrl` | `string?` | Default: `https://relayer.memory.walrus.xyz` |
| `namespace` | `string?` | Default: `raxc/defi-cases` |

### `rag.search(query, limit?)`

Returns `RagMatch[]` sorted by score:
```ts
{ id: string, score: number, content: string }
```

### `rag.seed(patterns[], onProgress?)`

Seed custom patterns into a namespace. Returns count seeded.

## Why MemWal?

- No embedding API calls → zero cost
- Namespace isolation → your data, your namespace
- Encrypted at rest → patterns stay private
- Semantic search → finds similar exploits, not just keyword matches

## License

MIT
