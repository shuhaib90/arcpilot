'use server';

import { dbService } from '@/services/db';
import { walletService } from '@/services/wallet';
import { safetyService } from '@/services/safety';

/**
 * Resolves a username to its linked wallet address on the server side.
 */
export async function resolveUsernameAction(username: string): Promise<{ success: boolean; address?: string; error?: string }> {
  try {
    const user = await dbService.getUserByUsername(username);
    if (user) {
      return { success: true, address: user.wallet_address };
    }
    return { success: false, error: 'Username not found' };
  } catch (e: any) {
    return { success: false, error: e.message || 'Resolution failed' };
  }
}

/**
 * Server action to evaluate a transaction against safety protocols.
 */
export async function checkSafetyLimitsAction(
  username: string,
  recipient: string,
  amount: number
) {
  return await safetyService.evaluateTransaction(username, recipient, amount);
}

/**
 * Server action to execute a blockchain transfer using decryptable keys on the backend.
 */
export async function executeTransferAction(
  userId: string,
  recipientAddress: string,
  recipientName: string,
  amount: number,
  fee = 0.01
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const wallet = await dbService.getWalletByUserId(userId);
    if (!wallet) {
      return { success: false, error: 'Wallet not found' };
    }

    if (wallet.balance < amount + fee) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Retrieve user profile to generate keypair
    const user = await dbService.getUserById(userId);
    if (!user) {
      return { success: false, error: 'User profile not found' };
    }

    const embeddedWallet = await walletService.createEmbeddedWallet(user.recovery_wallet);

    // Broadcast L1 transfer
    const result = await walletService.executeTransfer(
      embeddedWallet.encryptedPrivateKey,
      recipientAddress,
      amount
    );

    if (result.success) {
      // Deduct balance
      const newBalance = wallet.balance - amount - fee;
      await dbService.updateWalletBalance(userId, newBalance);

      // Save transaction
      await dbService.createTransaction({
        sender: '@' + user.username,
        receiver: recipientName,
        amount,
        status: 'success',
        hash: result.txHash
      });

      return { success: true, txHash: result.txHash };
    } else {
      return { success: false, error: result.error || 'Transaction execution failed' };
    }
  } catch (e: any) {
    return { success: false, error: e.message || 'Execution failed' };
  }
}
