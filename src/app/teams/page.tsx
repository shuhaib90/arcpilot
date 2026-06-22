'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { dbService } from '@/services/db';
import { walletService } from '@/services/wallet';
import { Team, TeamMember, User, Transaction } from '@/types';
import { ethers } from 'ethers';
import { Terminal, Users, Plus, Send, Copy, Shield, History, RefreshCw } from 'lucide-react';

export default function TeamsPage() {
  const { user } = useApp();
  const [loading, setLoading] = useState(true);
  const [userTeams, setUserTeams] = useState<{ team: Team; role: string }[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<{ team: Team; role: string } | null>(null);
  
  // Team detail states
  const [members, setMembers] = useState<{ member: TeamMember; user: User }[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [txHistory, setTxHistory] = useState<Transaction[]>([]);
  const [syncingBalance, setSyncingBalance] = useState(false);

  // Forms states
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Member' | 'Viewer'>('Member');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferRecipient, setTransferRecipient] = useState('');

  // Status/Error states
  const [createStatus, setCreateStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [inviteStatus, setInviteStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [transferStatus, setTransferStatus] = useState<{ success?: boolean; message?: string; txHash?: string } | null>(null);

  const loadTeams = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await dbService.getUserTeams(user.id);
      setUserTeams(list);
      if (list.length > 0 && !selectedTeam) {
        setSelectedTeam(list[0]);
      } else if (selectedTeam) {
        // Refresh selected team reference
        const updatedSelected = list.find(item => item.team.id === selectedTeam.team.id);
        if (updatedSelected) {
          setSelectedTeam(updatedSelected);
        }
      }
    } catch (e) {
      console.error('Failed to load teams', e);
    } finally {
      setLoading(false);
    }
  }, [user, selectedTeam]);

  useEffect(() => {
    loadTeams();
  }, [user]);

  const loadTeamDetails = useCallback(async () => {
    if (!selectedTeam) return;
    setSyncingBalance(true);
    try {
      // 1. Load members
      const memberList = await dbService.getTeamMembers(selectedTeam.team.id);
      setMembers(memberList);

      // 2. Load balance from blockchain
      const freshBalance = await walletService.getBlockchainBalance(selectedTeam.team.wallet_address);
      setBalance(freshBalance);

      // 3. Load transaction history
      const hist = await dbService.getTransactionsByUsernameOrAddress(`team-${selectedTeam.team.name.toLowerCase()}`, 20);
      setTxHistory(hist);
    } catch (e) {
      console.error('Failed loading team details', e);
    } finally {
      setSyncingBalance(false);
    }
  }, [selectedTeam]);

  useEffect(() => {
    loadTeamDetails();
  }, [selectedTeam]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTeamName.trim()) return;
    setCreateStatus({ message: 'Generating team wallet keys...' });
    try {
      const cleanName = newTeamName.trim();
      const existing = await dbService.getTeamByName(cleanName);
      if (existing) {
        setCreateStatus({ success: false, message: 'Team name already exists.' });
        return;
      }

      // Derive team wallet address client side
      const masterSeed = process.env.NEXT_PUBLIC_ARC_WALLET_MASTER_SEED || 'arcpilot-kms-master-seed-key-5042002';
      const hash = ethers.solidityPackedKeccak256(
        ['string', 'string'],
        [masterSeed, `team-${cleanName.toLowerCase()}`]
      );
      const walletInstance = new ethers.Wallet(hash);

      const team = await dbService.createTeam(cleanName, walletInstance.address, user.id);
      setCreateStatus({ success: true, message: `Team "${cleanName}" created successfully! Address: ${walletInstance.address}` });
      setNewTeamName('');
      await loadTeams();
    } catch (err: any) {
      setCreateStatus({ success: false, message: err.message || 'Failed to create team.' });
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !inviteUsername.trim()) return;
    setInviteStatus({ message: 'Searching user...' });
    try {
      const cleanUsername = inviteUsername.trim().startsWith('@') 
        ? inviteUsername.trim().slice(1) 
        : inviteUsername.trim();
        
      const targetUser = await dbService.getUserByUsername(cleanUsername);
      if (!targetUser) {
        setInviteStatus({ success: false, message: `User @${cleanUsername} is not registered in ArcPilot.` });
        return;
      }

      await dbService.addTeamMember(selectedTeam.team.id, targetUser.id, inviteRole);
      setInviteStatus({ success: true, message: `Successfully invited @${cleanUsername} as ${inviteRole}.` });
      setInviteUsername('');
      await loadTeamDetails();
    } catch (err: any) {
      setInviteStatus({ success: false, message: err.message || 'Failed to invite user.' });
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !transferAmount || !transferRecipient.trim()) return;
    
    const role = selectedTeam.role;
    if (role !== 'Owner' && role !== 'Admin') {
      setTransferStatus({ success: false, message: 'Permission denied. Only Owner or Admin can transfer funds.' });
      return;
    }

    setTransferStatus({ message: 'Processing transfer on-chain...' });
    try {
      const amountNum = parseFloat(transferAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        setTransferStatus({ success: false, message: 'Invalid transfer amount.' });
        return;
      }

      if (balance < amountNum) {
        setTransferStatus({ success: false, message: `Insufficient treasury funds. Team has ${balance} ARC.` });
        return;
      }

      // Resolve recipient
      let recipientAddress = transferRecipient.trim();
      let displayRecipient = recipientAddress;
      if (recipientAddress.startsWith('@') || !recipientAddress.startsWith('0x')) {
        const cleanName = recipientAddress.startsWith('@') ? recipientAddress.slice(1) : recipientAddress;
        const targetUser = await dbService.getUserByUsername(cleanName);
        if (targetUser) {
          recipientAddress = targetUser.wallet_address;
          displayRecipient = '@' + cleanName;
        } else {
          setTransferStatus({ success: false, message: `Recipient username @${cleanName} not found.` });
          return;
        }
      }

      // Derive private key client-side for signing
      const masterSeed = process.env.NEXT_PUBLIC_ARC_WALLET_MASTER_SEED || 'arcpilot-kms-master-seed-key-5042002';
      const hash = ethers.solidityPackedKeccak256(
        ['string', 'string'],
        [masterSeed, `team-${selectedTeam.team.name.toLowerCase()}`]
      );
      const teamWallet = new ethers.Wallet(hash);
      const encryptedPrivateKey = btoa(teamWallet.privateKey);

      const txResult = await walletService.executeTransfer(
        encryptedPrivateKey,
        recipientAddress,
        amountNum
      );

      if (txResult.success) {
        // Log transaction in db
        await dbService.createTransaction({
          sender: `@team-${selectedTeam.team.name.toLowerCase()}`,
          receiver: displayRecipient,
          amount: amountNum,
          status: 'success',
          hash: txResult.txHash
        });

        setTransferStatus({
          success: true,
          message: `Transferred ${amountNum} ARC to ${displayRecipient} successfully!`,
          txHash: txResult.txHash
        });
        setTransferAmount('');
        setTransferRecipient('');
        await loadTeamDetails();
      } else {
        setTransferStatus({ success: false, message: txResult.error || 'Transaction reverted.' });
      }
    } catch (err: any) {
      setTransferStatus({ success: false, message: err.message || 'Execution error.' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Address copied to clipboard!');
  };

  if (!user) {
    return (
      <div style={{ padding: '24px', fontFamily: 'monospace' }}>
        <p style={{ color: 'var(--error)' }}>Error: Connection console required. Please login first.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Title Header */}
      <div className="terminal-window" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Users size={24} style={{ color: 'var(--accent)' }} />
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold' }}>Collaborative Team Wallets</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Create shared treasuries, assign granular roles, and manage group expenses on Arc Testnet.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        
        {/* Left Column: Teams Directory */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Create Team Form */}
          <div className="terminal-window">
            <div className="terminal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={14} />
                <span>CREATE NEW TEAM</span>
              </div>
            </div>
            <div className="terminal-body" style={{ padding: '12px' }}>
              <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Team Name (e.g. CreatorChain)"
                  className="text-input"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                  required
                />
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '6px', fontSize: '12px' }}>
                  Initialize Wallet
                </button>
              </form>
              {createStatus && (
                <div style={{ marginTop: '10px', fontSize: '11px', color: createStatus.success ? 'var(--success)' : createStatus.success === false ? 'var(--error)' : 'var(--text-muted)' }}>
                  {createStatus.message}
                </div>
              )}
            </div>
          </div>

          {/* List of Joined Teams */}
          <div className="terminal-window" style={{ flexGrow: 1 }}>
            <div className="terminal-header">
              <span>TEAM DIRECTORY</span>
            </div>
            <div className="terminal-body" style={{ padding: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '12px' }}>Loading teams...</div>
              ) : userTeams.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '12px' }}>No active team wallets.</div>
              ) : (
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {userTeams.map(item => (
                    <li key={item.team.id}>
                      <button
                        onClick={() => {
                          setSelectedTeam(item);
                          setInviteStatus(null);
                          setTransferStatus(null);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px',
                          borderRadius: '4px',
                          backgroundColor: selectedTeam?.team.id === item.team.id ? 'var(--surface-hover)' : 'transparent',
                          border: selectedTeam?.team.id === item.team.id ? '1px solid var(--accent)' : '1px solid transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '13px', fontWeight: 'bold' }}>
                          <span>{item.team.name}</span>
                          <span style={{ color: 'var(--accent)', fontSize: '11px' }}>{item.role}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {item.team.wallet_address.slice(0, 6)}...{item.team.wallet_address.slice(-4)}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Team Dashboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {selectedTeam ? (
            <>
              {/* Treasury Header */}
              <div className="terminal-window" style={{ padding: '20px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase' }}>Active Treasury</span>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0' }}>{selectedTeam.team.name}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span>Address: {selectedTeam.team.wallet_address}</span>
                      <button onClick={() => copyToClipboard(selectedTeam.team.wallet_address)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', color: 'var(--accent)' }}>
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>USDC Balance</span>
                      <button onClick={loadTeamDetails} disabled={syncingBalance} style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <RefreshCw size={12} className={syncingBalance ? 'spin-anim' : ''} />
                      </button>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--accent)', marginTop: '4px' }}>
                      {balance.toFixed(2)} ARC
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Section: Members Directory & Treasury Action */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* Team Members List & Invite */}
                <div className="terminal-window">
                  <div className="terminal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Shield size={14} />
                      <span>MEMBERS & PERMISSIONS</span>
                    </div>
                  </div>
                  <div className="terminal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <table className="data-table" style={{ marginTop: 0 }}>
                        <thead>
                          <tr>
                            <th>MEMBER</th>
                            <th>ROLE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map(m => (
                            <tr key={m.member.id}>
                              <td style={{ fontSize: '12px' }}>
                                @{m.user.username} {m.user.id === user.id && <span style={{ color: 'var(--text-muted)' }}>(you)</span>}
                              </td>
                              <td>
                                <span style={{ 
                                  fontSize: '11px', 
                                  padding: '2px 6px', 
                                  borderRadius: '3px',
                                  backgroundColor: m.member.role === 'Owner' ? 'rgba(204,98,75,0.15)' : 'rgba(128,128,123,0.15)',
                                  color: m.member.role === 'Owner' ? 'var(--accent)' : 'var(--foreground)'
                                }}>
                                  {m.member.role}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Invite Member Form */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                      <h4 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-muted)' }}>INVITE MEMBER</h4>
                      <form onSubmit={handleInvite} style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="@username"
                          className="text-input"
                          value={inviteUsername}
                          onChange={e => setInviteUsername(e.target.value)}
                          style={{ fontSize: '12px', padding: '6px' }}
                          required
                        />
                        <select
                          className="text-input"
                          value={inviteRole}
                          onChange={e => setInviteRole(e.target.value as any)}
                          style={{ fontSize: '12px', width: '100px', padding: '6px' }}
                        >
                          <option value="Admin">Admin</option>
                          <option value="Member">Member</option>
                          <option value="Viewer">Viewer</option>
                        </select>
                        <button type="submit" className="btn" style={{ padding: '6px 12px', fontSize: '12px' }}>
                          Invite
                        </button>
                      </form>
                      {inviteStatus && (
                        <div style={{ marginTop: '6px', fontSize: '11px', color: inviteStatus.success ? 'var(--success)' : inviteStatus.success === false ? 'var(--error)' : 'var(--text-muted)' }}>
                          {inviteStatus.message}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Treasury Fund Transfer Form */}
                <div className="terminal-window">
                  <div className="terminal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Send size={14} />
                      <span>TRANSFER TREASURY FUNDS</span>
                    </div>
                  </div>
                  <div className="terminal-body">
                    {selectedTeam.role !== 'Owner' && selectedTeam.role !== 'Admin' ? (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '24px' }}>
                        Viewer & Member roles cannot authorize transfers. Owner or Admin permissions required.
                      </div>
                    ) : (
                      <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>RECIPIENT USERNAME OR EVM ADDRESS</label>
                          <input
                            type="text"
                            placeholder="0x... or @username"
                            className="text-input"
                            value={transferRecipient}
                            onChange={e => setTransferRecipient(e.target.value)}
                            style={{ fontSize: '12px', padding: '8px' }}
                            required
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>AMOUNT TO SEND (ARC)</label>
                          <input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            className="text-input"
                            value={transferAmount}
                            onChange={e => setTransferAmount(e.target.value)}
                            style={{ fontSize: '12px', padding: '8px' }}
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '8px', fontSize: '12px', marginTop: '4px' }}>
                          Sign & Authorize Transfer
                        </button>
                      </form>
                    )}
                    {transferStatus && (
                      <div style={{ marginTop: '12px', fontSize: '11px', color: transferStatus.success ? 'var(--success)' : transferStatus.success === false ? 'var(--error)' : 'var(--text-muted)' }}>
                        {transferStatus.message}
                        {transferStatus.txHash && (
                          <div style={{ wordBreak: 'break-all', marginTop: '4px', color: 'var(--text-muted)' }}>
                            Tx Hash: {transferStatus.txHash}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Bottom Section: Transaction Ledger */}
              <div className="terminal-window">
                <div className="terminal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <History size={14} />
                    <span>TREASURY TRANSACTION LEDGER</span>
                  </div>
                </div>
                <div className="terminal-body" style={{ padding: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                  {txHistory.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '16px' }}>No treasury transaction history found.</div>
                  ) : (
                    <table className="data-table" style={{ marginTop: 0 }}>
                      <thead>
                        <tr>
                          <th>DATE</th>
                          <th>HASH</th>
                          <th>RECIPIENT</th>
                          <th>AMOUNT</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txHistory.map(tx => (
                          <tr key={tx.id}>
                            <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {new Date(tx.created_at).toLocaleString()}
                            </td>
                            <td style={{ fontSize: '11px', color: 'var(--accent)' }}>
                              {tx.hash.slice(0, 10)}...
                            </td>
                            <td style={{ fontSize: '12px' }}>{tx.receiver}</td>
                            <td style={{ fontSize: '12px', fontWeight: 'bold' }}>{tx.amount} ARC</td>
                            <td>
                              <span style={{ color: tx.status === 'success' ? 'var(--success)' : 'var(--error)', fontSize: '11px' }}>
                                {tx.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="terminal-window" style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Select a team or initialize a new one to view details.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
