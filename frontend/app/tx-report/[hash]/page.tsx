'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs';

export default function WalrusBlobPage() {
  const router = useRouter();
  const params = useParams<{ hash: string }>();
  const blobId = params.hash;

  const [report, setReport] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${WALRUS_AGGREGATOR}/${encodeURIComponent(blobId)}`);
        if (!res.ok) throw new Error(`Blob ${res.status}`);
        const text = await res.text();

        try {
          const json = JSON.parse(text);
          setMeta(json);
        } catch {
          setReport(text);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [blobId]);

  const isSummary = meta && !report;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Top nav bar */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 20 }}>
        <button
          onClick={() => router.push('/#audits')}
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text)', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11 }}
        >
          &#8592; Back
        </button>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
          Walrus · Audit Report
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 32px 80px' }}>
        {/* Header card */}
        <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--cyan)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
            On-Chain Audit Report
          </div>

          {loading && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>
              Loading from Walrus…
            </div>
          )}

          {error && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--yellow)' }}>
              ⚠ Could not read blob from Walrus.
            </div>
          )}

          {!loading && !error && isSummary && (
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <a
                href={`https://walruscan.com/testnet/blob/${blobId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', flexDirection: 'column', gap: 8, textDecoration: 'none', color: 'inherit', flex: 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-dim)' }}>{meta.contract_name || 'Unknown'}</span>
                  <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: meta.risk_level === 'Critical' ? 'var(--red)' : 'var(--yellow)' }}>{meta.risk_level || '?'}</span>
                  <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green)' }}>{meta.confidence ?? '?'}%</span>
                  <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                    {meta.audited_at ? new Date(meta.audited_at).toLocaleString() : '?'}
                  </span>
                </div>
                <div className="hash" style={{ fontSize: 12, wordBreak: 'break-all' }}>{blobId}</div>
              </a>
              <a
                href={`${WALRUS_AGGREGATOR}/${encodeURIComponent(blobId)}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Raw blob on Walrus aggregator"
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', border: '1px solid var(--cyan)',
                  borderRadius: 6, textDecoration: 'none', color: 'var(--cyan)',
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                }}
              >
                Aggregator ↗
              </a>
            </div>
          )}

          {!loading && !error && !isSummary && report && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <a
                href={`https://walruscan.com/testnet/blob/${blobId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="hash" style={{ fontSize: 12, wordBreak: 'break-all' }}>{blobId}</div>
              </a>
              <a
                href={`${WALRUS_AGGREGATOR}/${encodeURIComponent(blobId)}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Raw blob on Walrus aggregator"
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', border: '1px solid var(--cyan)',
                  borderRadius: 6, textDecoration: 'none', color: 'var(--cyan)',
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                }}
              >
                Aggregator ↗
              </a>
            </div>
          )}
        </div>

        {/* Session summary — metadata card + View Full Report */}
        {isSummary && (
          <div className="glass-card" style={{ padding: 32, marginBottom: 32 }}>
            <h2 style={{ marginTop: 0, marginBottom: 20 }}>{meta.contract_name || 'Unknown Contract'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ color: 'var(--text-dim)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Vulnerability</label>
                <p style={{ fontSize: 18, fontWeight: 700 }}>{meta.vulnerability_type || '?'}</p>
              </div>
              <div>
                <label style={{ color: 'var(--text-dim)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Risk Level</label>
                <p style={{ fontSize: 18, fontWeight: 700, color: meta.risk_level === 'Critical' ? 'var(--red)' : 'var(--orange)' }}>
                  {meta.risk_level || '?'}
                </p>
              </div>
              <div>
                <label style={{ color: 'var(--text-dim)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Confidence</label>
                <p style={{ fontSize: 18, fontWeight: 700 }}>{meta.confidence ?? '?'}%</p>
              </div>
              <div>
                <label style={{ color: 'var(--text-dim)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Audited</label>
                <p style={{ fontSize: 14 }}>{meta.audited_at ? new Date(meta.audited_at).toLocaleString() : '?'}</p>
              </div>
            </div>
            {meta.explanation && (
              <p style={{ marginTop: 20, color: 'var(--text-dim)', lineHeight: 1.6 }}>{meta.explanation}</p>
            )}
            {meta.report_blob_id ? (
              <a
                href={`/tx-report/${meta.report_blob_id}`}
                style={{
                  display: 'inline-block', marginTop: 20, padding: '10px 20px',
                  background: 'var(--cyan)', color: '#000', borderRadius: 6,
                  fontWeight: 700, textDecoration: 'none', fontSize: 14,
                }}
              >
                📄 View Full Audit Report →
              </a>
            ) : (
              <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
                📋 Session summary — report blob not yet linked.
              </p>
            )}
          </div>
        )}

        {/* Full markdown report */}
        {report && (
          <div className="report-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
          </div>
        )}
      </div>
    </main>
  );
}