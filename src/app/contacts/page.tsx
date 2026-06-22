'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { dbService } from '@/services/db';
import { Contact } from '@/types';
import { BookOpen, Plus, Trash2, UserPlus, Tag, User } from 'lucide-react';
import { ethers } from 'ethers';

export default function ContactsPage() {
  const { user } = useApp();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [usernameInput, setUsernameInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [groupInput, setGroupInput] = useState('');
  
  const [formStatus, setFormStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const loadContacts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await dbService.getContactsByUserId(user.id);
      setContacts(data);
    } catch (e) {
      console.error('Failed to load contacts', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadContacts();
  }, [user]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !usernameInput.trim() || !addressInput.trim()) return;

    setFormStatus({ message: 'Saving contact...' });
    try {
      const cleanUsername = usernameInput.trim().startsWith('@') 
        ? usernameInput.trim().slice(1) 
        : usernameInput.trim();
        
      const cleanAddress = addressInput.trim().toLowerCase();
      
      if (!ethers.isAddress(cleanAddress)) {
        setFormStatus({ success: false, message: 'Invalid Ethereum/EVM wallet address format.' });
        return;
      }

      await dbService.createContact({
        user_id: user.id,
        contact_username: cleanUsername,
        contact_address: cleanAddress,
        group_name: groupInput.trim() ? groupInput.trim().toLowerCase() : undefined
      });

      setFormStatus({ success: true, message: `Successfully saved contact @${cleanUsername}!` });
      setUsernameInput('');
      setAddressInput('');
      setGroupInput('');
      await loadContacts();
    } catch (err: any) {
      setFormStatus({ success: false, message: err.message || 'Failed to save contact.' });
    }
  };

  const handleDeleteContact = async (contactUsername: string) => {
    if (!user) return;
    const confirm = window.confirm(`Are you sure you want to delete @${contactUsername} from your contacts?`);
    if (!confirm) return;

    try {
      const deleted = await dbService.deleteContact(user.id, contactUsername);
      if (deleted) {
        await loadContacts();
      } else {
        alert('Failed to delete contact.');
      }
    } catch (err: any) {
      console.error('Failed to delete contact', err);
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
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Title Header */}
      <div className="terminal-window" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BookOpen size={24} style={{ color: 'var(--accent)' }} />
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold' }}>Contacts Book</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keep track of addresses, usernames, and categorize them for batch treasury transfers.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        
        {/* Left: Contacts List */}
        <div className="terminal-window" style={{ minHeight: '400px' }}>
          <div className="terminal-header">
            <span>CONTACTS REGISTER ({contacts.length})</span>
          </div>
          <div className="terminal-body" style={{ padding: '16px' }}>
            {loading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading address book...</div>
            ) : contacts.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                Your address book is empty. Add contacts on the right, or tell the AI agent e.g. "Save Alice's address 0x... as moderator".
              </div>
            ) : (
              <table className="data-table" style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th>USERNAME</th>
                    <th>ADDRESS</th>
                    <th>GROUP / TAG</th>
                    <th style={{ width: '60px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(contact => (
                    <tr key={contact.id}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: 'none', padding: '16px 12px' }}>
                        <div style={{ 
                          width: '28px', 
                          height: '28px', 
                          borderRadius: '4px', 
                          backgroundColor: 'var(--surface-hover)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: 'var(--accent)'
                        }}>
                          <User size={14} />
                        </div>
                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>@{contact.contact_username}</span>
                      </td>
                      <td style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        <span title={contact.contact_address}>
                          {contact.contact_address.slice(0, 12)}...{contact.contact_address.slice(-10)}
                        </span>
                      </td>
                      <td>
                        {contact.group_name ? (
                          <span style={{ 
                            fontSize: '11px', 
                            padding: '3px 8px', 
                            borderRadius: '3px', 
                            backgroundColor: 'rgba(204,98,75,0.1)', 
                            color: 'var(--accent)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Tag size={10} />
                            {contact.group_name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>-</span>
                        )}
                      </td>
                      <td>
                        <button 
                          onClick={() => handleDeleteContact(contact.contact_username)}
                          style={{ 
                            cursor: 'pointer', 
                            color: 'var(--text-muted)', 
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Add Contact Form */}
        <div className="terminal-window">
          <div className="terminal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserPlus size={14} />
              <span>NEW CONTACT ENTRY</span>
            </div>
          </div>
          <div className="terminal-body">
            <form onSubmit={handleAddContact} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>USERNAME</label>
                <input
                  type="text"
                  placeholder="e.g. alice"
                  className="text-input"
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  style={{ fontSize: '12px', padding: '8px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>EVM WALLET ADDRESS</label>
                <input
                  type="text"
                  placeholder="0x..."
                  className="text-input"
                  value={addressInput}
                  onChange={e => setAddressInput(e.target.value)}
                  style={{ fontSize: '12px', padding: '8px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>GROUP TAG (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="e.g. moderators"
                  className="text-input"
                  value={groupInput}
                  onChange={e => setGroupInput(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  style={{ fontSize: '12px', padding: '8px' }}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Used to pay groups in batch e.g. "Pay moderators 5 ARC"
                </span>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '8px', fontSize: '12px', marginTop: '6px' }}>
                Add to Contacts Book
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

