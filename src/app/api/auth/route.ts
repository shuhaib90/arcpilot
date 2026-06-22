import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/services/db';
import { walletService } from '@/services/wallet';

export async function POST(req: NextRequest) {
  try {
    const { username, walletAddress, recoveryWallet, signatureMessage, signature } = await req.json();

    if (!username || !walletAddress || !recoveryWallet) {
      return NextResponse.json(
        { error: 'Missing required registration parameters.' },
        { status: 400 }
      );
    }

    // Optional signature verification check
    if (signatureMessage && signature) {
      const verified = walletService.verifyLoginSignature(signatureMessage, signature, recoveryWallet);
      if (!verified) {
        return NextResponse.json(
          { error: 'Invalid message signature.' },
          { status: 401 }
        );
      }
    }

    // Check if username taken
    const existing = await dbService.getUserByUsername(username);
    if (existing) {
      return NextResponse.json(
        { error: 'Username already registered.' },
        { status: 409 }
      );
    }

    // Create user & wallet
    const newUser = await dbService.createUser({
      username,
      wallet_address: walletAddress,
      recovery_wallet: recoveryWallet,
    });

    const newWallet = await dbService.createWallet(newUser.id);

    return NextResponse.json({
      success: true,
      user: newUser,
      wallet: newWallet,
    });
  } catch (error: any) {
    console.error('API Auth Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
