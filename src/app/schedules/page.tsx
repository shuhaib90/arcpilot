'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { dbService } from '@/services/db';
import { ScheduledPayment } from '@/types';
import { Calendar, Plus, Pause, Play, XCircle, ArrowRight, Clock, AlertTriangle } from 'lucide-react';
import { ethers } from 'ethers';

export default function SchedulesPage() {
  const { user } = useApp();
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [recipientInput, setRecipientInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [frequencyInput, setFrequencyInput] = useState<'daily' | 'weekly' | 'monthly' | 'once'>('weekly');
  const [startDateInput, setStartDateInput] = useState('');
  
  const [formStatus, setFormStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const loadSchedules = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await dbService.getScheduledPaymentsByUserId(user.id);
      setPayments(data);
    } catch (e) {
      console.error('Failed loading scheduled payments', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSchedules();
  }, [user]);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !recipientInput.trim() || !amountInput) return;

    setFormStatus({ message: 'Registering schedule...' });
    try {
      const amountNum = parseFloat(amountInput);
      if (isNaN(amountNum) || amountNum <= 0) {
        setFormStatus({ success: false, message: 'Invalid payment amount.' });
        return;
      }

      // Resolve recipient
      let recipientAddress = recipientInput.trim();
      let displayRecipient = recipientAddress;
      if (recipientAddress.startsWith('@') || !recipientAddress.startsWith('0x')) {
        const cleanName = recipientAddress.startsWith('@') ? recipientAddress.slice(1) : recipientAddress;
        const targetUser = await dbService.getUserByUsername(cleanName);
        if (targetUser) {
          recipientAddress = targetUser.wallet_address;
          displayRecipient = '@' + cleanName;
        } else {
          // Check contacts list
          const contacts = await dbService.getContactsByUserId(user.id);
          const contact = contacts.find(c => c.contact_username.toLowerCase() === cleanName.toLowerCase());
          if (contact) {
            recipientAddress = contact.contact_address;
            displayRecipient = '@' + cleanName;
          } else {
            setFormStatus({ success: false, message: `Recipient username @${cleanName} not found.` });
            return;
          }
        }
      }

      if (!ethers.isAddress(recipientAddress)) {
        setFormStatus({ success: false, message: 'Invalid recipient wallet address.' });
        return;
      }

      const startIso = startDateInput ? new Date(startDateInput).toISOString() : new Date().toISOString();

      await dbService.createScheduledPayment({
        user_id: user.id,
        recipient: recipientAddress,
        recipient_username: displayRecipient,
        amount: amountNum,
        frequency: frequencyInput,
        status: 'active',
        next_execution: startIso
      });

      setFormStatus({ success: true, message: `Successfully scheduled recurring transfer to ${displayRecipient}!` });
      setRecipientInput('');
      setAmountInput('');
      setStartDateInput('');
      await loadSchedules();
    } catch (err: any) {
      setFormStatus({ success: false, message: err.message || 'Failed to create schedule.' });
    }
  };

  const handleUpdateStatus = async (paymentId: string, action: 'pause' | 'resume' | 'cancel') => {
    const statusMap: Record<string, 'paused' | 'active' | 'cancelled'> = {
      pause: 'paused',
      resume: 'active',
      cancel: 'cancelled'
    };
    
    try {
      const updated = await dbService.updateScheduledPaymentStatus(paymentId, statusMap[action]);
      if (updated) {
        await loadSchedules();
      } else {
        alert('Failed to update scheduled payment status.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!user) {
    return (
      <div style={{ padding: '24px', fontFamily: 'monospace' }}>
        <p style={{ color: 'var(--error)' }}>Error: Connection console required. Please login first.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Title Header */}
      <div className="terminal-window" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Calendar size={24} style={{ color: 'var(--accent)' }} />
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold' }}>Recurring Transfer Schedules</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Automate salary payouts, allowance grants, and scheduled deposits. Checked automatically in the background.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px', alignItems: 'start' }}>
        
        {/* Left: Active Schedules List */}
        <div className="terminal-window" style={{ minHeight: '400px' }}>
          <div className="terminal-header">
            <span>ACTIVE AUTOMATION RUNNERS ({payments.filter(p => p.status === 'active').length} active)</span>
          </div>
          <div className="terminal-body" style={{ padding: '16px' }}>
            {loading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading payment schedules...</div>
            ) : payments.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                No scheduled payments found. Create one using the form on the right, or ask ArcPilot e.g. "Schedule 2 ARC to Bob every Monday".
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {payments.map(payment => (
                  <div 
                    key={payment.id} 
                    style={{ 
                      border: '1px solid var(--border)', 
                      borderRadius: '4px', 
                      backgroundColor: 'var(--surface-muted)',
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    {/* Details */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent)' }}>
                          {payment.amount} ARC
                        </span>
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '3px', backgroundColor: 'var(--surface)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          {payment.frequency}
                        </span>
                        <span style={{ 
                          fontSize: '11px', 
                          color: payment.status === 'active' ? 'var(--success)' : payment.status === 'paused' ? 'var(--warning)' : 'var(--text-muted)', 
                          fontWeight: 'bold' 
                        }}>
                          ● {payment.status}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '12px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>To:</span>
                        <span style={{ fontWeight: 'bold' }}>{payment.recipient_username || payment.recipient}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ({payment.recipient.slice(0, 6)}...{payment.recipient.slice(-4)})
                        </span>
                      </div>

                      {payment.next_execution && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={10} />
                          <span>Next Run: {new Date(payment.next_execution).toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {payment.status === 'active' && (
                        <button 
                          onClick={() => handleUpdateStatus(payment.id, 'pause')} 
                          className="btn" 
                          style={{ padding: '6px 10px', fontSize: '11px' }}
                        >
                          <Pause size={10} />
                          <span>Pause</span>
                        </button>
                      )}
                      {payment.status === 'paused' && (
                        <button 
                          onClick={() => handleUpdateStatus(payment.id, 'resume')} 
                          className="btn btn-primary" 
                          style={{ padding: '6px 10px', fontSize: '11px' }}
                        >
                          <Play size={10} />
                          <span>Resume</span>
                        </button>
                      )}
                      {(payment.status === 'active' || payment.status === 'paused') && (
                        <button 
                          onClick={() => handleUpdateStatus(payment.id, 'cancel')} 
                          className="btn" 
                          style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--error)' }}
                        >
                          <XCircle size={10} />
                          <span>Cancel</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Add Schedule Form */}
        <div className="terminal-window">
          <div className="terminal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={14} />
              <span>NEW AUTOMATION TASK</span>
            </div>
          </div>
          <div className="terminal-body">
            <form onSubmit={handleCreateSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>RECIPIENT USERNAME OR ADDRESS</label>
                <input
                  type="text"
                  placeholder="@username or 0x..."
                  className="text-input"
                  value={recipientInput}
                  onChange={e => setRecipientInput(e.target.value)}
                  style={{ fontSize: '12px', padding: '8px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>TRANSFER AMOUNT (ARC)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className="text-input"
                  value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                  style={{ fontSize: '12px', padding: '8px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>FREQUENCY INTERVAL</label>
                <select
                  className="text-input"
                  value={frequencyInput}
                  onChange={e => setFrequencyInput(e.target.value as any)}
                  style={{ fontSize: '12px', padding: '8px' }}
                  required
                >
                  <option value="once">Execute Once (Delayed)</option>
                  <option value="daily">Daily Recurring</option>
                  <option value="weekly">Weekly Recurring</option>
                  <option value="monthly">Monthly Recurring</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>START DATE & TIME (OPTIONAL)</label>
                <input
                  type="datetime-local"
                  className="text-input"
                  value={startDateInput}
                  onChange={e => setStartDateInput(e.target.value)}
                  style={{ fontSize: '12px', padding: '8px' }}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Leave empty to execute the first transfer immediately.
                </span>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '8px', fontSize: '12px', marginTop: '6px' }}>
                Activate Schedule Runner
              </button>
            </form>
            {formStatus && (
              <div style={{ marginTop: '12px', fontSize: '11px', color: formStatus.success ? 'var(--success)' : formStatus.success === false ? 'var(--error)' : 'var(--text-muted)' }}>
                {formStatus.message}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
