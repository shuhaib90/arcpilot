import { dbService } from './db';

export interface SafetySettings {
  dailyLimit: number;
  highValueThreshold: number;
  whitelist: string[];
  blacklist: string[];
}

const DEFAULT_SETTINGS: SafetySettings = {
  dailyLimit: 100.0,
  highValueThreshold: 20.0,
  whitelist: ['@alice', '@bob', '@creatorchain'],
  blacklist: ['0x0000000000000000000000000000000000000000'],
};

export const safetyService = {
  /**
   * Retrieves the safety settings for a user.
   * Can be persisted in localStorage for ease of demo customization.
   */
  getSettings(): SafetySettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    const stored = localStorage.getItem('arcpilot_safety_settings');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  },

  /**
   * Updates safety settings.
   */
  updateSettings(settings: SafetySettings) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('arcpilot_safety_settings', JSON.stringify(settings));
  },

  /**
   * Evaluates if a transaction passes safety limits, is high-value, or violates rules.
   */
  async evaluateTransaction(
    senderUsername: string,
    recipient: string, // @username or address
    amount: number
  ): Promise<{
    allowed: boolean;
    requiresConfirmation: boolean;
    reason?: string;
    details?: string;
  }> {
    const settings = this.getSettings();

    // 1. Blacklist check
    if (settings.blacklist.some(b => b.toLowerCase() === recipient.toLowerCase())) {
      return {
        allowed: false,
        requiresConfirmation: false,
        reason: 'Blocked Address',
        details: 'The recipient address is flagged on the global security blacklist.'
      };
    }

    // 2. Fetch last 24h transactions to check daily limit
    const txs = await dbService.getTransactionsByUsernameOrAddress(senderUsername, 50);
    const sentLast24h = txs.filter(t => {
      if (t.sender.toLowerCase() !== `@${senderUsername.toLowerCase()}`) return false;
      const txTime = new Date(t.created_at).getTime();
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return txTime > oneDayAgo;
    });

    const totalSpentLast24h = sentLast24h.reduce((sum, t) => sum + t.amount, 0);

    if (totalSpentLast24h + amount > settings.dailyLimit) {
      return {
        allowed: false,
        requiresConfirmation: false,
        reason: 'Daily Limit Exceeded',
        details: `This transaction of ${amount.toFixed(2)} ARC would put you over your 24h limit of ${settings.dailyLimit.toFixed(2)} ARC. (Spent last 24h: ${totalSpentLast24h.toFixed(2)} ARC).`
      };
    }

    // 3. High value confirmation check
    if (amount >= settings.highValueThreshold) {
      // Check if recipient is in whitelist
      const isWhitelisted = settings.whitelist.some(
        w => w.toLowerCase() === recipient.toLowerCase()
      );

      if (!isWhitelisted) {
        return {
          allowed: true,
          requiresConfirmation: true,
          reason: 'High-Value Transfer',
          details: `This transaction of ${amount.toFixed(2)} ARC is above your instant execution threshold (${settings.highValueThreshold.toFixed(2)} ARC) for non-whitelisted recipients.`
        };
      }
    }

    return {
      allowed: true,
      requiresConfirmation: false
    };
  }
};
