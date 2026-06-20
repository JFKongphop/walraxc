/*!
@walraxc/memwal-rag — Types
*/

export interface MemWalConfig {
  privateKey: string;          // memwal private key (hex)
  accountId: string;           // memwal account ID (0x...)
  serverUrl?: string;          // default: relayer.memory.walrus.xyz
  namespace?: string;          // default: raxc/defi-cases
}

export interface RagMatch {
  id: string;                  // memwal memory ID
  score: number;               // 0-1 similarity score (1/(1+distance))
  content: string;             // the stored exploit pattern / text
  distance?: number;           // raw vector distance from memwal
}
