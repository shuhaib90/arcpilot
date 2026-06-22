'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Shield, ShieldAlert, Key, Plus, X, Check, Save } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { safetyService, SafetySettings } from '@/services/safety';
import { walletService } from '@/services/wallet';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useApp();

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SafetySettings>({
    dailyLimit: 100,
    highValueThreshold: 20,
    whitelist: [],
    blacklist: [],
  });

  const [newWhitelistItem, setNewWhitelistItem] = useState('');
  const [newBlacklistItem, setNewBlacklistItem] = useState('');

  const [exportedKey, setExportedKey] = useState('');
  const [showKeyConfirm, setShowKeyConfirm] = useState(false);
  const [exportingKey, setExportingKey] = useState(false);

  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else {
      const data = safetyService.getSettings();
      setSettings(data);
      setLoading(false);
    }
  }, [user, router]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    safetyService.updateSettings(settings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleAddWhitelist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhitelistItem.trim()) return;

    let item = newWhitelistItem.trim();
    if (!item.startsWith('@') && !item.startsWith('0x')) {
      item = '@' + item;
    }

    if (!settings.whitelist.includes(item)) {
      setSettings(prev => ({
        ...prev,
        whitelist: [...prev.whitelist, item]
      }));
    }
    setNewWhitelistItem('');
  };

  const handleRemoveWhitelist = (index: number) => {
    setSettings(prev => ({
      ...prev,
      whitelist: prev.whitelist.filter((_, i) => i !== index)
    }));
  };

  const handleAddBlacklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlacklistItem.trim()) return;

    const item = newBlacklistItem.trim();
    if (!settings.blacklist.includes(item)) {
      setSettings(prev => ({
        ...prev,
        blacklist: [...prev.blacklist, item]
      }));
    }
    setNewBlacklistItem('');
  };

  const handleRemoveBlacklist = (index: number) => {
    setSettings(prev => ({
      ...prev,
      blacklist: prev.blacklist.filter((_, i) => i !== index)
    }));
  };

  const handleExportPrivateKey = async () => {
    if (!user) return;
    setExportingKey(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const walletInfo = await walletService.createEmbeddedWallet(user.recovery_wallet);
    setExportedKey(atob(walletInfo.encryptedPrivateKey));
    setExportingKey(false);
    setShowKeyConfirm(false);
  };

  if (loading || !user) {
    return (
      <div style={{ padding: '40px', color: 'var(--text-muted)' }}>
        Loading safety configurations...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <Settings size={20} style={{ color: 'var(--accent)' }} />
            <span>Safety Controls & Settings</span>
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manage daily limits, whitelists, and key recovery.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        
        {/* Safety Limits Form */}
        <section className="terminal-window" style={{ height: 'fit-content' }}>
          <div className="terminal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={14} style={{ color: 'var(--accent)' }} />
              <span>Limits & Thresholds</span>
            </div>
          </div>
          <div className="terminal-body">
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Daily Spending Limit (ARC):</label>
                <input 
                  type="number"
                  value={settings.dailyLimit}
                  onChange={(e) => setSettings(prev => ({ ...prev, dailyLimit: parseFloat(e.target.value) || 0 }))}
                  className="text-input"
                  style={{ marginTop: '6px' }}
                  required
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Maximum cumulative volume allowed within a rolling 24-hour period.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>High-Value Trigger Threshold (ARC):</label>
                <input 
                  type="number"
                  value={settings.highValueThreshold}
                  onChange={(e) => setSettings(prev => ({ ...prev, highValueThreshold: parseFloat(e.target.value) || 0 }))}
                  className="text-input"
                  style={{ marginTop: '6px' }}
                  required
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Transactions above this amount require manual click approval.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', gap: '8px' }}>
                  <Save size={16} />
                  <span>Save Safety Rules</span>
                </button>
                {saveSuccess && (
                  <span style={{ color: 'var(--success)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} />
                    <span>Saved!</span>
                  </span>
                )}
              </div>

            </form>
          </div>
        </section>

        {/* Security Whitelists / Blacklists */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Whitelist Panel */}
          <section className="terminal-window">
            <div className="terminal-header">
              <span>Trusted Whitelist</span>
              <span style={{ fontSize: '11px', color: 'var(--success)' }}>Bypasses High-Value Guard</span>
            </div>
            <div className="terminal-body">
              <form onSubmit={handleAddWhitelist} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input 
                  type="text" 
                  placeholder="Add @username or 0xAddress..."
                  value={newWhitelistItem}
                  onChange={(e) => setNewWhitelistItem(e.target.value)}
                  className="text-input"
                  style={{ height: '36px', fontSize: '12px' }}
                />
                <button type="submit" className="btn" style={{ padding: '0 12px', height: '36px' }}>
                  <Plus size={16} />
                </button>
              </form>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {settings.whitelist.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Whitelist is empty.</span>
                ) : (
                  settings.whitelist.map((w, index) => (
                    <span 
                      key={w} 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '4px 8px', 
                        backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                        border: '1px solid rgba(16, 185, 129, 0.3)', 
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: 'var(--success)'
                      }}
                    >
                      <span>{w}</span>
                      <X 
                        size={12} 
                        style={{ cursor: 'pointer' }} 
                        onClick={() => handleRemoveWhitelist(index)} 
                      />
                    </span>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Blacklist Panel */}
          <section className="terminal-window">
            <div className="terminal-header">
              <span>Blocked Blacklist</span>
              <span style={{ fontSize: '11px', color: 'var(--error)' }}>Blocked Transactor Checks</span>
            </div>
            <div className="terminal-body">
              <form onSubmit={handleAddBlacklist} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input 
                  type="text" 
                  placeholder="Block 0xAddress..."
                  value={newBlacklistItem}
                  onChange={(e) => setNewBlacklistItem(e.target.value)}
                  className="text-input"
                  style={{ height: '36px', fontSize: '12px' }}
                />
                <button type="submit" className="btn" style={{ padding: '0 12px', height: '36px' }}>
                  <Plus size={16} />
                </button>
              </form>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {settings.blacklist.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Blacklist is empty.</span>
                ) : (
                  settings.blacklist.map((b, index) => (
                    <span 
                      key={b} 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '4px 8px', 
                        backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                        border: '1px solid rgba(239, 68, 68, 0.3)', 
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: 'var(--error)'
                      }}
                    >
                      <span title={b}>{b.slice(0, 10)}...</span>
                      <X 
                        size={12} 
                        style={{ cursor: 'pointer' }} 
                        onClick={() => handleRemoveBlacklist(index)} 
                      />
                    </span>
                  ))
                )}
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Backup and Recovery Export Key Panel */}
      <section className="terminal-window">
        <div className="terminal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={14} style={{ color: 'var(--warning)' }} />
            <span>Export Embedded Wallet Private Key</span>
          </div>
        </div>
        <div className="terminal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '12px', backgroundColor: 'var(--surface-muted)', fontSize: '12px', display: 'flex', gap: '10px' }}>
            <ShieldAlert size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <span style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Warning: Exposing your private key allows anyone full access to your funds on the Arc L1 blockchain. Never share this key with anyone, including the AI assistant.
            </span>
          </div>

          {!exportedKey ? (
            <div>
              {!showKeyConfirm ? (
                <button 
                  onClick={() => setShowKeyConfirm(true)} 
                  className="btn"
                  style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
                >
                  Reveal Private Key
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Are you absolutely sure you want to reveal the key?</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={handleExportPrivateKey} 
                      disabled={exportingKey}
                      className="btn btn-primary"
                      style={{ backgroundColor: 'var(--error)', borderColor: 'var(--error)' }}
                    >
                      {exportingKey ? 'Decrypting Key...' : 'Yes, Reveal Key'}
                    </button>
                    <button 
                      onClick={() => setShowKeyConfirm(false)} 
                      disabled={exportingKey}
                      className="btn"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Decrypted Private Key (EVM Format):</span>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', backgroundColor: 'var(--surface-muted)', padding: '12px', borderRadius: '4px', border: '1px solid var(--error)', color: 'var(--error)' }}>
                {exportedKey}
              </div>
              <button 
                onClick={() => setExportedKey('')} 
                className="btn"
                style={{ width: 'fit-content', marginTop: '4px' }}
              >
                Hide Private Key
              </button>
            </div>
          )}

        </div>
      </section>

    </div>
  );
}
