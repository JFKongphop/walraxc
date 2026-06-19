#!/usr/bin/env bun
/*!
RAXC MemWal Explorer — query the seeded exploit RAG database.
Usage: cd backend && bun run scripts/explore-memwal.ts [query]
Example: bun run scripts/explore-memwal.ts "flash loan price manipulation"
*/

import { MemWal } from "@mysten-incubation/memwal";

const query = process.argv[2] || "reentrancy";

const m = MemWal.create({
  key: "c023eab8fb2cc8f689caf154fddf55fd80294983ce3d6c91307b39cd9d7b5844",
  accountId: "0xd153944b8cd26964ce15ec9902a488015590fa930c6f77c23e0320acff627348",
  serverUrl: "https://relayer.memory.walrus.xyz",
  namespace: "raxc/defi-cases",
});

console.log(`\n╔══════════════════════════════════════════╗`);
console.log(`║   RAXC MemWal Explorer — raxc/defi-cases ║`);
console.log(`╚══════════════════════════════════════════╝\n`);
console.log(`Query: "${query}"\n`);

try {
  const r = await m.recall({ query });
  console.log(`Results: ${r.results?.length || 0}\n`);
  if (r.results?.length) {
    for (let i = 0; i < r.results.length; i++) {
      const x = r.results[i];
      const text = (x.text || "").slice(0, 120);
      const score = x.score != null ? (x.score * 100).toFixed(1) + "%" : "N/A";
      console.log(`[${i + 1}] ${score.padStart(6)} | ${text}`);
    }
  }
  console.log("");
} catch (e: any) {
  console.error("FAIL:", e.message || e);
}
