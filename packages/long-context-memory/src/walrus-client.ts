/*!
@walraxc/long-context-memory — Walrus Client

HTTP API wrapper for Walrus blob storage.
publisher = write, aggregator = read.
*/

import type { AgentMemoryConfig, ReportBlob } from "./types";

export class WalrusBlobClient {
  private publisherUrl: string;
  private aggregatorUrl: string;

  constructor(config: AgentMemoryConfig) {
    this.publisherUrl = config.walrusPublisher.replace(/\/$/, "");
    this.aggregatorUrl = config.walrusAggregator.replace(/\/$/, "");
  }

  /** Store data as a Walrus blob. Returns blob ID. */
  async store(data: string | Uint8Array): Promise<string> {
    const body = typeof data === "string" ? data : data;
    const url = `${this.publisherUrl}?epochs=10`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Walrus store failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const json: any = await res.json();
    const blobId = json.newlyCreated?.blobObject?.blobId || json.blobId;
    if (!blobId) throw new Error("Walrus store: no blobId in response");
    return blobId;
  }

  /** Read a Walrus blob by ID. Returns text content. */
  async read(blobId: string): Promise<string> {
    const url = `${this.aggregatorUrl}/${encodeURIComponent(blobId)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Walrus read failed (${res.status})`);
    }
    return res.text();
  }

  /** Store a full audit report (markdown). */
  async storeReport(markdown: string): Promise<ReportBlob> {
    const blobId = await this.store(markdown);
    return { blobId, content: markdown };
  }

  /** Read a full audit report by blob ID. */
  async getReport(blobId: string): Promise<ReportBlob> {
    const content = await this.read(blobId);
    return { blobId, content };
  }
}
