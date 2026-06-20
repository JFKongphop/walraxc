'use client';

import { useEffect, useState } from 'react';
import { fetchChainStats, ChainStats } from '@/lib/contracts';

export function HeroSection() {
  const [chain, setChain] = useState<ChainStats | null>(null);

  useEffect(() => {
    fetchChainStats().then(setChain).catch(() => {});
  }, []);

  const audits  = chain?.online ? chain.auditsCompleted : 3;
  const agentMemory = chain?.online ? chain.agentMemory  : 0;

  return (
    <section
      className="section"
      style={{
        paddingTop: 160,
        paddingBottom: 130,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient glow behind hero text */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 900,
          height: 500,
          background:
            'radial-gradient(ellipse, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.03) 40%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div className="section-inner" style={{ position: 'relative', zIndex: 1 }}>
        {/* Pill label */}
        <div style={{ display: 'inline-block', marginBottom: 28 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.16em',
              color: 'var(--cyan)',
              textTransform: 'uppercase',
              border: '1px solid rgba(255,255,255,0.20)',
              borderRadius: 100,
              padding: '5px 18px',
              background: 'rgba(255,255,255,0.04)',
              display: 'inline-block',
            }}
          >
            Autonomous Security Cognition — On Sui
          </span>
        </div>

        {/* Logotype */}
        <h1
          style={{
            fontSize: 'clamp(64px, 10vw, 112px)',
            fontWeight: 900,
            lineHeight: 0.92,
            letterSpacing: '-0.045em',
            marginBottom: 32,
          }}
        >
          WALRAXC
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: 'clamp(17px, 2.2vw, 22px)',
            color: 'var(--text-muted)',
            maxWidth: 800,
            margin: '0 auto 14px',
            lineHeight: 1.55,
            whiteSpace: 'nowrap',
          }}
        >
          Autonomous AI Security Agent for Smart Contract Auditing.
          <br />
          Persistent audit memory that learns from every analysis and improves future audits.
        </p>

        {/* Stack line */}
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'white',
            letterSpacing: '0.06em',
            marginBottom: 48,
          }}
        >
          Walrus · MemWal · AI SDK · Sui
        </p>

        {/* CTAs */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <a
            href="#download"
            className="btn btn-primary"
            style={{ fontSize: 15, padding: '13px 30px' }}
          >
            Download Runtime ↓
          </a>
          <a
            href="#audits"
            className="btn btn-secondary"
            style={{ fontSize: 15, padding: '13px 30px' }}
          >
            View Audit Explorer
          </a>
          <a
            href="https://github.com/JFKongphop/walraxc"
            className="btn btn-ghost"
            style={{ fontSize: 15, padding: '13px 30px' }}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub ↗
          </a>
        </div>

        {/* Bottom status indicator */}
        <div
          style={{
            marginTop: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          {[
            { dot: '#ffffff', label: `${audits} audit${audits !== 1 ? 's' : ''} persisted` },
            { dot: 'var(--cyan)', label: '14 memories loaded' },
            { dot: '#ffd60a', label: agentMemory > 0 ? `Move Agent NFT · ${agentMemory} updates` : 'Move Agent NFT · live' },
          ].map(({ dot, label }) => (
            <div
              key={label}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: dot,
                  boxShadow: `0 0 8px ${dot}`,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
