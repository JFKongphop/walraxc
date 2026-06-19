#!/usr/bin/env tsx
/*!
RAXC Sui Move Client — Test Script

Demonstrates:
  1. Create audit task
  2. Finalize audit task
  3. Verify audit task
  4. Mint agent NFT
  5. Update agent intelligence
*/

import "dotenv/config";
import { SuiMoveClient } from "../src/sui-client.ts";

async function main() {
  console.log("🚀 RAXC Sui Move Client Test\n");

  // Load client from environment
  const client = SuiMoveClient.fromEnv();
  if (!client) {
    console.error("❌ Missing SUI_PRIVATE_KEY or SUI_PACKAGE_ID in .env");
    process.exit(1);
  }

  const agentAddress = process.env["SUI_ADDRESS"] || "";

  try {
    // Test 1: Create audit task
    console.log("1️⃣  Creating audit task...");
    const { taskId, txDigest } = await client.createAuditTask("TestContract.sol");
    console.log(`   ✅ Task ID: ${taskId}`);
    console.log(`   📝 TX: ${txDigest}\n`);

    // Test 2: Read task data after creation
    console.log("2️⃣  Reading task data...");
    const taskCount = await client.getTaskCount();
    const requester = await client.getTaskRequester(taskId);
    const contractName = await client.getTaskContractName(taskId);
    const state = await client.getTaskState(taskId);
    const createdAt = await client.getTaskCreatedAt(taskId);
    console.log(`   📊 Total tasks: ${taskCount}`);
    console.log(`   👤 Requester: ${requester.slice(0, 10)}...`);
    console.log(`   📄 Contract: ${contractName}`);
    console.log(`   🔄 State: ${state === 0 ? "CREATED" : "COMPLETED"}`);
    console.log(`   🕐 Created: ${new Date(createdAt).toISOString()}\n`);

    // Test 3: Finalize audit task
    console.log("3️⃣  Finalizing audit task...");
    const rootHash = new Uint8Array(32).fill(0xaa); // Example hash
    const traceHash = new Uint8Array(32).fill(0xbb);
    const finalizeTx = await client.finalizeAuditTask({
      taskId,
      verdict: "MEDIUM_RISK",
      confidence: 8500, // 85.00%
      rootHash,
      replayId: "replay-123",
      traceHash,
    });
    console.log(`   ✅ Finalized`);
    console.log(`   📝 TX: ${finalizeTx}\n`);

    // Test 4: Read finalized task data
    console.log("4️⃣  Reading finalized task data...");
    const finalState = await client.getTaskState(taskId);
    const verdict = await client.getTaskVerdict(taskId);
    const confidence = await client.getTaskConfidence(taskId);
    const replayId = await client.getTaskReplayId(taskId);
    const completedAt = await client.getTaskCompletedAt(taskId);
    const isVerified = await client.verifyTask(taskId);
    console.log(`   🔄 State: ${finalState === 0 ? "CREATED" : "COMPLETED"}`);
    console.log(`   ⚖️  Verdict: ${verdict}`);
    console.log(`   📈 Confidence: ${confidence / 100}%`);
    console.log(`   🎬 Replay ID: ${replayId}`);
    console.log(`   🕐 Completed: ${new Date(completedAt).toISOString()}`);
    console.log(`   ${isVerified ? "✅" : "❌"} Verified: ${isVerified}\n`);

    // Test 5: Mint agent NFT
    console.log("5️⃣  Minting agent NFT...");
    const initialData = [
      {
        data_description: "Initial agent configuration",
        data_hash: Array.from(new Uint8Array(32).fill(0x11)),
      },
      {
        data_description: "Security audit baseline",
        data_hash: Array.from(new Uint8Array(32).fill(0x22)),
      },
    ];
    const mintTx = await client.mintAgentNFT(agentAddress, agentAddress, initialData);
    console.log(`   ✅ NFT minted`);
    console.log(`   📝 TX: ${mintTx}\n`);

    // Note: Test 6 requires the NFT ID from the mint transaction
    console.log("6️⃣  Update agent intelligence - requires NFT ID from mint tx");
    console.log(`   ℹ️  Check explorer for NFT ID: https://testnet.suivision.xyz/txblock/${mintTx}\n`);

    console.log("🎉 All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

main();
