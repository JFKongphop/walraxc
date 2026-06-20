/*!
@walraxc/raxc-memory — Types
*/

import type { AgentMemoryConfig, SessionSummary } from "@walraxc/long-context-memory";
import type { MemWalConfig, RagMatch } from "@walraxc/memwal-rag";

export interface RaxcMemoryConfig {
  longContext: AgentMemoryConfig;   // Walrus + Sui
  rag: MemWalConfig;                // MemWal
}

export interface FullContext {
  sessions: SessionSummary[];       // long-term memory (all past audits)
  exploits: RagMatch[];             // relevant exploit patterns
  mergedPrompt: string;             // ready-to-use prompt for any LLM
}
