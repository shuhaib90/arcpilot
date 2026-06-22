'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart2, TrendingUp, TrendingDown, Users, Award, Shield } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { dbService } from '@/services/db';
import { Transaction } from '@/types';

export default function AnalyticsPage() {
  const router = useRouter();
  const { user } = useApp();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSent: 0,
    totalReceived: 0,
    netFlow: 0,
    topPayee: 'None',
    topPayeeAmount: 0,
    biggestPayment: 0,
    biggestPaymentReceiver: 'None',
    sentCount: 0,
    receivedCount: 0,
    weeklySpend: 0,
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else {
      const loadStats = async () => {
        const txs = await dbService.getTransactionsByUsernameOrAddress(user.username, 100);
        
        const sent = txs.filter(t => t.sender.toLowerCase() === `@${user.username.toLowerCase()}`);
        const received = txs.filter(t => t.receiver.toLowerCase() === `@${user.username.toLowerCase()}`);

        const totalSent = sent.reduce((sum, t) => sum + t.amount, 0);
        const totalReceived = received.reduce((sum, t) => sum + t.amount, 0);
        
        // Calculate Top Payee
        const spendMap: Record<string, number> = {};
        sent.forEach(t => {
          spendMap[t.receiver] = (spendMap[t.receiver] || 0) + t.amount;
        });

        let topPayee = 'None';
        let topPayeeAmount = 0;
        Object.entries(spendMap).forEach(([receiver, amount]) => {
          if (amount > topPayeeAmount) {
            topPayeeAmount = amount;
            topPayee = receiver;
          }
        });

        // Calculate Biggest Payment
        let biggestPayment = 0;
        let biggestPaymentReceiver = 'None';
        sent.forEach(t => {
          if (t.amount > biggestPayment) {
            biggestPayment = t.amount;
            biggestPaymentReceiver = t.receiver;
          }
        });

        // Weekly spend (last 7 days)
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const weeklySent = sent.filter(t => new Date(t.created_at) >= sevenDaysAgo);
        const weeklySpend = weeklySent.reduce((sum, t) => sum + t.amount, 0);

        setStats({
          totalSent,
          totalReceived,
          netFlow: totalReceived - totalSent,
          topPayee,
          topPayeeAmount,
          biggestPayment,
          biggestPaymentReceiver,
          sentCount: sent.length,
          receivedCount: received.length,
          weeklySpend
        });
      };

      loadStats().then(() => setLoading(false));
    }
  }, [user, router]);

  if (loading || !user) {
    return (
      <div style={{ padding: '40px', color: 'var(--text-muted)' }}>
        Loading portfolio analytics...
      </div>
    );
  }

  // Calculate percentages for visual bars
  const totalVolume = stats.totalSent + stats.totalReceived;
  const sentPercent = totalVolume > 0 ? (stats.totalSent / totalVolume) * 100 : 0;
  const receivedPercent = totalVolume > 0 ? (stats.totalReceived / totalVolume) * 100 : 0;

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <BarChart2 size={20} style={{ color: 'var(--accent)' }} />
          <span>Wallet Analytics</span>
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Real-time spending insights and network statistics.</p>
      </div>

      {/* Grids showing primary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        
        {/* Weekly Spend */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '16px', backgroundColor: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '8px' }}>
            <span>WEEKLY SPENDING</span>
            <TrendingDown size={14} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent)' }}>
            {stats.weeklySpend.toFixed(2)} ARC
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Spent in last 7 days
          </div>
        </div>

        {/* Top Payee */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '16px', backgroundColor: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '8px' }}>
            <span>TOP PAYEE</span>
            <Users size={14} style={{ color: 'var(--success)' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stats.topPayee}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Total transferred: {stats.topPayeeAmount.toFixed(2)} ARC
          </div>
        </div>

        {/* Biggest Single Payment */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '16px', backgroundColor: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px', marginBottom: '8px' }}>
            <span>LARGEST PAYMENT</span>
            <Award size={14} style={{ color: 'var(--warning)' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--foreground)' }}>
            {stats.biggestPayment.toFixed(2)} ARC
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Sent to {stats.biggestPaymentReceiver}
          </div>
        </div>

      </div>

      {/* Net Volume / Flow Chart */}
      <section className="terminal-window">
        <div className="terminal-header">
          <span>Flow Volume breakdown</span>
          <span>ARC Ledger Flow</span>
        </div>
        <div className="terminal-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Custom CSS Bar Graph */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
              <span style={{ color: 'var(--success)' }}>● RECEIVED ({stats.totalReceived.toFixed(2)} ARC)</span>
              <span style={{ color: 'var(--accent)' }}>● SENT ({stats.totalSent.toFixed(2)} ARC)</span>
            </div>
            
            <div style={{ width: '100%', height: '24px', display: 'flex', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              {totalVolume === 0 ? (
                <div style={{ width: '100%', backgroundColor: 'var(--border)', color: 'var(--text-muted)', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  No volume recorded yet
                </div>
              ) : (
                <>
                  <div style={{ width: `${receivedPercent}%`, backgroundColor: 'var(--success)' }} title={`Received: ${receivedPercent.toFixed(1)}%`}></div>
                  <div style={{ width: `${sentPercent}%`, backgroundColor: 'var(--accent)' }} title={`Sent: ${sentPercent.toFixed(1)}%`}></div>
                </>
              )}
            </div>
          </div>

          {/* Detailed stats grids */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>ACCOUNT BALANCE STATISTICS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Incoming Volume:</span>
                  <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{stats.totalReceived.toFixed(2)} ARC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Outgoing Volume:</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{stats.totalSent.toFixed(2)} ARC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '6px', fontWeight: 'bold' }}>
                  <span>Net Flow:</span>
                  <span style={{ color: stats.netFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>
                    {stats.netFlow >= 0 ? '+' : ''}{stats.netFlow.toFixed(2)} ARC
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>TRANSACTION LOG FREQUENCY</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Received Transfers:</span>
                  <span>{stats.receivedCount} txs</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sent Transfers:</span>
                  <span>{stats.sentCount} txs</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '6px', fontWeight: 'bold' }}>
                  <span>Total Tx Count:</span>
                  <span>{stats.sentCount + stats.receivedCount} txs</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
