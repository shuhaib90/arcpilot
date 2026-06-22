'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Loader2,
  Cpu
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useWallet } from '@/hooks/useWallet';

export default function WalletPage() {
  const router = useRouter();
  const { user } = useApp();
  const { wallet, deposit, withdraw } = useWallet();

  const [pageLoading, setPageLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState('10');
  const [depositing, setDepositing] = useState(false);

  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else {
      setPageLoading(false);
      setWithdrawAddress(user.recovery_wallet);
    }
  }, [user, router]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet || depositing) return;

    setDepositing(true);
    const amount = parseFloat(depositAmount);
    await deposit(amount);
    setDepositing(false);
    setDepositAmount('10');
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet || withdrawing) return;

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Invalid withdrawal amount.');
      return;
    }

    setWithdrawing(true);
    const result = await withdraw(withdrawAddress, amount);
    if (!result.success) {
      alert(`Withdrawal failed: ${result.error || 'Transaction execution failed.'}`);
    } else {
      alert('Withdrawal transaction executed successfully on Arc Testnet!');
    }
    setWithdrawing(false);
    setWithdrawAmount('');
  };

  if (pageLoading || !user || !wallet) {
    return (
      <div style={{ padding: '40px', color: 'var(--text-muted)' }}>
        Loading wallet profile...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Wallet Balance Header */}
      <section className="terminal-window">
        <div className="terminal-header">
          <span>Active Wallet Account</span>
          <span style={{ color: 'var(--accent)' }}>Arc Testnet (ID 5042002)</span>
        </div>
        <div className="terminal-body" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>CURRENT BALANCE</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--accent)' }}>
              {wallet.balance.toFixed(2)} ARC
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              USDC-pegged network asset
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '240px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Embedded Wallet:</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--foreground)' }} title={user.wallet_address}>
                {user.wallet_address.slice(0, 10)}...{user.wallet_address.slice(-6)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Recovery Wallet:</span>
              <span style={{ fontFamily: 'monospace' }} title={user.recovery_wallet}>
                {user.recovery_wallet.slice(0, 10)}...{user.recovery_wallet.slice(-6)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Account Name:</span>
              <span style={{ fontWeight: 'bold' }}>@{user.username}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Deposit and Withdrawal Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* Deposit Panel */}
        <section className="terminal-window">
          <div className="terminal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowDownLeft size={14} style={{ color: 'var(--success)' }} />
              <span>Deposit ARC (Simulated Faucet)</span>
            </div>
          </div>
          <div className="terminal-body">
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.4 }}>
              Mint testnet ARC tokens directly to your embedded wallet to fund quick execution balances.
            </p>
            <form onSubmit={handleDeposit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Amount to Deposit:</label>
                <select 
                  value={depositAmount} 
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="text-input"
                  style={{ cursor: 'pointer', marginTop: '4px' }}
                >
                  <option value="10">10 ARC</option>
                  <option value="50">50 ARC</option>
                  <option value="100">100 ARC</option>
                </select>
              </div>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={depositing}
                style={{ height: '38px', fontWeight: 'bold' }}
              >
                {depositing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Minting ARC...</span>
                  </>
                ) : (
                  <span>Deposit Funds</span>
                )}
              </button>
            </form>
          </div>
        </section>

        {/* Withdrawal Panel */}
        <section className="terminal-window">
          <div className="terminal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowUpRight size={14} style={{ color: 'var(--accent)' }} />
              <span>Withdraw to External Wallet</span>
            </div>
          </div>
          <div className="terminal-body">
            <form onSubmit={handleWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Recipient Address:</label>
                <input 
                  type="text"
                  placeholder="0xAddress..."
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  className="text-input"
                  style={{ marginTop: '4px', fontSize: '11px', fontFamily: 'monospace' }}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Amount to Withdraw:</label>
                <input 
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  max={wallet.balance}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="text-input"
                  style={{ marginTop: '4px' }}
                  required
                />
              </div>
              <button 
                type="submit" 
                className="btn"
                disabled={withdrawing || !withdrawAmount}
                style={{ height: '38px', fontWeight: 'bold' }}
              >
                {withdrawing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Processing withdrawal...</span>
                  </>
                ) : (
                  <span>Withdraw Funds</span>
                )}
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Account Abstraction Architecture Upgrades Panel */}
      <section className="terminal-window">
        <div className="terminal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={14} style={{ color: 'var(--accent)' }} />
            <span>Smart Account Upgrades (Account Abstraction)</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--success)' }}>EIP-7702 Hybrid Mode</span>
        </div>
        <div className="terminal-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          
          <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'var(--surface-muted)' }}>
            <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
              <span style={{ fontWeight: 'bold' }}>Session Keys</span>
              <span style={{ color: 'var(--success)', fontSize: '10px' }}>ACTIVE</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Delegates permissions for transfers below 20 ARC without prompting. Revocable automatically after 24h.
            </p>
          </div>

          <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'var(--surface-muted)' }}>
            <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
              <span style={{ fontWeight: 'bold' }}>Delegated Execution</span>
              <span style={{ color: 'var(--success)', fontSize: '10px' }}>ENABLED</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Authorized relayer contracts submit user transfers directly to the Arc L1 network, executing transactions invisibly.
            </p>
          </div>

          <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'var(--surface-muted)' }}>
            <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
              <span style={{ fontWeight: 'bold' }}>Gas Sponsorship</span>
              <span style={{ color: 'var(--success)', fontSize: '10px' }}>SPONSORED</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Standard transactions are sponsored by ArcPilot paymasters. Fees are absorbed by the system for native users.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
