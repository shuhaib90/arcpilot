'use client';

import { useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { dbService } from '@/services/db';
import { walletService } from '@/services/wallet';

export function useScheduledPaymentsRunner() {
  const { user, wallet, refreshBalance } = useApp();
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (!user || !wallet) return;

    const runScheduledPayments = async () => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;

      try {
        const allDue = await dbService.getAllDueScheduledPayments();
        const myDue = allDue.filter(p => p.user_id === user.id);

        if (myDue.length === 0) {
          isRunningRef.current = false;
          return;
        }

        console.log(`[Scheduler] Found ${myDue.length} due scheduled payments for @${user.username}`);

        for (const payment of myDue) {
          try {
            // Refresh on-chain balance to check funds
            const currentBalance = await refreshBalance();
            if (currentBalance < payment.amount + 0.01) {
              console.warn(`[Scheduler] Insufficient funds to execute scheduled payment ${payment.id}. Balance: ${currentBalance}, Requires: ${payment.amount}`);
              // Pause scheduled payment to avoid infinite loop of failures
              await dbService.updateScheduledPaymentStatus(payment.id, 'paused');
              
              await dbService.createTransaction({
                sender: '@' + user.username,
                receiver: payment.recipient_username || payment.recipient,
                amount: payment.amount,
                status: 'failed',
                hash: ''
              });
              continue;
            }

            // Derive embedded wallet private key
            const embeddedWallet = await walletService.createEmbeddedWallet(user.recovery_wallet);
            
            console.log(`[Scheduler] Executing transfer of ${payment.amount} ARC to ${payment.recipient_username || payment.recipient}`);
            const txResult = await walletService.executeTransfer(
              embeddedWallet.encryptedPrivateKey,
              payment.recipient,
              payment.amount
            );

            if (txResult.success) {
              console.log(`[Scheduler] Success! Hash: ${txResult.txHash}`);
              
              // Calculate next execution date
              let nextStatus: 'active' | 'completed' = 'active';
              let nextExecution: string | undefined;

              const now = new Date();
              if (payment.frequency === 'once') {
                nextStatus = 'completed';
              } else if (payment.frequency === 'daily') {
                now.setDate(now.getDate() + 1);
                nextExecution = now.toISOString();
              } else if (payment.frequency === 'weekly') {
                now.setDate(now.getDate() + 7);
                nextExecution = now.toISOString();
              } else if (payment.frequency === 'monthly') {
                now.setMonth(now.getMonth() + 1);
                nextExecution = now.toISOString();
              }

              // Update scheduled payment
              await dbService.updateScheduledPaymentStatus(payment.id, nextStatus, nextExecution);

              // Log transaction
              await dbService.createTransaction({
                sender: '@' + user.username,
                receiver: payment.recipient_username || payment.recipient,
                amount: payment.amount,
                status: 'success',
                hash: txResult.txHash
              });
            } else {
              console.error(`[Scheduler] Execution failed: ${txResult.error}`);
              // Pause execution of this schedule
              await dbService.updateScheduledPaymentStatus(payment.id, 'paused');
              
              await dbService.createTransaction({
                sender: '@' + user.username,
                receiver: payment.recipient_username || payment.recipient,
                amount: payment.amount,
                status: 'failed',
                hash: ''
              });
            }
          } catch (err) {
            console.error(`[Scheduler] Error executing payment ${payment.id}:`, err);
          }
        }

        // Refresh balance and local state after scheduling runs
        await refreshBalance();
      } catch (e) {
        console.error('[Scheduler] Failed running scheduled checks:', e);
      } finally {
        isRunningRef.current = false;
      }
    };

    // Run every 20 seconds
    const interval = setInterval(runScheduledPayments, 20000);
    // Also trigger immediately on component load/login
    runScheduledPayments();

    return () => clearInterval(interval);
  }, [user, wallet, refreshBalance]);
}
