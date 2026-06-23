'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { History, Search, ArrowUpRight, ArrowDownLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { dbService } from '@/services/db';
import { Transaction } from '@/types';

export default function TransactionsPage() {
  const router = useRouter();
  const { user } = useApp();

  const [loading, setLoading] = useState(true);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchTransactions = async () => {
    if (!user) return;
    setRefreshing(true);
    const data = await dbService.getTransactionsByUsernameOrAddress(user.username, 50);
    const parsedData = data.map(t => ({
      ...t,
      amount: typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount
    }));
    setTxs(parsedData);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else {
      fetchTransactions().then(() => setLoading(false));
    }
  }, [user, router]);

  // Filter transactions based on query
  const filteredTxs = txs.filter(t => 
    t.sender.toLowerCase().includes(search.toLowerCase()) ||
    t.receiver.toLowerCase().includes(search.toLowerCase()) ||
    t.hash.toLowerCase().includes(search.toLowerCase())
  );

  if (loading || !user) {
    return (
      <div style={{ padding: '40px', color: 'var(--text-muted)' }}>
        Loading transactions logs...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Page Title & Search Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <History size={20} style={{ color: 'var(--accent)' }} />
          <span>Transaction ledger</span>
        </h1>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={fetchTransactions} 
            className="btn" 
            disabled={refreshing}
            style={{ padding: '8px', display: 'flex', alignItems: 'center' }}
            title="Refresh logs"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search sender, receiver, hash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-input"
              style={{ paddingLeft: '32px', height: '36px', fontSize: '12px' }}
            />
          </div>
        </div>
      </div>

      {/* Transaction Log Ledger */}
      <section className="terminal-window">
        <div className="terminal-header">
          <span>Ledger Logs</span>
          <span>Showing {filteredTxs.length} items</span>
        </div>
        <div className="terminal-body" style={{ padding: 0 }}>
          {filteredTxs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No transactions matching search criteria.
            </div>
          ) : (
            <table className="data-table" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Entity</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxs.map((t) => {
                  const isSent = t.sender.toLowerCase() === `@${user.username.toLowerCase()}`;
                  return (
                    <tr key={t.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: isSent ? 'rgba(217, 119, 6, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: isSent ? 'var(--accent)' : 'var(--success)' }}>
                          {isSent ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                        </div>
                      </td>
                      <td style={{ fontWeight: 'bold' }}>
                        {isSent ? t.receiver : t.sender}
                      </td>
                      <td style={{ color: isSent ? 'var(--foreground)' : 'var(--success)', fontWeight: 'bold' }}>
                        {isSent ? '-' : '+'}{t.amount.toFixed(2)} ARC
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: t.status === 'success' ? 'var(--success)' : 'var(--error)' }}>
                          {t.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <a 
                          href={`https://testnet.arcscan.app/tx/${t.hash}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{ fontFamily: 'monospace', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}
                          className="hover:text-accent"
                        >
                          <span>{t.hash.slice(0, 10)}...</span>
                          <ExternalLink size={10} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
