# @walraxc/agent

WALRAXC 13-phase deterministic audit orchestrator — multi-agent security analysis engine.

## Install

```bash
npm install @walraxc/agent
```

## Usage

```ts
import { AgentCore, WalrusClient, SuiMoveClient, loadEnv } from '@walraxc/agent';

loadEnv();

const walrus = WalrusClient.fromEnv();
const core = new AgentCore(walrus, openAiClient);

// Attach on-chain proof layer
const suiMove = SuiMoveClient.fromEnv();
await core.attachSuiMove(suiMove);

// Register tools
core.tools.register(new WalraxcAnalyzer(walrus, openAiClient));
// ... register all 8 tools

// Run audit
const result = await core.analyze(contractCode, 'MyContract');
console.log(result.decision.primaryVulnerability); // "Reentrancy"
```

## API

| Export | Purpose |
|--------|---------|
| `AgentCore` | 13-phase orchestrator |
| `WalrusClient` | Walrus blob + MemWal RAG client |
| `SuiMoveClient` | Sui Move on-chain proof client |
| `OpenAiWithMemwalClient` | OpenAI + MemWal auto recall/remember |
| `WalraxcAnalyzer` | RAG semantic exploit matching |
| `GasAnalyzerTool` | Gas optimization analysis |
| `PatternDetectorTool` | Static vulnerability patterns |
| `FlashLoanTool` | Flash loan detection |
| `AccessControlTool` | Access control checks |
| `ReflectionTool` | LLM self-critique |
| `MemoryTool` | Persistent memory recall |
| `loadEnv` | Load .env configuration |
