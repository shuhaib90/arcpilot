'use client';

import { useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { dbService } from '@/services/db';
import { walletService } from '@/services/wallet';
import { Transaction } from '@/types';
import { ethers } from 'ethers';

export function useWallet() {
  const { user, wallet, refreshBalance, setWalletBalance } = useApp();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const loadTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await dbService.getTransactionsByUsernameOrAddress(user.username, 50);
      setTransactions(data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const deposit = useCallback(async (amount: number) => {
    if (!user || !wallet) return;
    setLoading(true);
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();

        // Native gas token on Arc L1 is USDC (18 decimals)
        const tx = await signer.sendTransaction({
          to: user.wallet_address,
          value: ethers.parseEther(amount.toString())
        });

        const receipt = await tx.wait();

        if (receipt && receipt.status === 1) {
          await refreshBalance();
          
          await dbService.createTransaction({
            sender: user.recovery_wallet,
            receiver: '@' + user.username,
            amount,
            status: 'success',
            hash: receipt.hash
          });
          await loadTransactions();
        } else {
          throw new Error('On-chain deposit transaction failed.');
        }
      } else {
        throw new Error('EVM browser wallet extension not found. Deposit requires MetaMask or Rabby.');
      }
    } catch (e: any) {
      console.error('Deposit failed:', e);
      alert(e.message || 'On-chain deposit failed.');
    } finally {
      setLoading(false);
    }
  }, [user, wallet, refreshBalance, loadTransactions]);

  const withdraw = useCallback(async (recipientAddress: string, amount: number) => {
    if (!user || !wallet) return { success: false, error: 'User session or wallet not found.' };
    
    setLoading(true);
    try {
      // Sync on-chain balance first to make sure database cache is fresh
      const freshBalance = await refreshBalance();
      if (freshBalance < amount) {
        return {
          success: false,
          error: `Insufficient balance. On-chain balance is ${freshBalance} USDC, but you tried to withdraw ${amount} USDC.`
        };
      }

      const embeddedWallet = await walletService.createEmbeddedWallet(user.recovery_wallet);
      const result = await walletService.executeTransfer(
        embeddedWallet.encryptedPrivateKey,
        recipientAddress,
        amount
      );

      if (result.success) {
        // Sync balance again to get the final state
        await refreshBalance();

        await dbService.createTransaction({
          sender: '@' + user.username,
          receiver: recipientAddress,
          amount,
          status: 'success',
          hash: result.txHash
        });
        await loadTransactions();
        return { success: true };
      }
      return { success: false, error: result.error || 'Transaction execution failed.' };
    } catch (e: any) {
      console.error('Withdraw failed:', e);
      return { success: false, error: e.message || 'Execution error.' };
    } finally {
      setLoading(false);
    }
  }, [user, wallet, refreshBalance, loadTransactions]);

  return {
    loading,
    transactions,
    wallet,
    loadTransactions,
    deposit,
    withdraw,
    refreshBalance
  };
}
