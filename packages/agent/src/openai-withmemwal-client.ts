/*!
OpenAI Client — LLM inference with MemWal auto-memory injection.

Uses Vercel AI SDK + withMemWal wrapper:
  - Every LLM call auto-recalls past audit context
  - Every LLM call auto-remembers new findings
  - Same infer(prompt) interface — zero changes to callers
*/

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { withMemWal } from "@mysten-incubation/memwal/ai";

export class OpenAiWithMemwalClient {
  private model: ReturnType<typeof openai>;
  private modelName: string;

  /** Create from env vars. */
  static fromEnv(): OpenAiWithMemwalClient {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("OPENAI_API_KEY not set in .env");
    const model = process.env["OPENAI_MODEL"] ?? "gpt-4o-mini";
    return new OpenAiWithMemwalClient(apiKey, model);
  }

  constructor(apiKey: string, modelName: string) {
    const baseModel = openai(modelName);
    this.modelName = modelName;

    // Wrap with MemWal if keys available — auto recall + remember
    const memwalKey = process.env["MEMWAL_PRIVATE_KEY"];
    const memwalAccount = process.env["MEMWAL_ACCOUNT_ID"];
    if (memwalKey && memwalAccount) {
      this.model = withMemWal(baseModel, {
        key: memwalKey,
        accountId: memwalAccount,
        serverUrl: process.env["MEMWAL_SERVER_URL"] ?? "https://relayer.memory.walrus.xyz",
      });
    } else {
      this.model = baseModel; // no MemWal — fallback to plain OpenAI
    }
  }

  /** Run inference — returns the model's response text. */
  async infer(prompt: string): Promise<string> {
    return this.inferWithMaxTokens(prompt, 4096);
  }

  /** Run inference with custom max_tokens parameter. */
  async inferWithMaxTokens(prompt: string, maxTokens?: number): Promise<string> {
    const result = await generateText({
      model: this.model,
      system: "You are a smart contract security expert.",
      messages: [{ role: "user", content: prompt }]
    });

    const content = result.text;
    if (!content) throw new Error("OpenAI returned empty response");
    return content;
  }

  getModel(): string {
    return this.modelName;
  }
}
