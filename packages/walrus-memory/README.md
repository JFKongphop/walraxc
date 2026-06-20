# @raxclaw/walrus-memory

**Verifiable RAG + persistent memory for AI security agents, powered by Walrus.**

## Quick Start

```bash
npm install @raxclaw/walrus-memory
```

```ts
import { RaxcMemory } from "@raxclaw/walrus-memory";

const memory = RaxcMemory.init();

// Search 781 DeFi exploit patterns
const exploits = await memory.recallRag("reentrancy external call");
// → [
//   { text: "[VulnLabs][Reentrancy] EtherStore pattern...", score: 0.92 },
//   { text: "[Protocol][Bancor][ETH] Access Control...", score: 0.87 },
//   ...
// ]

// Health check
const ok = await memory.health(); // → true
```

## Architecture

```
@raxclaw/walrus-memory
         │
         ▼
raxclaw-mantle.fly.dev/v1/recall  (relay server)
         │
         ▼
MemWal (raxc/defi-cases) → 781 DeFi exploit patterns
         │
         ▼
Walrus (encrypted blob storage)
```

## API

| Method | Description |
|---|---|
| `RaxcMemory.init(config?)` | Create client (defaults to public API) |
| `recallRag(query, topK?)` | Semantic search exploit database |
| `health()` | Relay connection check |

## License

MIT
