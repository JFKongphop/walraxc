# WALRAXC Frontend

Next.js frontend for the WALRAXC autonomous smart contract vulnerability scanner — powered by MemWal RAG + AI SDK, with on-chain audit proofs on Sui Move + Walrus.

## Features

- 🔍 **Live Audit Terminal** — Paste any Solidity contract and run the 13-phase analysis pipeline via WebSocket
- 🧠 **Cognition History** — All past audits displayed from agent_nft Merkle trail on Sui
- 📦 **Blob Storage** — Content-addressed audit reports on Walrus, forever verifiable
- 📊 **Real-time Stats** — Live on-chain metrics from Sui Testnet
- 🔗 **Sui Move** — audit_task (ERC-8183) + agent_nft (ERC-7857) for on-chain proofs

---

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Update `.env.local`:

```bash
# WebSocket (RAXC audit engine)
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws

# Mantle Sepolia
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.mantle.xyz
NEXT_PUBLIC_CHAIN_ID=5003
NEXT_PUBLIC_RAXC_AGENT=0x9eD9190d6B2a57444020a7C4461f8A17B0638d4e

# Owner private key (for ECIES report decryption)
PRIVATE_KEY=0x...
```

### 3. Start

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Architecture

```
Frontend (Next.js)
  ├─ LiveTerminal → ws://localhost:3001/ws  (real-time audit streaming)
  ├─ /api/rpc     → Mantle Sepolia RPC      (on-chain stats + event logs)
  ├─ /api/report/[id] → contract decrypt    (ECIES + AES-256-GCM)
  └─ /tx-report/[hash] → per-tx audit viewer
```

## Pages

| Route | Description |
|---|---|
| `/` | Landing page with live stats, cognition cards, and audit terminal |
| `/tx-report/[hash]` | View a specific audit report by transaction hash |

---

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Update with your values:

```bash
# Backend API (use production or local)
NEXT_PUBLIC_API_URL=http://localhost:3001/ws  # local dev
# NEXT_PUBLIC_API_URL=http://localhost:8080  # Local development

# Initia Network
NEXT_PUBLIC_RPC_URL=https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz
NEXT_PUBLIC_CHAIN_ID=your_chain_id_here

# Contract Addresses (from deployment)
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...
```

---

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Build

```bash
npm run build
```
- ✅ Prevents over/undercharging users

---

## Initia Integration

Using `@initia/interwovenkit-react` for:
- **Auto-signing:** Gasless transactions for better UX
- **Interwoven-bridge:** Cross-chain USDC deposits from Ethereum
- **Wallet connection:** Unified Initia wallet interface

---

## Production Build

```bash
npm run build
npm start
```

---

## Links

- [Smart Contract Docs](../contracts/VAULT_README.md)
- [Integration Guide](../contracts/INTEGRATION_GUIDE.md)
- [Backend API Docs](../backend/API_README.md)
- [Deployment Guide](../DEPLOYMENT_INITIA.md)
