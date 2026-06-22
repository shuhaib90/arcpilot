'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { dbService } from '@/services/db';
import { walletService } from '@/services/wallet';
import { User, Wallet } from '@/types';

interface AppContextProps {
  user: User | null;
  wallet: Wallet | null;
  loading: boolean;
  login: (username: string, recoveryWallet: string, walletAddress: string) => Promise<User>;
  logout: () => void;
  refreshBalance: () => Promise<number>;
  setWalletBalance: (amount: number) => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user session from localStorage on client load
  useEffect(() => {
    const storedUser = localStorage.getItem('arcpilot_user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setUser(u);
        // Load their wallet
        dbService.getWalletByUserId(u.id).then(async w => {
          if (w) {
            setWallet(w);
            // Proactively sync on-chain balance in background
            try {
              const onChainBalance = await walletService.getBlockchainBalance(u.wallet_address);
              await dbService.updateWalletBalance(u.id, onChainBalance);
              const updatedW = await dbService.getWalletByUserId(u.id);
              if (updatedW) setWallet(updatedW);
            } catch (e) {
              console.warn('Sync failed in background:', e);
            }
          } else {
            // Auto-create wallet if missing for existing session (e.g., due to previous UUID format issue)
            try {
              const newWallet = await dbService.createWallet(u.id);
              setWallet(newWallet);
              const onChainBalance = await walletService.getBlockchainBalance(u.wallet_address);
              await dbService.updateWalletBalance(u.id, onChainBalance);
              const updatedW = await dbService.getWalletByUserId(u.id);
              if (updatedW) setWallet(updatedW);
            } catch (e) {
              console.warn('Failed to auto-create missing wallet in session load:', e);
            }
          }
        });
      } catch (e) {
        console.error('Failed to parse stored session');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, recoveryWallet: string, walletAddress: string) => {
    setLoading(true);
    try {
      // Check if user already exists
      let existingUser = await dbService.getUserByUsername(username);
      if (!existingUser) {
        // Create new user in DB
        existingUser = await dbService.createUser({
          username,
          wallet_address: walletAddress,
          recovery_wallet: recoveryWallet
        });
        // Create wallet profile
        const newWallet = await dbService.createWallet(existingUser.id);
        setWallet(newWallet);
      } else {
        // Load existing wallet
        const w = await dbService.getWalletByUserId(existingUser.id);
        if (w) setWallet(w);
        else {
          const newWallet = await dbService.createWallet(existingUser.id);
          setWallet(newWallet);
        }
      }

      // Sync real on-chain balance
      try {
        const onChainBalance = await walletService.getBlockchainBalance(walletAddress);
        await dbService.updateWalletBalance(existingUser.id, onChainBalance);
        const updatedW = await dbService.getWalletByUserId(existingUser.id);
        if (updatedW) setWallet(updatedW);
      } catch (err) {
        console.warn('Could not sync on-chain balance during login:', err);
      }

      setUser(existingUser);
      localStorage.setItem('arcpilot_user', JSON.stringify(existingUser));
      return existingUser;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setWallet(null);
    localStorage.removeItem('arcpilot_user');
  };

  const refreshBalance = async (): Promise<number> => {
    if (!user) return 0;
    try {
      const onChainBalance = await walletService.getBlockchainBalance(user.wallet_address);
      await dbService.updateWalletBalance(user.id, onChainBalance);
      
      const w = await dbService.getWalletByUserId(user.id);
      if (w) {
        setWallet(w);
        return w.balance;
      }
    } catch (e) {
      console.error('Failed to sync balance from blockchain:', e);
    }

    const w = await dbService.getWalletByUserId(user.id);
    if (w) {
      setWallet(w);
      return w.balance;
    }
    return 0;
  };

  const setWalletBalance = (amount: number) => {
    if (wallet) {
      const updated = { ...wallet, balance: amount };
      setWallet(updated);
      dbService.updateWalletBalance(wallet.user_id, amount);
    }
  };

  return (
    <AppContext.Provider value={{ user, wallet, loading, login, logout, refreshBalance, setWalletBalance }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
