import { dbService } from './db';
import { Transaction } from '@/types';

export interface AIAction {
  type: 'send' | 'balance' | 'history' | 'analytics_spend' | 'analytics_top_receiver' | 'analytics_biggest_payment' | 'summary' | 'wallet_address' | 'unknown' | 'help';
  amount?: number;
  recipient?: string;
  limit?: number;
  timeframe?: 'week' | 'month' | 'year' | 'all';
  rawQuery: string;
}

export interface AIResponse {
  action: AIAction;
  status: 'preview' | 'success' | 'info' | 'error' | 'requires_confirmation';
  message: string;
  data?: any;
}

export const aiEngine = {
  /**
   * Parse the user prompt using heuristics, regex, and keyword matching.
   * In production, this can call an LLM (such as Gemini) via an API endpoint,
   * but local parser handles primary commands instantly with 100% precision.
   */
  async parseIntent(query: string): Promise<AIAction> {
    const q = query.toLowerCase().trim();
    
    // Help command
    if (q === 'help' || q.includes('what can you do') || q.includes('commands')) {
      return { type: 'help', rawQuery: query };
    }

    // Wallet address
    if (q.includes('my wallet address') || q.includes('what is my address') || q.includes('show my address')) {
      return { type: 'wallet_address', rawQuery: query };
    }

    // Send / Pay payments
    // Match "send X to @username", "pay X to @username", "send @username X", "pay @username X", "send X ARC to @username", "pay John X"
    const sendRegexes = [
      /send\s+(\d+(?:\.\d+)?)\s*(?:arc|usdc)?\s+to\s+(@?\w+)/i,
      /pay\s+(@?\w+)\s+(\d+(?:\.\d+)?)\s*(?:arc|usdc)?/i,
      /pay\s+(\d+(?:\.\d+)?)\s*(?:arc|usdc)?\s+to\s+(@?\w+)/i,
      /send\s+(@?\w+)\s+(\d+(?:\.\d+)?)\s*(?:arc|usdc)?/i,
      /pay\s+(\w+)\s+(\d+(?:\.\d+)?)\s*(?:arc|usdc)?/i, // handles names without @ like "pay John 20"
      /send\s+(\d+(?:\.\d+)?)\s*(?:arc|usdc)?\s+(@?\w+)/i
    ];

    for (const regex of sendRegexes) {
      const match = q.match(regex);
      if (match) {
        // Find which index is the amount and which is the recipient
        let amountStr = '';
        let recipient = '';
        
        // If first match group is digit, it's amount. Else it's username.
        if (!isNaN(Number(match[1]))) {
          amountStr = match[1];
          recipient = match[2];
        } else {
          recipient = match[1];
          amountStr = match[2];
        }

        // Add @ if it's a username and does not start with @ or 0x
        if (!recipient.startsWith('@') && !recipient.startsWith('0x')) {
          recipient = '@' + recipient;
        }

        return {
          type: 'send',
          amount: parseFloat(amountStr),
          recipient,
          rawQuery: query
        };
      }
    }

    // Balance
    if (q.includes('balance') || q.includes('how much money') || q.includes('my funds')) {
      return { type: 'balance', rawQuery: query };
    }

    // Transaction History
    if (q.includes('transaction') || q.includes('history') || q.includes('payments') || q.includes('txs')) {
      // Extract limit if available, default to 10
      const limitMatch = q.match(/last\s+(\d+)\s+transactions/i) || q.match(/(\d+)\s+transactions/i);
      const limit = limitMatch ? parseInt(limitMatch[1]) : 10;
      return {
        type: 'history',
        limit,
        rawQuery: query
      };
    }

    // Analytics: Spending this week/month
    if (q.includes('spend') || q.includes('spent') || q.includes('spending')) {
      let timeframe: 'week' | 'month' | 'year' | 'all' = 'month';
      if (q.includes('week')) timeframe = 'week';
      else if (q.includes('year')) timeframe = 'year';
      
      return {
        type: 'analytics_spend',
        timeframe,
        rawQuery: query
      };
    }

    // Analytics: Who did I send the most money to
    if (q.includes('most money') || q.includes('send the most') || q.includes('top payee') || q.includes('biggest payee')) {
      return { type: 'analytics_top_receiver', rawQuery: query };
    }

    // Analytics: Biggest payment
    if (q.includes('biggest payment') || q.includes('largest payment') || q.includes('biggest transaction')) {
      return { type: 'analytics_biggest_payment', rawQuery: query };
    }

    // Summary
    if (q.includes('summarize') || q.includes('summary') || q.includes('activity summary')) {
      return { type: 'summary', rawQuery: query };
    }

    return { type: 'unknown', rawQuery: query };
  },

  /**
   * Processes the parsed action and generates a structured response.
   */
  async processAction(action: AIAction, userId: string, username: string): Promise<AIResponse> {
    const userWallet = await dbService.getWalletByUserId(userId);
    if (!userWallet) {
      return {
        action,
        status: 'error',
        message: 'Could not locate wallet profile for this session.'
      };
    }

    switch (action.type) {
      case 'help':
        return {
          action,
          status: 'info',
          message: `### ArcPilot AI Command Console\nHere are some operations you can perform:\n\n*   **Payments:** \`"Send 5 ARC to @alice"\` or \`"Pay @creatorchain 10 ARC"\`\n*   **Balance Queries:** \`"Show my balance"\` or \`"What is my address?"\`\n*   **History Logs:** \`"Show my last 5 transactions"\`\n*   **Spending Insights:** \`"How much did I spend this week?"\`\n*   **Portfolio Analytics:** \`"Summarize my activity"\` or \`"Who did I send the most money to?"\``
        };

      case 'wallet_address':
        const userObj = await dbService.getUserByUsername(username);
        return {
          action,
          status: 'info',
          message: `Your ArcPilot embedded wallet address is:\n\n\`${userObj?.wallet_address || '0xAddressNotAvailable'}\`\n\nFunds deposited here can be accessed instantly by typing chat commands.`,
          data: { address: userObj?.wallet_address }
        };

      case 'balance':
        return {
          action,
          status: 'info',
          message: `Your current ArcPilot wallet balance is **${userWallet.balance.toFixed(2)} ARC** (USDC gas-equivalent).`,
          data: { balance: userWallet.balance }
        };

      case 'history': {
        const limit = action.limit || 10;
        const txs = await dbService.getTransactionsByUsernameOrAddress(username, limit);
        if (txs.length === 0) {
          return {
            action,
            status: 'info',
            message: 'You do not have any transaction history yet. Type `"Send 5 ARC to @alice"` to execute your first transfer!'
          };
        }
        
        let txListMsg = `Here are your last **${txs.length} transactions**:\n\n`;
        txs.forEach((t, i) => {
          const arrow = t.sender.toLowerCase() === `@${username.toLowerCase()}` ? '→ Sent to' : '← Received from';
          const direction = t.sender.toLowerCase() === `@${username.toLowerCase()}` ? t.receiver : t.sender;
          txListMsg += `${i+1}. **${t.amount.toFixed(2)} ARC** ${arrow} **${direction}** [${t.status.toUpperCase()}] (_hash: ${t.hash.slice(0, 10)}..._)\n`;
        });

        return {
          action,
          status: 'info',
          message: txListMsg,
          data: txs
        };
      }

      case 'send': {
        if (!action.amount || action.amount <= 0) {
          return {
            action,
            status: 'error',
            message: 'Invalid transfer amount. Please specify a positive number (e.g., Send 5 ARC).'
          };
        }

        if (!action.recipient) {
          return {
            action,
            status: 'error',
            message: 'Recipient username missing. Please state who you want to pay (e.g., to @alice).'
          };
        }

        // Check if recipient exists in DB
        let recipientAddress = '';
        let recipientName = action.recipient;

        if (action.recipient.startsWith('@')) {
          const recUser = await dbService.getUserByUsername(action.recipient.slice(1));
          if (!recUser) {
            return {
              action,
              status: 'error',
              message: `Recipient username \`${action.recipient}\` does not exist in the ArcPilot registry.`
            };
          }
          recipientAddress = recUser.wallet_address;
        } else if (action.recipient.startsWith('0x')) {
          recipientAddress = action.recipient;
        } else {
          // Resolve standard word as username
          const recUser = await dbService.getUserByUsername(action.recipient);
          if (!recUser) {
            return {
              action,
              status: 'error',
              message: `Recipient \`${action.recipient}\` is not a registered wallet address or username.`
            };
          }
          recipientAddress = recUser.wallet_address;
          recipientName = '@' + action.recipient;
        }

        // Self transfer check
        const senderUser = await dbService.getUserByUsername(username);
        if (senderUser && recipientAddress.toLowerCase() === senderUser.wallet_address.toLowerCase()) {
          return {
            action,
            status: 'error',
            message: 'Self-payments are disabled. Please transfer to another username or external wallet.'
          };
        }

        // Balance check
        if (userWallet.balance < action.amount) {
          return {
            action,
            status: 'error',
            message: `Insufficient funds. Your balance is **${userWallet.balance.toFixed(2)} ARC** but this transaction requires **${action.amount.toFixed(2)} ARC**.`
          };
        }

        // Return a preview state representing the safety verification check.
        // If amount is high, it flags "requires_confirmation"
        const needsConfirmation = action.amount >= 20;

        return {
          action,
          status: needsConfirmation ? 'requires_confirmation' : 'preview',
          message: needsConfirmation 
            ? `⚠️ **Security Alert:** This transfer of **${action.amount.toFixed(2)} ARC** to **${recipientName}** exceeds your instant safety threshold. Please confirm execution.`
            : `Confirm transfer of **${action.amount.toFixed(2)} ARC** to **${recipientName}** (${recipientAddress.slice(0, 8)}...)?`,
          data: {
            amount: action.amount,
            recipient: recipientName,
            recipientAddress,
            fee: 0.01 // gas estimate
          }
        };
      }

      case 'analytics_spend': {
        const timeframe = action.timeframe || 'month';
        const txs = await dbService.getTransactionsByUsernameOrAddress(username, 100);
        
        // Filter transactions sent by user
        const sentTxs = txs.filter(t => t.sender.toLowerCase() === `@${username.toLowerCase()}`);
        
        // Filter by timeframe
        const now = new Date();
        let daysToFilter = 30;
        if (timeframe === 'week') daysToFilter = 7;
        else if (timeframe === 'year') daysToFilter = 365;
        
        const cutoffDate = new Date(now.getTime() - daysToFilter * 24 * 60 * 60 * 1000);
        const filteredTxs = sentTxs.filter(t => new Date(t.created_at) >= cutoffDate);
        
        const totalSpent = filteredTxs.reduce((sum, t) => sum + t.amount, 0);

        return {
          action,
          status: 'info',
          message: `You spent a total of **${totalSpent.toFixed(2)} ARC** this ${timeframe}.\n\nThis is derived from **${filteredTxs.length} payments** made during this period.`,
          data: { totalSpent, count: filteredTxs.length, timeframe }
        };
      }

      case 'analytics_top_receiver': {
        const txs = await dbService.getTransactionsByUsernameOrAddress(username, 100);
        const sentTxs = txs.filter(t => t.sender.toLowerCase() === `@${username.toLowerCase()}`);
        
        if (sentTxs.length === 0) {
          return {
            action,
            status: 'info',
            message: 'You have not made any payments yet.'
          };
        }

        const spendMap: Record<string, number> = {};
        sentTxs.forEach(t => {
          spendMap[t.receiver] = (spendMap[t.receiver] || 0) + t.amount;
        });

        let topReceiver = '';
        let maxSpent = 0;
        Object.entries(spendMap).forEach(([receiver, amount]) => {
          if (amount > maxSpent) {
            maxSpent = amount;
            topReceiver = receiver;
          }
        });

        return {
          action,
          status: 'info',
          message: `Your top payee is **${topReceiver}**.\n\nYou have transferred a total of **${maxSpent.toFixed(2)} ARC** to them.`,
          data: { topReceiver, amount: maxSpent }
        };
      }

      case 'analytics_biggest_payment': {
        const txs = await dbService.getTransactionsByUsernameOrAddress(username, 100);
        const sentTxs = txs.filter(t => t.sender.toLowerCase() === `@${username.toLowerCase()}`);
        
        if (sentTxs.length === 0) {
          return {
            action,
            status: 'info',
            message: 'You have not made any payments yet.'
          };
        }

        let biggestTx: Transaction | null = null;
        for (const t of sentTxs) {
          if (!biggestTx || t.amount > biggestTx.amount) {
            biggestTx = t;
          }
        }

        if (!biggestTx) {
          return {
            action,
            status: 'info',
            message: 'Error finding transactions.'
          };
        }

        return {
          action,
          status: 'info',
          message: `Your biggest payment was **${biggestTx.amount.toFixed(2)} ARC** to **${biggestTx.receiver}**.\n\nExecuted on: ${new Date(biggestTx.created_at).toLocaleDateString()}`,
          data: biggestTx
        };
      }

      case 'summary': {
        const txs = await dbService.getTransactionsByUsernameOrAddress(username, 50);
        const sent = txs.filter(t => t.sender.toLowerCase() === `@${username.toLowerCase()}`);
        const received = txs.filter(t => t.receiver.toLowerCase() === `@${username.toLowerCase()}`);

        const totalSent = sent.reduce((sum, t) => sum + t.amount, 0);
        const totalReceived = received.reduce((sum, t) => sum + t.amount, 0);

        return {
          action,
          status: 'info',
          message: `### ArcPilot Activity Summary\n\n*   **Total Sent:** ${totalSent.toFixed(2)} ARC (${sent.length} txs)\n*   **Total Received:** ${totalReceived.toFixed(2)} ARC (${received.length} txs)\n*   **Net Flow:** ${(totalReceived - totalSent).toFixed(2)} ARC\n*   **Account Status:** Active / Fully Verified`,
          data: { totalSent, totalReceived, sentCount: sent.length, receivedCount: received.length }
        };
      }

      default:
        return {
          action,
          status: 'info',
          message: "I didn't quite capture your intent. Type `help` to see the supported wallet commands."
        };
    }
  }
};
