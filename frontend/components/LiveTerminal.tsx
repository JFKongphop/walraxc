'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface TerminalLine {
  text: string;
  type: 'info' | 'progress' | 'banner' | 'phase' | 'explanation' | 'complete' | 'error' | 'input' | 'memory';
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://walraxc.fly.dev/ws';

const DEMO_CONTRACT = `// DeFiVault — built-in demo contract (Sui Move)
module vulnerable::defi_vault {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::tx_context::{TxContext, sender};
    use sui::transfer;
    use sui::balance::{Self, Balance};

    public struct Vault has key {
        id: UID,
        balances: vector<address>,
        amounts: vector<u64>,
    }

    fun init(ctx: &mut TxContext) {
        transfer::share_object(Vault {
            id: object::new(ctx),
            balances: vector[],
            amounts: vector[],
        });
    }

    public entry fun deposit(vault: &mut Vault, coin: Coin<SUI>, ctx: &mut TxContext) {
        let amount = coin::value(&coin);
        let depositor = sender(ctx);
        let (found, idx) = find_index(&vault.balances, depositor);
        if (found) {
            vault.amounts[idx] = vault.amounts[idx] + amount;
        } else {
            vault.balances.push_back(depositor);
            vault.amounts.push_back(amount);
        };
        // ❌ Coin destroyed — never transferred to vault balance
        let _ = coin;
    }

    // ❌ Reentrancy-equivalent: no sender check, balance dropped
    public entry fun withdraw(vault: &mut Vault, amount: u64, ctx: &mut TxContext) {
        let withdrawer = sender(ctx);
        let (found, idx) = find_index(&vault.balances, withdrawer);
        assert!(found, 0);
        assert!(vault.amounts[idx] >= amount, 1);
        vault.amounts[idx] = vault.amounts[idx] - amount;
        // ❌ Balance created but never transferred — funds trapped
        let bal = balance::zero<SUI>();
        balance::join(&mut bal, balance::create_for_testing(amount));
    }

    fun find_index(vec: &vector<address>, target: address): (bool, u64) {
        let i = 0;
        while (i < vec.length()) {
            if (vec[i] == target) return (true, i);
            i = i + 1;
        };
        (false, 0)
    }
}`;

export function LiveTerminal() {
  const router = useRouter();
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [contract, setContract] = useState(DEMO_CONTRACT);
  const [connected, setConnected] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [wsUrl, setWsUrl] = useState(WS_URL);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [reportTxHash, setReportTxHash] = useState<string | null>(null);
  const [reportFilename, setReportFilename] = useState('audit-report.md');
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const addLine = useCallback((text: string, type: TerminalLine['type'] = 'info') => {
    setLines(prev => [...prev, { text, type }]);
  }, []);

  const connectAndAnalyze = useCallback(async () => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setLines([]);
    setAnalyzing(true);
    setReportTxHash(null);
    setReportUrl(null);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      addLine('⚡ Connected to WALRAXC WebSocket', 'info');
      addLine('', 'info');
      // Send contract
      ws.send(JSON.stringify({ contract }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'banner':
            addLine(data.text, 'banner');
            break;
          case 'info':
            addLine(data.text, 'info');
            break;
          case 'progress':
            addLine(data.text, 'progress');
            break;
          case 'memory': {
            const entries: Array<{ contract_name: string; vulnerability_type: string; risk_level: string; confidence: number }> = data.entries || [];
            if (entries.length > 0) {
              addLine('', 'info');
              addLine(`[🧠 Memory] Loaded ${entries.length} past audit sessions:`, 'phase');
              for (let i = 0; i < entries.length; i++) {
                const e = entries[i];
                addLine(`  [${i}] ${e.contract_name} — ${e.vulnerability_type} (${e.risk_level}, ${e.confidence}%)`, 'progress');
              }
              addLine('', 'info');
            }
            break;
          }
          case 'explanation':
            addLine('', 'info');
            addLine('[🧠 LLM EXPLANATION]', 'phase');
            addLine(data.text, 'explanation');
            break;
          case 'complete':
            setAnalyzing(false);
            addLine('', 'info');
            addLine('╔═══════════════════════════════════════════════════════╗', 'banner');
            addLine('║   AUTONOMOUS ENGINE — SOVEREIGN EXECUTION COMPLETE    ║', 'banner');
            addLine('╚═══════════════════════════════════════════════════════╝', 'banner');
            addLine(`  Contract:        ${data.summary?.contract || '?'}`, 'info');
            addLine(`  Vulnerability:   ${data.summary?.vulnerability_found ? 'YES' : 'NO'}`, 'info');
            addLine(`  Risk Level:      ${data.summary?.risk_level || '?'}`, 'info');
            addLine(`  Confidence:      ${((data.summary?.confidence || 0) * 100).toFixed(1)}%`, 'info');
            addLine(`  Final Verdict:   ${data.summary?.final_verdict || '?'}`, 'info');
            addLine(`  AgentMemory TX:  ${data.summary?.storage_tx || '—'}`, 'info');
            const rb = data.summary?.report_blob;
            if (rb) addLine(`  Report Blob:     https://walruscan.com/testnet/blob/${rb}`, 'info');
            const sb = data.summary?.summary_blob;
            if (sb) addLine(`  Memory Blob:     https://walruscan.com/testnet/blob/${sb}`, 'info');
            setReportTxHash(rb || null);
            // Use the actual markdown report from the server
            const markdown = data.markdown || lines.map(l => l.text).join('\n');
            const filename = data.summary?.report_path || data.reportPath || 'audit-report.md';
            setReportFilename(filename.replace(/^WALRAXC_/, ''));
            const blob = new Blob([markdown], { type: 'text/markdown' });
            setReportUrl(URL.createObjectURL(blob));
            ws.close();
            break;
          case 'error':
            setAnalyzing(false);
            addLine(`❌ ${data.message}`, 'error');
            ws.close();
            break;
        }
      } catch {
        // Non-JSON message — display raw
        addLine(event.data, 'info');
      }
    };

    ws.onerror = () => {
      addLine('❌ WebSocket connection error', 'error');
      setAnalyzing(false);
    };

    ws.onclose = () => {
      setConnected(false);
    };
  }, [contract, wsUrl, addLine]);

  const clearTerminal = () => {
    setLines([]);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setAnalyzing(false);
  };

  return (
    <section className="section">
      <div className="section-inner" style={{ maxWidth: 960 }}>
        <div className="section-label">Live Terminal</div>
        <h2 className="section-title">
          Interactive
          <br />
          Audit Console
        </h2>
        <p className="section-desc" style={{ marginBottom: 24 }}>
          Paste a Solidity or Sui Move contract and run the WALRAXC
        </p>

        {/* WS URL config */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
            {wsUrl.startsWith('wss://') ? 'wss://' : 'ws://'}
          </span>
          <input
            type="text"
            value={wsUrl.replace(/^wss?\:\/\//, '')}
            onChange={(e) => setWsUrl((wsUrl.startsWith('wss://') ? 'wss://' : 'ws://') + e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 12px',
              color: 'var(--cyan)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              width: 200,
              outline: 'none',
            }}
            disabled={analyzing}
          />
        </div>

        {/* Contract input */}
        <textarea
          ref={inputRef}
          value={contract}
          onChange={(e) => setContract(e.target.value)}
          rows={14}
          spellCheck={false}
          style={{
            width: '100%',
            background: '#050505',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 16,
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: 1.5,
            resize: 'vertical',
            outline: 'none',
            marginBottom: 16,
          }}
          disabled={analyzing}
        />

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={connectAndAnalyze}
              disabled={analyzing || !contract.trim()}
              className="btn btn-primary"
              style={{ fontSize: 14 }}
            >
              {analyzing ? '⏳ Analyzing...' : '▶ Run Audit'}
            </button>
            <button
              onClick={clearTerminal}
              disabled={analyzing}
              className="btn btn-secondary"
              style={{ fontSize: 14 }}
            >
              Clear
            </button>
          </div>
          {reportUrl && (
            <div style={{ display: 'flex', gap: 12 }}>
              {reportTxHash && (
                <button
                  onClick={() => router.push(`/tx-report/${reportTxHash}`)}
                  className="btn btn-primary"
                  style={{ fontSize: 14 }}
                >
                  🔗 View On-Chain Report
                </button>
              )}
              <a
                href={reportUrl}
                download={reportFilename}
                className="btn btn-secondary"
                style={{ fontSize: 14, textDecoration: 'none' }}
              >
                📥 Download Report
              </a>
            </div>
          )}
        </div>

        {/* Terminal window */}
        <div
          style={{
            background: '#050505',
            border: '1px solid var(--border-strong)',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow:
              '0 0 50px rgba(255,255,255,0.06), 0 24px 60px rgba(0,0,0,0.5)',
          }}
        >
          {/* Chrome bar */}
          <div
            style={{
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.03)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff4466' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffd60a' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffffff' }} />
            </div>
            <span
              style={{
                marginLeft: 8,
                color: 'var(--text-dim)',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}
            >
              walraxc — sovereign execution mode
            </span>
          </div>

          {/* Terminal body */}
          <div
            style={{
              height: 500,
              overflow: 'auto',
              overflowX: 'hidden',
              padding: '16px 20px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              lineHeight: 1.7,
              color: 'var(--text)',
            }}
          >
            {lines.length === 0 && !analyzing && (
              <div style={{ color: 'var(--text-muted)' }}>
                <div style={{ color: 'var(--cyan)', whiteSpace: 'pre', fontFamily: 'var(--font-mono)' }}>
                  ╔══════════════════════════════════════════════════╗{'\n'}
                  ║    WALRAXC Autonomous Exploit Intelligence Core  ║{'\n'}
                  ║   Deterministic Exploit Execution + Verification ║{'\n'}
                  ╚══════════════════════════════════════════════════╝
                </div>
                <br />
                Paste a Solidity or Move contract above and click <span style={{ color: 'var(--green)' }}>▶ Run Audit</span>
                <br />
                or use the built-in DeFiVault (Solidity) demo.
              </div>
            )}

            {lines.map((line, i) => {
              let color = 'var(--text)';
              let opacity = 1;

              switch (line.type) {
                case 'banner':
                  color = 'var(--cyan)';
                  break;
                case 'progress':
                  color = 'var(--text-muted)';
                  break;
                case 'phase':
                  color = 'var(--cyan)';
                  break;
                case 'explanation':
                  color = '#d4a0ff';
                  break;
                case 'error':
                  color = '#ff4466';
                  break;
                case 'input':
                  color = 'var(--green)';
                  break;
              }

              return (
                <div
                  key={i}
                  style={{
                    color,
                    opacity,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {line.text || '\u00A0'}
                </div>
              );
            })}

            {analyzing && (
              <div style={{ color: 'var(--cyan)', marginTop: 8 }}>
                <span className="blink">▊</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>
      </div>
    </section>
  );
}
