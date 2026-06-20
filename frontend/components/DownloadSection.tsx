const PLATFORMS = [
  {
    os: 'Prerequisites',
    sub: 'Node.js 18+ · Rust · pnpm',
    cmd: 'git clone https://github.com/JFKongphop/walraxc',
    alt: 'cd walraxc',
    icon: '📦',
  },
  {
    os: 'Build',
    sub: 'JS CLI + Rust binary · one-time',
    cmd: 'bun run setup',
    alt: 'builds dist/walraxc + prebuilt Rust binary',
    icon: '⚙️',
  },
  {
    os: 'Run',
    sub: 'no .env setup needed',
    cmd: './dist/walraxc run',
    alt: './dist/walraxc run --file MyContract.sol',
    icon: '🚀',
  },
];

export function DownloadSection() {
  return (
    <section className="section" id="download">
      <div className="section-inner">
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div className="section-label">Download</div>
          <h2 className="section-title">Runtime Installation</h2>
          <p
            className="section-desc"
            style={{ margin: '0 auto', textAlign: 'center' }}
          >
            WALRAXC runs locally from the terminal. The frontend is only a replay
            and verification interface — the runtime is the primary product.
          </p>
        </div>

        {/* Platform cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: 20,
            marginBottom: 48,
          }}
        >
          {PLATFORMS.map((p) => (
            <div
              key={p.os}
              className="glass-card"
              style={{ padding: '30px 26px', position: 'relative', overflow: 'hidden' }}
            >
              {/* Top green accent */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background:
                    'linear-gradient(90deg, transparent, var(--cyan), transparent)',
                  borderRadius: '14px 14px 0 0',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                <span style={{ fontSize: 22 }}>{p.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.os}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-dim)',
                      fontFamily: 'var(--font-mono)',
                      marginTop: 2,
                    }}
                  >
                    {p.sub}
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: 'var(--cyan)',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  marginBottom: 8,
                  userSelect: 'all',
                }}
              >
                {p.cmd}
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  padding: '0 2px',
                }}
              >
                or: {p.alt}
              </div>
            </div>
          ))}
        </div>

        {/* Usage snippet */}
        <div
          style={{
            background: '#050505',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px 28px',
            marginBottom: 40,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 16,
            }}
          >
            Quick Start
          </div>
          {[
            { prompt: '$ ', code: 'git clone https://github.com/JFKongphop/walraxc', color: 'var(--text)' },
            { prompt: '$ ', code: 'cd walraxc && bun run setup', color: 'var(--green)' },
            { prompt: '$ ', code: 'bun run audit', color: 'var(--cyan)' },
            { prompt: '$ ', code: './dist/walraxc run', color: 'var(--cyan)' },
            { prompt: '$ ', code: './dist/walraxc run --file MyContract.sol', color: 'var(--cyan)' },
            { prompt: '$ ', code: './dist/walraxc list', color: 'var(--cyan)' },
            { prompt: '$ ', code: './dist/walraxc show <report>', color: 'var(--cyan)' },
          ].map(({ prompt, code, color }, i) => (
            <div key={i} style={{ marginBottom: 8, color: 'var(--text)' }}>
              <span style={{ color: 'var(--cyan)' }}>{prompt}</span>
              <span style={{ color }}>{code}</span>
            </div>
          ))}
        </div>

        {/* Inline contract demo block */}
        <div
          style={{
            background: '#050505',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            marginBottom: 40,
          }}
        >
          {/* Header bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 18px',
              borderBottom: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Traffic-light dots */}
              {['#ff5f57','#febc2e','#28c840'].map((c) => (
                <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
              ))}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  marginLeft: 6,
                }}
              >
                vulnarable::vault — inline audit
              </span>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--cyan)',
                background: 'rgba(255,255,255,0.05)',
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              ⚠ no access control · trapped funds · drain
            </span>
          </div>

          {/* Command line */}
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--cyan)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <span style={{ color: 'var(--text-dim)', marginRight: 6 }}>$</span>
            ./dist/walraxc run <span style={{ color: '#999999' }}>&quot;&lt;contract code&gt;&quot;</span>
          </div>

          {/* Contract source */}
          <div style={{ padding: '18px 22px', overflowX: 'auto' }}>
            <pre
              style={{
                margin: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                lineHeight: 1.7,
                color: 'var(--text)',
              }}
            >
{[
  { t: 'comment',  v: '// VulnerableVault — 2 critical issues in Sui Move' },
  { t: 'kw',       v: 'module ', s: 'name', rest: 'vulnerable::vault {' },
  { t: 'field',    v: '    use sui::coin::{Self, Coin};' },
  { t: 'field',    v: '    use sui::balance::{Self, Balance};' },
  { t: 'blank' },
  { t: 'kw',       v: '    public struct ', s: 'name', rest: 'Vault has key {' },
  { t: 'field',    v: '        id: UID,' },
  { t: 'field',    v: '        admin: address,' },
  { t: 'field',    v: '        fee_percent: u64,' },
  { t: 'plain',    v: '    }' },
  { t: 'blank' },
  { t: 'warn',     v: '    // ❌ 1: No sender check — anyone can withdraw' },
  { t: 'fn',       v: '    public entry fun ', s: 'fn', rest: 'withdraw(' },
  { t: 'plain',    v: '        vault: &mut Vault, amount: u64, ctx: &mut TxContext' },
  { t: 'plain',    v: '    ) {' },
  { t: 'warn',     v: '        // Balance created then dropped — funds trapped' },
  { t: 'plain',    v: '        let bal = balance::zero<SUI>();' },
  { t: 'plain',    v: '        balance::join(&mut bal, balance::create_for_testing(amount));' },
  { t: 'plain',    v: '    }' },
  { t: 'blank' },
  { t: 'warn',     v: '    // ❌ 2: Anyone can drain to any address' },
  { t: 'fn',       v: '    public entry fun ', s: 'fn', rest: 'drain(' },
  { t: 'plain',    v: '        vault: &mut Vault, to: address, _ctx: &mut TxContext' },
  { t: 'plain',    v: '    ) {' },
  { t: 'plain',    v: '        let bal = balance::zero<SUI>();' },
  { t: 'plain',    v: '        balance::join(&mut bal, balance::create_for_testing(1000));' },
  { t: 'plain',    v: '        transfer::public_transfer(coin::from_balance(bal, _ctx), to);' },
  { t: 'plain',    v: '    }' },
  { t: 'plain',    v: '}' },
].map((line, i) => {
  if (line.t === 'blank') return <span key={i}>{'\n'}</span>;
  if (line.t === 'comment') return <span key={i} style={{ color: 'var(--text-muted)' }}>{line.v}{'\n'}</span>;
  if (line.t === 'warn')    return <span key={i} style={{ color: '#ff4466' }}>{line.v}{'\n'}</span>;
  if (line.t === 'kw')      return <span key={i}><span style={{ color: 'var(--cyan)' }}>{line.v}</span><span style={{ color: 'var(--green)' }}>{line.rest}</span>{'\n'}</span>;
  if (line.t === 'fn')      return <span key={i}><span style={{ color: 'var(--cyan)' }}>{line.v}</span><span style={{ color: '#d4a0ff' }}>{line.rest}</span>{'\n'}</span>;
  if (line.t === 'field')   return <span key={i}><span style={{ color: 'var(--text-dim)' }}>{line.v}</span><span style={{ color: 'var(--text)' }}>{line.rest}</span>{'\n'}</span>;
  return <span key={i} style={{ color: 'var(--text)' }}>{line.v}{line.rest ?? ''}{'\n'}</span>;
})}
            </pre>
          </div>
        </div>

        {/* CTA buttons */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <a
            href="https://github.com/JFKongphop/walraxc"
            className="btn btn-primary"
            style={{ fontSize: 15, padding: '13px 30px' }}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub ↗
          </a>
          <a
            href="https://github.com/JFKongphop/walraxc/blob/main/README.md"
            className="btn btn-secondary"
            style={{ fontSize: 15, padding: '13px 30px' }}
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </div>
    </section>
  );
}
