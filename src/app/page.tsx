'use client';

import React from 'react';
import Link from 'next/link';
import { Terminal, ArrowRight, Shield, Zap, Sparkles } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export default function LandingPage() {
  const { user } = useApp();

  return (
    <div style={{ maxWidth: '800px', margin: '80px auto', padding: '0 24px' }}>
      {/* Hero Header */}
      <header style={{ textAlign: 'center', marginBottom: '60px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 'bold', fontSize: '14px', letterSpacing: '2px', marginBottom: '16px', textTransform: 'uppercase' }}>
          <Sparkles size={16} />
          <span>Next-Gen Crypto Interface</span>
        </div>
        <h1 style={{ fontSize: '48px', fontWeight: 'bold', letterSpacing: '-1px', marginBottom: '20px', lineHeight: 1.1 }}>
          Your AI Co-Pilot For Arc
        </h1>
        <p style={{ fontSize: '18px', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
          Send payments, manage assets, and control your crypto using natural language.
        </p>
      </header>

      {/* Interactive Mock Terminal */}
      <section className="terminal-window" style={{ marginBottom: '60px' }}>
        <div className="terminal-header">
          <div className="terminal-dots">
            <span className="terminal-dot red"></span>
            <span className="terminal-dot yellow"></span>
            <span className="terminal-dot green"></span>
          </div>
          <span>arcpilot --interactive</span>
          <span style={{ fontSize: '10px' }}>v0.1.0-beta</span>
        </div>
        <div className="terminal-body" style={{ minHeight: '260px', fontFamily: 'monospace' }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
            ArcPilot AI wallet system initialized. Connected to chain ID 5042002 (Arc Testnet).
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <span style={{ color: 'var(--accent)', marginRight: '8px' }}>&gt;</span>
            <span>Send 5 ARC to @alice</span>
            <div style={{ paddingLeft: '16px', marginTop: '4px', color: 'var(--text-muted)' }}>
              Parsing intent... Found recipient: <span style={{ color: 'var(--foreground)' }}>@alice</span> (0x3c44...3bc) | Amount: <span style={{ color: 'var(--foreground)' }}>5.00 ARC</span>
            </div>
            <div style={{ paddingLeft: '16px', color: 'var(--success)' }}>
              ✓ Transaction simulated. Safety validation checks passed.
            </div>
            <div style={{ paddingLeft: '16px', color: 'var(--text-muted)' }}>
              Tx Hash: <span style={{ color: 'var(--accent-muted)' }}>0xa2f10b28ec81987d60cb4628...</span>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <span style={{ color: 'var(--accent)', marginRight: '8px' }}>&gt;</span>
            <span>Show my wallet balance</span>
            <div style={{ paddingLeft: '16px', marginTop: '4px', color: 'var(--text-muted)' }}>
              Querying embedded wallet balances...
            </div>
            <div style={{ paddingLeft: '16px', fontWeight: 'bold' }}>
              Balance: 95.00 ARC (USDC gas-equivalent)
            </div>
          </div>

          <div>
            <span style={{ color: 'var(--accent)', marginRight: '8px' }}>&gt;</span>
            <span>Summarize my spending this month</span>
            <div style={{ paddingLeft: '16px', marginTop: '4px', color: 'var(--text-muted)' }}>
              * Total Spent: 32.50 ARC (6 transfers)
            </div>
            <div style={{ paddingLeft: '16px', color: 'var(--text-muted)' }}>
              * Top Payee: @bob (18.00 ARC)
            </div>
          </div>
        </div>
      </section>

      {/* Call to Actions */}
      <div style={{ textAlign: 'center', marginBottom: '60px' }}>
        <Link href={user ? '/chat' : '/login'} className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '16px', fontWeight: 'bold' }}>
          <span>{user ? 'Enter Console Chat' : 'Connect Wallet & Get Started'}</span>
          <ArrowRight size={18} />
        </Link>
      </div>

      {/* Feature Grids */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', borderTop: '1px solid var(--border)', paddingTop: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
            <Terminal size={18} />
            <span>AI Command Engine</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5 }}>
            No more copying hex addresses. Type transactions like chat messages. The engine parses parameters and resolves usernames natively.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
            <Shield size={18} />
            <span>AI Safety Layer</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5 }}>
            Rest assured with daily spending limits, whitelisted usernames, and instant transaction previews. Large transactions require explicit verification.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
            <Zap size={18} />
            <span>Embedded Speed</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5 }}>
            Keep assets in your dedicated embedded wallet for gas-optimized, near-instant transaction processing, secure recovery, and Account Abstraction upgrades.
          </p>
        </div>
      </section>
    </div>
  );
}
