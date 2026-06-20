/*!
WALRAXC MemWal Relay Server — exposes read-only recall() API for package users.

Deploy alongside WS server on Fly.io.
Holds our MEMWAL_PRIVATE_KEY. Exposes only recall() — no writes.
Users authenticate with API key.

Endpoints:
  POST /v1/recall   { query, apiKey, topK? }  →  RagResult[]
  GET  /v1/health                               →  { status: "ok" }
*/

import { Hono } from "hono";
import { MemWal } from "@mysten-incubation/memwal";

const app = new Hono();

// ═══ Config — hardcoded server-side, never exposed to clients ════════════════

const MEMWAL_KEY = process.env["MEMWAL_PRIVATE_KEY"] || "";
const MEMWAL_ACCOUNT = process.env["MEMWAL_ACCOUNT_ID"] || "";
const MEMWAL_SERVER = process.env["MEMWAL_SERVER_URL"] || "https://relayer.memory.walrus.xyz";
const API_KEY = process.env["WALRAXC_API_KEY"] || "rax-public-2025";

// ═══ Shared MemWal client ═════════════════════════════════════════════════════

let _memwal: ReturnType<typeof MemWal.create> | null = null;
function getMemWal() {
  if (!_memwal) {
    _memwal = MemWal.create({
      key: MEMWAL_KEY,
      accountId: MEMWAL_ACCOUNT,
      serverUrl: MEMWAL_SERVER,
      namespace: "raxc/defi-cases",
    });
  }
  return _memwal;
}

// ═══ Routes ═══════════════════════════════════════════════════════════════════

app.get("/v1/health", (c) => c.json({ status: "ok", db: "raxc/defi-cases" }));

app.post("/v1/recall", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const apiKey = (body.apiKey || c.req.header("x-api-key") || "").trim();
  const query = (body.query || "").trim();
  const topK = Math.min(parseInt(body.topK) || 5, 20);

  // Auth
  if (!apiKey || apiKey !== API_KEY) {
    return c.json({ error: "Invalid or missing API key" }, 401);
  }
  if (!query) {
    return c.json({ error: "Missing query field" }, 400);
  }

  try {
    const m = getMemWal();
    const r = await m.recall({ query });
    const results = (r.results || []).slice(0, topK).map((x: any) => ({
      text: x.text || "",
      score: x.score || 0,
    }));

    return c.json({ results });
  } catch (e: any) {
    console.error("[relay] recall failed:", e.message || e);
    return c.json({ error: "Internal error" }, 500);
  }
});

// ═══ Server ═══════════════════════════════════════════════════════════════════

const port = parseInt(process.env["RELAY_PORT"] || "3002", 10);

console.log(`\n╔══════════════════════════════════════════╗`);
console.log(`║   WALRAXC MemWal Relay — Read-Only API      ║`);
console.log(`║   http://0.0.0.0:${port}                      ║`);
console.log(`╚══════════════════════════════════════════╝\n`);

export default { port, fetch: app.fetch };
