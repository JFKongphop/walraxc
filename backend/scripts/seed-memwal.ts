#!/usr/bin/env bun
/*!
RAXC Walrus Seed — progress tracking + auto-resume.
Run: cd backend && bun run scripts/seed-memwal.ts
Stops on rate limit, saves progress. Re-run to continue.
*/

import { MemWal } from "@mysten-incubation/memwal";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(import.meta.dir, "..", "..");
const PROGRESS_FILE = path.resolve(import.meta.dir, "..", "seed-progress.json");

const KEY = "c023eab8fb2cc8f689caf154fddf55fd80294983ce3d6c91307b39cd9d7b5844";
const ACCOUNT = "0xd153944b8cd26964ce15ec9902a488015590fa930c6f77c23e0320acff627348";
const SERVER = "https://relayer.memory.walrus.xyz";
const NS = "raxc/defi-cases";

const SKIP = new Set(["interface.sol","Exploit-template.sol","Exploit-template_new.sol","RPCS_alive_test.sol"]);
const BATCH = 25;
const PAUSE = 65_000;

function walk(dir: string): string[] {
  const r: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) r.push(...walk(fp));
    else if (e.isFile() && e.name.endsWith(".sol") && !SKIP.has(e.name)) r.push(fp);
  }
  return r;
}

async function retry(m: any, text: string, max = 3): Promise<boolean> {
  for (let a = 0; a < max; a++) {
    try {
      const j = await m.remember(text);
      await m.waitForRememberJob(j.job_id);
      return true;
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes("429")) {
        const w = (parseInt(msg.match(/retry_after_seconds["\s:]+(\d+)/)?.[1] || "65")) + 5;
        console.log(`  [~] 429 — wait ${w}s, retry ${a+1}/${max}`);
        await new Promise(r => setTimeout(r, w * 1000));
      } else { console.error(`  [!] ${msg.slice(0,120)}`); return false; }
    }
  }
  return false;
}

function load(): Set<string> {
  try { if (fs.existsSync(PROGRESS_FILE)) return new Set(JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"))); }
  catch {}
  return new Set();
}
function save(done: string[]) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(done, null, 2)); }

function collect(): { name: string; text: string }[] {
  const e: { name: string; text: string }[] = [];
  const CD = path.join(ROOT, "datasets-case-exploit", "src", "test");
  const PD = path.join(ROOT, "datasets-protocol-exploit", "src", "test");
  if (fs.existsSync(CD)) for (const f of walk(CD)) {
    const c = fs.readFileSync(f,"utf-8"), s = path.basename(f,".sol");
    let d = ""; const mm = c.match(/\/\*\s*\n?\s*(Name:?.*?)\*\//s);
    if (mm) d = mm[1].replace(/Name:?\s*/i,"").replace(/\*/g,"").trim().slice(0,200);
    e.push({ name:`CASE_${s}`, text:`[VulnLabs][${s}]\n${d}\n${c.slice(0,3000)}` });
  }
  if (fs.existsSync(PD)) for (const f of walk(PD)) {
    const c = fs.readFileSync(f,"utf-8"), dir = path.basename(path.dirname(f));
    const s = path.basename(f,".sol").replace("_exp","");
    let d="",tx="",ch=""; const mm = c.match(/\/\*\s([\s\S]*?)\*\//);
    if (mm) { const tm = mm[1].match(/Example tx\s*[-:]\s*(https?:\/\/\S+)/i);
      if (tm) { tx=tm[1]; ch=tx.includes("etherscan")?"ETH":tx.includes("bscscan")?"BSC":"?"; }
      d = mm[1].replace(/Example tx.*/i,"").replace(/\n\s*\n/g," ").trim().slice(0,200); }
    e.push({ name:`${dir}_${s}`, text:`[Protocol][${s}][${ch}][${dir}][TX:${tx||"N/A"}]\n${d}\n${c.slice(0,3000)}` });
  }
  return e;
}

async function main() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   RAXC MemWal Seed — 781 exploits    ║");
  console.log("╚══════════════════════════════════════╝\n");

  const done = load();
  const m = MemWal.create({ key: KEY, accountId: ACCOUNT, serverUrl: SERVER, namespace: NS });

  console.log("[*] Health check...");
  await m.health();
  console.log("[✓] Relayer online\n");

  const all = collect();
  const remaining = all.filter(e => !done.has(e.name));

  console.log(`[*] Total:     ${all.length}`);
  console.log(`[*] Done:      ${done.size}`);
  console.log(`[*] Remaining: ${remaining.length}\n`);

  if (remaining.length === 0) { console.log("[✓] Already done!\n"); return; }

  let seeded = 0, failed = 0;
  const doneArr = [...done];

  for (let i = 0; i < remaining.length; i += BATCH) {
    const batch = remaining.slice(i, i + BATCH);
    const bn = Math.floor(i/BATCH)+1, total = Math.ceil(remaining.length/BATCH);
    console.log(`  Batch ${bn}/${total} (${batch.length} files)`);

    for (const e of batch) {
      if (await retry(m, e.text)) {
        seeded++;
        doneArr.push(e.name);
        save(doneArr);
        done.add(e.name);
        console.log(`  [+] ${e.name} (${done.size}/${all.length})`);
      } else { failed++; }
    }
    if (i + BATCH < remaining.length) {
      console.log(`  [~] Pause ${PAUSE/1000}s...\n`);
      await new Promise(r => setTimeout(r, PAUSE));
    }
  }

  console.log(`\n[Done] Seeded: ${seeded}  Failed: ${failed}  Total: ${done.size}/${all.length}\n`);
  if (done.size === all.length) { fs.unlinkSync(PROGRESS_FILE); console.log("[✓] ALL SEEDED!\n"); }
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
