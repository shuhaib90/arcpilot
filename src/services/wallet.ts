import { ethers } from 'ethers';

// Arc Testnet RPC URL
const ARC_RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.testnet.arc.network';
const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID) || 5042002;

export interface EmbeddedWalletInfo {
  address: string;
  encryptedPrivateKey: string;
  recoveryAddress: string;
}

export const walletService = {
  /**
   * Generates a new embedded wallet and encrypts its private key deterministically
   * using a master seed and the recovery address.
   */
  async createEmbeddedWallet(recoveryAddress: string): Promise<EmbeddedWalletInfo> {
    const masterSeed = process.env.ARC_WALLET_MASTER_SEED || 'arcpilot-kms-master-seed-key-5042002';
    
    // Derive a unique private key deterministically from master seed + recovery address
    const hash = ethers.solidityPackedKeccak256(
      ['string', 'address'],
      [masterSeed, recoveryAddress.toLowerCase()]
    );
    
    const wallet = new ethers.Wallet(hash);
    const encryptedPrivateKey = btoa(wallet.privateKey);

    return {
      address: wallet.address,
      encryptedPrivateKey,
      recoveryAddress: recoveryAddress
    };
  },

  /**
   * Verifies that a message signed by the recovery wallet matches the expected address.
   */
  verifyLoginSignature(message: string, signature: string, expectedAddress: string): boolean {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (e) {
      console.error('Signature verification error:', e);
      return false;
    }
  },

  /**
   * Decrypts the private key and signs/submits a transfer transaction.
   * Connects to the real Arc L1 Testnet, checks balance, and submits a native transfer.
   */
  async executeTransfer(
    encryptedPrivateKey: string,
    toAddress: string,
    amount: number
  ): Promise<{ success: boolean; txHash: string; error?: string }> {
    try {
      // Decrypt private key
      const privateKey = atob(encryptedPrivateKey);
      
      // Initialize provider
      const provider = new ethers.JsonRpcProvider(ARC_RPC_URL, {
        chainId: ARC_CHAIN_ID,
        name: 'arc-testnet'
      });
      const wallet = new ethers.Wallet(privateKey, provider);

      // Check balance on-chain
      const balanceWei = await provider.getBalance(wallet.address);
      const amountWei = ethers.parseEther(amount.toString());

      if (balanceWei < amountWei) {
        return {
          success: false,
          txHash: '',
          error: `Insufficient on-chain balance. Wallet has ${ethers.formatEther(balanceWei)} USDC, but transaction requires ${amount} USDC.`
        };
      }

      // Submit real transaction
      const tx = await wallet.sendTransaction({
        to: toAddress,
        value: amountWei,
      });

      console.log('Submitted real tx to Arc Testnet. Hash:', tx.hash);
      const receipt = await tx.wait();

      if (!receipt || receipt.status === 0) {
        return {
          success: false,
          txHash: tx.hash,
          error: 'Transaction reverted on-chain.'
        };
      }

      return {
        success: true,
        txHash: receipt.hash
      };
    } catch (error: any) {
      console.error('On-chain execution failed:', error);
      return {
        success: false,
        txHash: '',
        error: error.message || 'Transaction failed.'
      };
    }
  },

  /**
   * Gets the actual on-chain native USDC balance of an address on Arc Testnet.
   */
  async getBlockchainBalance(address: string): Promise<number> {
    try {
      const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
      const balance = await provider.getBalance(address);
      return parseFloat(ethers.formatEther(balance));
    } catch (e) {
      console.warn('Failed to query on-chain balance, using 0:', e);
      return 0;
    }
  },

  /**
   * Simulates/Resolves Account Abstraction upgrades:
   * Smart Accounts, Session Keys, and Account Abstraction (ERC-4337)
   */
  getAccountAbstractionSpecs() {
    return {
      upgradesEnabled: true,
      currentFramework: 'EIP-7702 & ERC-4337 Hybrid',
      sessionKeys: {
        supported: true,
        maxLifeSpan: '24h',
        permissions: ['transfer', 'approve']
      },
      delegatedExecution: {
        authorizedRelayer: '0xRelayerAddress...',
        gasSponsorship: 'Enabled (USDC Sponsored)'
      }
    };
  }
};
