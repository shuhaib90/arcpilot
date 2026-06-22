'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Terminal, Key, Shield, User as UserIcon, Check, Loader2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { walletService } from '@/services/wallet';
import { dbService } from '@/services/db';
import { ethers } from 'ethers';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useApp();
  
  const [walletAddress, setWalletAddress] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);

  const [signatureMessage, setSignatureMessage] = useState('');
  const [signature, setSignature] = useState('');
  const [signing, setSigning] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [signatureVerified, setSignatureVerified] = useState(false);

  const [username, setUsername] = useState('');
  const [registering, setRegistering] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  // 1. Connect an external wallet (like MetaMask, Rabby, or Arc wallet) and switch to Arc Testnet
  const connectWallet = async () => {
    setConnecting(true);
    setUsernameError('');
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const chainIdHex = '0x' + (5042002).toString(16); // '0x4cece2'
        
        // Attempt network switch or add Arc Testnet
        try {
          await (window as any).ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            try {
              await (window as any).ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: chainIdHex,
                    chainName: 'Arc Testnet',
                    nativeCurrency: {
                      name: 'USDC',
                      symbol: 'USDC',
                      decimals: 18,
                    },
                    rpcUrls: ['https://rpc.testnet.arc.network'],
                    blockExplorerUrls: ['https://testnet.arcscan.app'],
                  },
                ],
              });
            } catch (addError: any) {
              throw new Error('Failed to add Arc Testnet to your wallet: ' + addError.message);
            }
          } else {
            throw new Error('Failed to switch to Arc Testnet: ' + switchError.message);
          }
        }

        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        const address = accounts[0];
        
        setWalletAddress(address);
        setWalletConnected(true);
        setSignatureMessage(`ArcPilot Login Verification:\nTimestamp: ${Date.now()}\nRecovery Wallet: ${address}`);
      } else {
        throw new Error('EVM browser wallet extension not found. Please install MetaMask or Rabby to connect.');
      }
    } catch (e: any) {
      console.error(e);
      setUsernameError(e.message || 'Failed to connect wallet.');
    } finally {
      setConnecting(false);
    }
  };

  // 2. Sign a message using the connected browser wallet
  const signMessage = async () => {
    setSigning(true);
    setUsernameError('');
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const sig = await signer.signMessage(signatureMessage);
        
        setSignature(sig);
        
        // Recover address and verify signature
        const recoveredAddress = ethers.verifyMessage(signatureMessage, sig);
        if (recoveredAddress.toLowerCase() === walletAddress.toLowerCase()) {
          setSigning(false);
          setLoggingIn(true);
          
          // Check if user already exists in DB by recovery wallet address
          const existingUser = await dbService.getUserByRecoveryWallet(walletAddress);
          if (existingUser) {
            await login(existingUser.username, walletAddress, existingUser.wallet_address);
            router.push('/chat');
          } else {
            // Only prompt to choose a username if the account is not found in the DB
            setSignatureVerified(true);
          }
        } else {
          throw new Error('Signature verification mismatch.');
        }
      } else {
        throw new Error('EVM wallet provider not found.');
      }
    } catch (e: any) {
      console.error(e);
      setUsernameError(e.message || 'Failed to sign login message.');
    } finally {
      setSigning(false);
      setLoggingIn(false);
    }
  };

  // 3. Register user and generate embedded wallet
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;

    const cleanUsername = username.trim().toLowerCase().replace('@', '');
    if (cleanUsername.length < 3) {
      setUsernameError('Username must be at least 3 characters.');
      return;
    }

    setRegistering(true);
    setUsernameError('');

    try {
      // Check if username is taken
      const existingUser = await dbService.getUserByUsername(cleanUsername);
      if (existingUser) {
        setUsernameError('Username is already taken. Please choose another one.');
        setRegistering(false);
        return;
      }

      // Generate embedded wallet
      const embeddedWallet = await walletService.createEmbeddedWallet(walletAddress);

      // Perform login in AppContext
      await login(cleanUsername, walletAddress, embeddedWallet.address);
      
      // Redirect to Chat console
      router.push('/chat');
    } catch (e: any) {
      console.error(e);
      setUsernameError(e.message || 'Verification failed.');
      setRegistering(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '100px auto', padding: '0 24px' }}>
      <div className="terminal-window">
        <div className="terminal-header">
          <div className="terminal-dots">
            <span className="terminal-dot red"></span>
            <span className="terminal-dot yellow"></span>
            <span className="terminal-dot green"></span>
          </div>
          <span>arcpilot --login</span>
        </div>
        <div className="terminal-body">
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Terminal size={32} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Connect to ArcPilot Node</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Secure ownership linked to your recovery wallet.</p>
          </div>

          {/* Step 1: Connect Wallet */}
          {!walletConnected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '12px', backgroundColor: 'var(--surface-muted)', fontSize: '12px', display: 'flex', gap: '10px' }}>
                <Shield size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Connecting your wallet establishes it as the recovery and ownership contract for your AI embedded wallet.
                </span>
              </div>
              <button 
                onClick={connectWallet} 
                className="btn btn-primary"
                disabled={connecting}
                style={{ width: '100%', height: '42px', fontWeight: 'bold' }}
              >
                {connecting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Connecting Browser Wallet...</span>
                  </>
                ) : (
                  <span>Connect Wallet</span>
                )}
              </button>
            </div>
          )}

          {/* Step 2: Sign Signature */}
          {walletConnected && !signatureVerified && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Connected Account:</span>
                <span style={{ fontFamily: 'monospace', wordBreak: 'break-all', backgroundColor: 'var(--surface-muted)', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  {walletAddress}
                </span>
              </div>
              
              <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Sign Login Statement:</span>
                <textarea 
                  readOnly 
                  value={signatureMessage}
                  rows={3}
                  style={{ fontFamily: 'monospace', fontSize: '11px', width: '100%', backgroundColor: 'var(--surface-muted)', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', resize: 'none' }}
                />
              </div>

              <button 
                onClick={signMessage} 
                className="btn btn-primary"
                disabled={signing || loggingIn}
                style={{ width: '100%', height: '42px', fontWeight: 'bold' }}
              >
                {signing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Requesting signature...</span>
                  </>
                ) : loggingIn ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Verifying account...</span>
                  </>
                ) : (
                  <>
                    <Key size={16} />
                    <span>Sign Login Statement</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 3: Choose Username & Complete Onboarding */}
          {signatureVerified && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ border: '1px solid var(--success)', borderRadius: '4px', padding: '12px', backgroundColor: 'var(--surface-muted)', fontSize: '12px', display: 'flex', gap: '10px' }}>
                <Check size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Signature verified successfully. Account ownership validated.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Choose Username:</label>
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', color: 'var(--accent)', fontWeight: 'bold' }}>@</span>
                  <input 
                    type="text" 
                    placeholder="username" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                    className="text-input" 
                    style={{ paddingLeft: '28px' }}
                    required
                  />
                </div>
                {usernameError && (
                  <span style={{ color: 'var(--error)', fontSize: '11px' }}>{usernameError}</span>
                )}
              </div>

              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={registering || !username}
                style={{ width: '100%', height: '42px', fontWeight: 'bold' }}
              >
                {registering ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Generating Embedded Wallet...</span>
                  </>
                ) : (
                  <>
                    <UserIcon size={16} />
                    <span>Generate Account & Enter</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
