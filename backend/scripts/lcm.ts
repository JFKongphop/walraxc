/*!
RAXC Long-Context Memory viewer — reads agent_nft Merkle trail from Sui testnet
and fetches all linked Walrus blobs.

Run:  make lcm
*/

import { SuiMoveClient } from "../src/sui-client.ts";
import { WalrusClient } from "../src/walrus-client.ts";
import "dotenv/config";

const c = SuiMoveClient.fromEnv()!;
const w = WalrusClient.fromEnv();
const nftId = process.env["SUI_AGENT_NFT_ID"]!;

console.log("=== agent_nft Merkle Trail (on-chain) ===\n");
console.log("NFT ID:", nftId, "\n");

const entries = await c.getAgentData(nftId);
console.log("Total entries:", entries.length, "\n");

for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  const blobId = new TextDecoder().decode(e.hash);
  console.log(`Entry ${i}:`, e.description);
  console.log("  Raw blobId:", blobId);
  const clean = blobId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (clean.length > 10) {
    try {
      const j = await w.getReport(clean);
      const p = JSON.parse(j);
      console.log(`  ✅ LIVE: ${p.contract_name} | ${p.vulnerability_type} | ${p.risk_level} | ${p.confidence}%`);
    } catch (err: any) {
      console.log("  ❌", err.message?.slice(0, 80));
    }
  } else {
    console.log("  ⬜ placeholder");
  }
  console.log();
}
