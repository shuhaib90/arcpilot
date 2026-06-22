import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/db';
import { walletService } from '@/services/wallet';

export async function POST(req: NextRequest) {
  try {
    const { userId, recipientAddress, amount } = await req.json();

    if (!userId || !recipientAddress || amount === undefined) {
      return NextResponse.json(
        { error: 'Missing required transfer execution parameters.' },
        { status: 400 }
      );
    }

    const wallet = await dbService.getWalletByUserId(userId);
    if (!wallet) {
      return NextResponse.json(
        { error: 'User wallet not found.' },
        { status: 404 }
      );
    }

    if (wallet.balance < amount) {
      return NextResponse.json(
        { error: 'Insufficient balance.' },
        { status: 400 }
      );
    }

    const user = await dbService.getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User profile not found.' },
        { status: 404 }
      );
    }

    // Execute transfer
    const walletInfo = await walletService.createEmbeddedWallet(user.recovery_wallet);
    const result = await walletService.executeTransfer(
      walletInfo.encryptedPrivateKey,
      recipientAddress,
      amount
    );

    if (result.success) {
      // Deduct balance
      const newBalance = wallet.balance - amount;
      await dbService.updateWalletBalance(userId, newBalance);

      return NextResponse.json({
        success: true,
        txHash: result.txHash,
        newBalance,
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Transaction failed' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('API Wallet Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
