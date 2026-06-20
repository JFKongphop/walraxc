/*!
WALRAXC Frontend — Sui Move + Walrus
*/

// ─── Configuration ────────────────────────────────────────────────────────────

export const SUI_RPC_URL =
  process.env['NEXT_PUBLIC_SUI_RPC_URL'] || 'https://fullnode.testnet.sui.io:443';

export const SUI_PACKAGE_ID =
  process.env['NEXT_PUBLIC_SUI_PACKAGE_ID'] || '0x79db8cf1f78b8a262bd811ac4688aef5e903eefd8255c95aa1a3e273c46f1694';

export const AGENT_NFT_ID =
  process.env['NEXT_PUBLIC_AGENT_NFT_ID'] || '0x926b7fd348ad27b3d01efa71d7575569a1817a63cb324ac44f6ec6edae78bc0d';

export const WALRUS_AGGREGATOR =
  'https://aggregator.walrus-testnet.walrus.space/v1/blobs';

export const WALRUS_PUBLISHER =
  'https://publisher.walrus-testnet.walrus.space/v1/blobs';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnChainAudit {
  taskId: string;
  contractName: string;
  verdict: string;
  confidence: number;
  riskLevel: string;
  reportBlobId: string;
  summaryBlobId: string;
  createdAt: string;
  explorerUrl: string;
}

export interface ChainStats {
  auditsCompleted: number;
  agentMemory: number;
  reportBlobs: number;
  exploitPatterns: number;
  online: boolean;
}

// ─── Sui RPC helper ───────────────────────────────────────────────────────────

async function suiRpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(SUI_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

// ─── Walrus helper ────────────────────────────────────────────────────────────

async function walrusRead(blobId: string): Promise<any> {
  const res = await fetch(`${WALRUS_AGGREGATOR}/${encodeURIComponent(blobId)}`);
  if (!res.ok) throw new Error(`Walrus 404: ${blobId}`);
  return res.json();
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function fetchChainStats(): Promise<ChainStats> {
  try {
    const obj = await suiRpc('sui_getObject', [
      AGENT_NFT_ID,
      { showContent: true },
    ]);

    const fields = obj?.data?.content?.fields || {};
    const history = fields.history || [];
    const current = fields.intelligent_datas || [];
    const trailCount = ((Array.isArray(history) ? history.length : 0) +
      (Array.isArray(current) ? current.length : 0));

    return {
      auditsCompleted: trailCount,
      agentMemory: trailCount,
      reportBlobs: trailCount,
      exploitPatterns: 781,
      online: true,
    };
  } catch {
    return {
      auditsCompleted: 0,
      agentMemory: 0,
      reportBlobs: 0,
      exploitPatterns: 781,
      online: false,
    };
  }
}

// ─── Audit Trail ──────────────────────────────────────────────────────────────

/** Query AuditTaskCompleted events from Sui to get report blob IDs (root_hash). */
async function fetchTaskCompletedEvents(): Promise<Map<string, string>> {
  const map = new Map<string, string>(); // contractName → reportBlobId
  try {
    const events = await suiRpc('suix_queryEvents', [{
      MoveEventType: `${SUI_PACKAGE_ID}::audit_task::AuditTaskCompleted`,
    }]);
    for (const ev of (events?.data || [])) {
      const pj = ev?.parsedJson;
      const verdict: string = pj?.verdict || '';
      const rootHash: number[] = pj?.root_hash || [];
      const reportBlobId = new TextDecoder().decode(new Uint8Array(rootHash)).replace(/[^a-zA-Z0-9_-]/g, '');
      if (reportBlobId.length < 10) continue;
      // verdict format: "VulnType | RiskLevel"
      const vulnType = verdict.split(' | ')[0]?.trim() || verdict;
      map.set(vulnType.toLowerCase(), reportBlobId);
    }
  } catch { /* events may not be indexed yet */ }
  return map;
}

export async function fetchAuditTasks(): Promise<OnChainAudit[]> {
  try {
    const obj = await suiRpc('sui_getObject', [
      AGENT_NFT_ID,
      { showContent: true },
    ]);

    const fields = obj?.data?.content?.fields || {};
    const history: any[] = Array.isArray(fields.history) ? fields.history : [];
    const current: any[] = Array.isArray(fields.intelligent_datas) ? fields.intelligent_datas : [];

    const audits: OnChainAudit[] = [];

    // Fetch audit_task report blob IDs as fallback (for entries without | report: prefix)
    const taskReportBlobs = await fetchTaskCompletedEvents();

    // Iterate history snapshots in reverse — each has timestamp_ms + datas
    for (const snapshot of [...history].reverse()) {
      const ts = snapshot?.fields?.timestamp_ms;
      const createdAt = ts ? new Date(parseInt(ts)).toISOString() : '';
      const datas: any[] = Array.isArray(snapshot?.fields?.datas) ? snapshot.fields.datas : [];

      for (const entry of datas) {
        const ef = entry?.fields || entry;
        const desc: string = ef.data_description || '';
        const hashArr: number[] = ef.data_hash || [];
        const blobId = new TextDecoder().decode(new Uint8Array(hashArr)).replace(/[^a-zA-Z0-9_-]/g, '');
        if (blobId.length < 10) continue;

        // Parse from on-chain description:
        // "Session: ContractName — VulnType (85%) | report:blobId"
        let reportBlobId = blobId;
        const descClean = desc.replace('Session: ', '');
        const [mainPart, reportPart] = descClean.split(' | report:');
        if (reportPart && reportPart.length > 10) reportBlobId = reportPart.trim();
        const parts = mainPart.split(' — ');
        const name = parts[0] || 'Unknown';
        // Filter out misparsed names from old audits (pragma, solidity, etc.)
        const cleanName = /^(pragma|solidity|contract|module|import|use|public|fun|struct|let|const)$/i.test(name) ? 'Unknown' : name;
        const vulnAndConf = parts[1] || '';
        const vulnMatch = vulnAndConf.match(/(.+)\((\d+)%\)/);
        const vuln = vulnMatch?.[1]?.trim() || vulnAndConf || 'Unknown';
        const confidence = vulnMatch ? parseInt(vulnMatch[2]) : 0;

        if (reportBlobId === blobId) {
          const fallback = taskReportBlobs.get(vuln.toLowerCase());
          if (fallback) reportBlobId = fallback;
        }

        audits.push({
          taskId: blobId.slice(0, 8),
          contractName: cleanName,
          verdict: vuln,
          confidence,
          riskLevel: confidence >= 80 ? 'Critical' : confidence >= 60 ? 'High' : 'Medium',
          reportBlobId,
          summaryBlobId: blobId,
          createdAt,
          explorerUrl: `https://walruscan.com/testnet/blob/${reportBlobId}`,
        });
      }
    }

    return audits;
  } catch {
    return [];
  }
}

// ─── Risk Labels ──────────────────────────────────────────────────────────────

export const RISK_LABELS = ['None', 'Low', 'Medium', 'High', 'Critical'];

export function verdictToSeverity(verdict: string): number {
  const v = verdict.toLowerCase();
  if (v.includes('critical')) return 4;
  if (v.includes('high')) return 3;
  if (v.includes('medium')) return 2;
  if (v.includes('low')) return 1;
  return 0;
}
