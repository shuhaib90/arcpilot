import { dbService } from './db';
import { walletService } from './wallet';
import { safetyService } from './safety';
import { ethers } from 'ethers';

const deriveTeamWallet = (teamName: string) => {
  const masterSeed = process.env.ARC_WALLET_MASTER_SEED || 'arcpilot-kms-master-seed-key-5042002';
  const hash = ethers.solidityPackedKeccak256(
    ['string', 'string'],
    [masterSeed, `team-${teamName.toLowerCase()}`]
  );
  const wallet = new ethers.Wallet(hash);
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    encryptedPrivateKey: btoa(wallet.privateKey)
  };
};

const MIMO_API_KEY = process.env.MIMO_API_KEY || 'sk-sgyxv81imk19yxfpvwbb9y7dpdz9awiezbja6lf6fjo2yy2x';
const MIMO_BASE_URL = process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1';
const MIMO_MODEL = process.env.MIMO_MODEL || 'mimo-v2.5-pro';

export interface AgentResult {
  text: string;
  toolCallsExecuted: { tool: string; args: any; result: any }[];
  status: 'success' | 'requires_confirmation' | 'info' | 'error';
  txPreviewData?: any;
}

// 1. Tool definitions for OpenAI-compatible schema
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_balance',
      description: "Gets the current ARC token balance for the logged-in user's embedded wallet.",
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'resolve_username',
      description: "Resolves a registered username (e.g., '@alice' or 'alice') to its corresponding on-chain wallet address.",
      parameters: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: "The username to resolve, with or without the leading '@'."
          }
        },
        required: ['username'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_arc',
      description: "Sends ARC tokens from the logged-in user's wallet to a recipient address or username. Always resolve usernames to addresses using resolve_username first before calling this if the user provided a username.",
      parameters: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: "The amount of ARC tokens to transfer."
          },
          recipientAddress: {
            type: 'string',
            description: "The destination EVM wallet address of the recipient (starts with 0x)."
          },
          recipientUsername: {
            type: 'string',
            description: "The original recipient username (e.g., '@alice'), if a username was used."
          }
        },
        required: ['amount', 'recipientAddress'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_transactions',
      description: "Get the user's historical transaction logs ledger.",
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            description: "Number of transaction items to retrieve. Default is 10."
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'wallet_summary',
      description: "Get a summary of the wallet activity (spending totals, Net flow, count of sent/received payments).",
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'manage_team',
      description: 'Manage collaborative team wallets: create a team wallet, invite members, assign roles, view treasury balance, get team history, or execute team transfer.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'invite', 'list_members', 'list_teams', 'view_balance', 'transfer', 'history'],
            description: 'Action to perform.'
          },
          teamName: {
            type: 'string',
            description: 'Name of the team (required for create, invite, list_members, view_balance, transfer, history).'
          },
          inviteeUsername: {
            type: 'string',
            description: "Username to invite or assign role to (e.g. '@alice' or 'alice')."
          },
          role: {
            type: 'string',
            enum: ['Owner', 'Admin', 'Member', 'Viewer'],
            description: 'Role to assign to the invited user (default is Member).'
          },
          amount: {
            type: 'number',
            description: 'Amount of ARC to transfer (required for transfer).'
          },
          recipientAddress: {
            type: 'string',
            description: 'Recipient EVM address for transfer (required for transfer if recipientUsername is not resolved).'
          },
          recipientUsername: {
            type: 'string',
            description: 'Recipient username for transfer.'
          }
        },
        required: ['action'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'manage_scheduled_payment',
      description: 'Create, list, cancel, pause, or resume scheduled recurring transfers.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'list', 'cancel', 'pause', 'resume'],
            description: 'Scheduled payment action.'
          },
          paymentId: {
            type: 'string',
            description: 'Scheduled payment ID (required for cancel, pause, resume).'
          },
          recipient: {
            type: 'string',
            description: 'Recipient username (e.g. @bob) or EVM address (required for create).'
          },
          amount: {
            type: 'number',
            description: 'Amount of ARC to send (required for create).'
          },
          frequency: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly', 'once'],
            description: 'Frequency of recurring transfer (required for create).'
          },
          startDate: {
            type: 'string',
            description: 'ISO start date time. Optional, defaults to current time.'
          }
        },
        required: ['action'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'manage_contact',
      description: 'Manage address book contacts (add, list, delete).',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'list', 'delete'],
            description: 'Contact action.'
          },
          contactUsername: {
            type: 'string',
            description: 'Username of contact (e.g. bob).'
          },
          contactAddress: {
            type: 'string',
            description: 'Wallet address of contact (EVM address starts with 0x).'
          },
          groupName: {
            type: 'string',
            description: 'Optional category group name (e.g. moderators, friends, design-team).'
          }
        },
        required: ['action'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'treasury_batch_transfer',
      description: 'Execute batch payments to a list of recipients or all contacts in a contact group. Supports paying from team wallets.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['pay_group', 'pay_list'],
            description: 'Batch transfer action.'
          },
          groupName: {
            type: 'string',
            description: 'Contact group to pay (required for pay_group).'
          },
          payments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                recipient: {
                  type: 'string',
                  description: 'Address or username of the recipient.'
                },
                amount: {
                  type: 'number',
                  description: 'Amount to pay.'
                }
              },
              required: ['recipient', 'amount']
            },
            description: 'List of individual transfers (required for pay_list).'
          },
          defaultAmount: {
            type: 'number',
            description: 'Default amount to send each recipient (optional, required if action is pay_group and amount is not specified).'
          },
          fromTeamName: {
            type: 'string',
            description: 'Optional team name if paying from a team wallet treasury instead of individual wallet.'
          }
        },
        required: ['action'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'manage_wallet_memory',
      description: 'Store or retrieve context memory key-values for the wallet (e.g. user preferences, notes, state).',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['get', 'set'],
            description: 'Memory action.'
          },
          key: {
            type: 'string',
            description: 'Key for storage.'
          },
          value: {
            type: 'string',
            description: 'Value to store (as a string or JSON string, required for set).'
          }
        },
        required: ['action', 'key'],
        additionalProperties: false
      }
    }
  }
];

export const mimoAgent = {
  async runChatSession(
    query: string, 
    userId: string, 
    username: string,
    history: { role: 'user' | 'assistant'; content: string }[] = []
  ): Promise<AgentResult> {
    const executedTools: { tool: string; args: any; result: any }[] = [];
    
    // Fetch wallet details
    const wallet = await dbService.getWalletByUserId(userId);
    const userObj = await dbService.getUserById(userId);
    const currentWalletAddress = userObj?.wallet_address || '';

    // Define systemic prompt context
    const systemPrompt = `You are ArcPilot, a developer-tool AI financial OS agent built to manage the user's crypto account using natural language.
You are interacting with @${username} (Wallet Address: ${currentWalletAddress}).
Today's local date is ${new Date().toLocaleDateString()} (ISO: ${new Date().toISOString()}).

You can:
1. Query balances, resolve usernames, retrieve transaction logs, perform analytics, and trigger payments.
2. Manage collaborative team wallets (create, invite, roles, team history/balance, and team transfer).
3. Schedule recurring payments (daily, weekly, monthly, once).
4. Manage contacts (add, list, delete) and contact groups (e.g. 'moderators', 'design-team').
5. Perform treasury batch transfers to a contact group or a list of recipients (optionally funded by a team treasury).
6. Store and retrieve wallet memory settings/preferences.

Guidelines:
1. Always resolve usernames to addresses using the resolve_username tool before attempting send_arc, scheduled payments, or team transfers if a username is supplied.
2. If a transfer amount (or total batch amount) is larger than 20 ARC, notify the user or request confirmation.
3. For scheduled payments, resolve recipient usernames/addresses first.
4. Keep responses concise, formatting tables/results in a clean, terminal-like monospace layout.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: query }
    ];

    try {
      let isLooping = true;
      let loopCount = 0;
      let finalResponseText = '';
      let txPreviewData: any = null;
      let status: 'success' | 'requires_confirmation' | 'info' | 'error' = 'success';

      while (isLooping && loopCount < 5) {
        loopCount++;
        
        console.log(`Calling MiMo API (loop ${loopCount})...`);
        
        const response = await fetch(`${MIMO_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${MIMO_API_KEY}`
          },
          body: JSON.stringify({
            model: MIMO_MODEL,
            messages,
            tools: TOOLS,
            tool_choice: 'auto'
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`MiMo API returned error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const choice = data.choices[0];
        const message = choice.message;
        
        // Add message to context
        messages.push(message);

        if (message.tool_calls && message.tool_calls.length > 0) {
          // Process tool calls
          const toolCallMessages = [];
          
          for (const tc of message.tool_calls) {
            const name = tc.function.name;
            const args = JSON.parse(tc.function.arguments);
            
            console.log(`Tool Call Requested: ${name}`, args);
            let result: any = null;

            try {
              if (name === 'get_balance') {
                if (wallet) {
                  let freshBalance = wallet.balance;
                  const userDbObj = await dbService.getUserByUsername(username);
                  if (userDbObj) {
                    try {
                      freshBalance = await walletService.getBlockchainBalance(userDbObj.wallet_address);
                      await dbService.updateWalletBalance(userId, freshBalance);
                    } catch (e) {
                      console.warn('Background sync failed in agent balance query:', e);
                    }
                  }
                  result = { success: true, balance: freshBalance, token: 'ARC' };
                } else {
                  result = { success: false, error: 'Wallet not found' };
                }
              } 
              else if (name === 'resolve_username') {
                const targetUser = await dbService.getUserByUsername(args.username);
                if (targetUser) {
                  result = { success: true, username: args.username, address: targetUser.wallet_address };
                } else {
                  result = { success: false, error: `Username @${args.username} not found.` };
                }
              } 
              else if (name === 'send_arc') {
                const amount = args.amount;
                const recipientAddress = args.recipientAddress;
                const recipientUsername = args.recipientUsername || recipientAddress;

                if (!wallet) {
                  result = { success: false, error: 'Wallet profile missing.' };
                } else if (wallet.balance < amount) {
                  result = { success: false, error: `Insufficient funds. Balance is ${wallet.balance} ARC.` };
                } else {
                  // Evaluate safety limits first
                  const safetyResult = await safetyService.evaluateTransaction(
                    username,
                    recipientUsername,
                    amount
                  );

                  if (!safetyResult.allowed) {
                    result = { 
                      success: false, 
                      error: `Blocked by Safety Layer: ${safetyResult.reason}. ${safetyResult.details}` 
                    };
                  } else if (safetyResult.requiresConfirmation) {
                    // Stop agent loop, ask for manual confirmation on frontend
                    isLooping = false;
                    status = 'requires_confirmation';
                    txPreviewData = {
                      amount,
                      recipient: recipientUsername,
                      recipientAddress,
                      fee: 0.01
                    };
                    result = { 
                      success: false, 
                      error: 'Requires explicit user confirmation. Pausing execution.' 
                    };
                  } else {
                    // Safe & approved: Execute transfer on-chain
                    const userDbObj = await dbService.getUserByUsername(username);
                    const embeddedWallet = await walletService.createEmbeddedWallet(userDbObj?.recovery_wallet || '');
                    
                    const txResult = await walletService.executeTransfer(
                      embeddedWallet.encryptedPrivateKey,
                      recipientAddress,
                      amount
                    );

                    if (txResult.success) {
                      // Deduct local balance
                      const newBalance = wallet.balance - amount - 0.01;
                      await dbService.updateWalletBalance(userId, newBalance);

                      // Log transaction
                      await dbService.createTransaction({
                        sender: '@' + username,
                        receiver: recipientUsername,
                        amount,
                        status: 'success',
                        hash: txResult.txHash
                      });

                      result = { 
                        success: true, 
                        txHash: txResult.txHash, 
                        amount, 
                        recipient: recipientUsername 
                      };
                    } else {
                      result = { success: false, error: txResult.error || 'Transaction execution failed.' };
                    }
                  }
                }
              } 
              else if (name === 'get_transactions') {
                const limit = args.limit || 10;
                const list = await dbService.getTransactionsByUsernameOrAddress(username, limit);
                result = { success: true, transactions: list };
              } 
              else if (name === 'wallet_summary') {
                const list = await dbService.getTransactionsByUsernameOrAddress(username, 100);
                const sent = list.filter(t => t.sender.toLowerCase() === `@${username.toLowerCase()}`);
                const received = list.filter(t => t.receiver.toLowerCase() === `@${username.toLowerCase()}`);
                
                const totalSent = sent.reduce((s, t) => s + t.amount, 0);
                const totalReceived = received.reduce((s, t) => s + t.amount, 0);
                
                result = { 
                  success: true, 
                  totalSent, 
                  totalReceived, 
                  sentCount: sent.length, 
                  receivedCount: received.length 
                };
              }
              else if (name === 'manage_team') {
                const action = args.action;
                const teamName = args.teamName;
                const inviteeUsername = args.inviteeUsername;
                const role = args.role;
                const amount = args.amount;
                const recipientAddress = args.recipientAddress;
                const recipientUsername = args.recipientUsername;

                if (action === 'create') {
                  if (!teamName) {
                    result = { success: false, error: 'Team name is required.' };
                  } else {
                    const existing = await dbService.getTeamByName(teamName);
                    if (existing) {
                      result = { success: false, error: `Team "${teamName}" already exists.` };
                    } else {
                      const derived = deriveTeamWallet(teamName);
                      const team = await dbService.createTeam(teamName, derived.address, userId);
                      result = { success: true, team, address: derived.address, role: 'Owner' };
                    }
                  }
                } 
                else if (action === 'invite') {
                  if (!teamName || !inviteeUsername) {
                    result = { success: false, error: 'teamName and inviteeUsername are required.' };
                  } else {
                    const team = await dbService.getTeamByName(teamName);
                    if (!team) {
                      result = { success: false, error: `Team "${teamName}" not found.` };
                    } else {
                      const cleanUsername = inviteeUsername.startsWith('@') ? inviteeUsername.slice(1) : inviteeUsername;
                      const targetUser = await dbService.getUserByUsername(cleanUsername);
                      if (!targetUser) {
                        result = { success: false, error: `User @${cleanUsername} is not registered.` };
                      } else {
                        const member = await dbService.addTeamMember(team.id, targetUser.id, role || 'Member');
                        result = { success: true, teamName, invitee: '@' + cleanUsername, role: role || 'Member' };
                      }
                    }
                  }
                } 
                else if (action === 'list_members') {
                  if (!teamName) {
                    result = { success: false, error: 'teamName is required.' };
                  } else {
                    const team = await dbService.getTeamByName(teamName);
                    if (!team) {
                      result = { success: false, error: `Team "${teamName}" not found.` };
                    } else {
                      const membersList = await dbService.getTeamMembers(team.id);
                      result = { 
                        success: true, 
                        members: membersList.map(m => ({ username: '@' + m.user.username, role: m.member.role }))
                      };
                    }
                  }
                } 
                else if (action === 'list_teams') {
                  const userTeams = await dbService.getUserTeams(userId);
                  result = { success: true, teams: userTeams };
                } 
                else if (action === 'view_balance') {
                  if (!teamName) {
                    result = { success: false, error: 'teamName is required.' };
                  } else {
                    const team = await dbService.getTeamByName(teamName);
                    if (!team) {
                      result = { success: false, error: `Team "${teamName}" not found.` };
                    } else {
                      const balance = await walletService.getBlockchainBalance(team.wallet_address);
                      result = { success: true, teamName, balance, address: team.wallet_address };
                    }
                  }
                } 
                else if (action === 'transfer') {
                  if (!teamName || !amount) {
                    result = { success: false, error: 'teamName and amount are required.' };
                  } else {
                    const team = await dbService.getTeamByName(teamName);
                    if (!team) {
                      result = { success: false, error: `Team "${teamName}" not found.` };
                    } else {
                      // Check user role on the team
                      const membersList = await dbService.getTeamMembers(team.id);
                      const userMember = membersList.find(m => m.member.user_id === userId);
                      if (!userMember || (userMember.member.role !== 'Owner' && userMember.member.role !== 'Admin')) {
                        result = { success: false, error: `Unauthorized. Only team Owner or Admin can authorize transfers (your role: ${userMember?.member.role || 'none'}).` };
                      } else {
                        // Resolve recipient address
                        let targetAddress = recipientAddress;
                        let displayRecipient = recipientUsername || recipientAddress || '';
                        if (recipientUsername && !targetAddress) {
                          const cleanUsername = recipientUsername.startsWith('@') ? recipientUsername.slice(1) : recipientUsername;
                          const targetUser = await dbService.getUserByUsername(cleanUsername);
                          if (targetUser) {
                            targetAddress = targetUser.wallet_address;
                            displayRecipient = '@' + cleanUsername;
                          } else {
                            result = { success: false, error: `Recipient username @${cleanUsername} not found.` };
                          }
                        }
                        
                        if (result === null) { // If not already set to error
                          if (!targetAddress) {
                            result = { success: false, error: 'Recipient address could not be resolved.' };
                          } else {
                            // Check team wallet balance
                            const balance = await walletService.getBlockchainBalance(team.wallet_address);
                            if (balance < amount) {
                              result = { success: false, error: `Insufficient team balance. Treasury has ${balance} ARC, but transaction requires ${amount} ARC.` };
                            } else {
                              // Check safety layer for transfers > 20 or confirmation
                              const safetyResult = await safetyService.evaluateTransaction(
                                `team-${teamName}`,
                                displayRecipient,
                                amount
                              );

                              if (!safetyResult.allowed) {
                                result = { success: false, error: `Blocked by Safety Layer: ${safetyResult.reason}.` };
                              } else if (safetyResult.requiresConfirmation) {
                                isLooping = false;
                                status = 'requires_confirmation';
                                txPreviewData = {
                                  amount,
                                  recipient: displayRecipient,
                                  recipientAddress: targetAddress,
                                  fromTeamName: teamName,
                                  fee: 0.01
                                };
                                result = { success: false, error: 'Requires explicit user confirmation. Pausing execution.' };
                              } else {
                                const teamWallet = deriveTeamWallet(teamName);
                                const txResult = await walletService.executeTransfer(
                                  teamWallet.encryptedPrivateKey,
                                  targetAddress,
                                  amount
                                );

                                if (txResult.success) {
                                  // Log transaction
                                  await dbService.createTransaction({
                                    sender: `@team-${teamName.toLowerCase()}`,
                                    receiver: displayRecipient,
                                    amount,
                                    status: 'success',
                                    hash: txResult.txHash
                                  });
                                  result = { success: true, txHash: txResult.txHash, amount, recipient: displayRecipient };
                                } else {
                                  result = { success: false, error: txResult.error || 'Transaction execution failed.' };
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } 
                else if (action === 'history') {
                  if (!teamName) {
                    result = { success: false, error: 'teamName is required.' };
                  } else {
                    const identifier = `@team-${teamName.toLowerCase()}`;
                    const historyList = await dbService.getTransactionsByUsernameOrAddress(identifier, 20);
                    result = { success: true, transactions: historyList };
                  }
                }
              } 
              else if (name === 'manage_scheduled_payment') {
                const action = args.action;
                const paymentId = args.paymentId;
                const recipient = args.recipient;
                const amount = args.amount;
                const frequency = args.frequency;
                const startDate = args.startDate;

                if (action === 'create') {
                  if (!recipient || !amount || !frequency) {
                    result = { success: false, error: 'recipient, amount, and frequency are required.' };
                  } else {
                    let targetAddress = '';
                    let displayRecipient = recipient;
                    if (recipient.startsWith('@') || !recipient.startsWith('0x')) {
                      const cleanUsername = recipient.startsWith('@') ? recipient.slice(1) : recipient;
                      const targetUser = await dbService.getUserByUsername(cleanUsername);
                      if (targetUser) {
                        targetAddress = targetUser.wallet_address;
                        displayRecipient = '@' + cleanUsername;
                      } else {
                        // See if contact exists
                        const contactsList = await dbService.getContactsByUserId(userId);
                        const contact = contactsList.find(c => c.contact_username.toLowerCase() === cleanUsername.toLowerCase());
                        if (contact) {
                          targetAddress = contact.contact_address;
                        } else {
                          result = { success: false, error: `Recipient @${cleanUsername} could not be resolved.` };
                        }
                      }
                    } else {
                      targetAddress = recipient;
                    }

                    if (result === null) {
                      const startIso = startDate ? new Date(startDate).toISOString() : new Date().toISOString();
                      const scheduled = await dbService.createScheduledPayment({
                        user_id: userId,
                        recipient: targetAddress,
                        recipient_username: displayRecipient,
                        amount,
                        frequency,
                        status: 'active',
                        next_execution: startIso
                      });
                      result = { success: true, payment: scheduled };
                    }
                  }
                } 
                else if (action === 'list') {
                  const list = await dbService.getScheduledPaymentsByUserId(userId);
                  result = { success: true, payments: list };
                } 
                else if (action === 'cancel' || action === 'pause' || action === 'resume') {
                  if (!paymentId) {
                    result = { success: false, error: 'paymentId is required.' };
                  } else {
                    const statusMap: Record<string, 'cancelled' | 'paused' | 'active'> = {
                      cancel: 'cancelled',
                      pause: 'paused',
                      resume: 'active'
                    };
                    const updated = await dbService.updateScheduledPaymentStatus(paymentId, statusMap[action]);
                    result = { success: updated, paymentId, status: statusMap[action] };
                  }
                }
              } 
              else if (name === 'manage_contact') {
                const action = args.action;
                const contactUsername = args.contactUsername;
                const contactAddress = args.contactAddress;
                const groupName = args.groupName;

                if (action === 'create') {
                  if (!contactUsername || !contactAddress) {
                    result = { success: false, error: 'contactUsername and contactAddress are required.' };
                  } else {
                    const cleanUsername = contactUsername.startsWith('@') ? contactUsername.slice(1) : contactUsername;
                    const contact = await dbService.createContact({
                      user_id: userId,
                      contact_username: cleanUsername,
                      contact_address: contactAddress,
                      group_name: groupName || undefined
                    });
                    result = { success: true, contact };
                  }
                } 
                else if (action === 'list') {
                  const list = await dbService.getContactsByUserId(userId);
                  result = { success: true, contacts: list };
                } 
                else if (action === 'delete') {
                  if (!contactUsername) {
                    result = { success: false, error: 'contactUsername is required.' };
                  } else {
                    const cleanUsername = contactUsername.startsWith('@') ? contactUsername.slice(1) : contactUsername;
                    const deleted = await dbService.deleteContact(userId, cleanUsername);
                    result = { success: deleted, contactUsername: cleanUsername };
                  }
                }
              } 
              else if (name === 'treasury_batch_transfer') {
                const action = args.action;
                const groupName = args.groupName;
                const payments = args.payments;
                const defaultAmount = args.defaultAmount;
                const fromTeamName = args.fromTeamName;

                // Resolve batch list of payments
                let resolvedPayments: { recipientAddress: string; displayRecipient: string; amount: number }[] = [];
                let parseError = '';

                if (action === 'pay_group') {
                  if (!groupName) {
                    parseError = 'groupName is required for pay_group.';
                  } else {
                    const contactsList = await dbService.getContactsByGroup(userId, groupName);
                    if (contactsList.length === 0) {
                      parseError = `No contacts found in group "${groupName}".`;
                    } else if (!defaultAmount) {
                      parseError = 'defaultAmount is required for pay_group.';
                    } else {
                      resolvedPayments = contactsList.map(c => ({
                        recipientAddress: c.contact_address,
                        displayRecipient: '@' + c.contact_username,
                        amount: defaultAmount
                      }));
                    }
                  }
                } 
                else if (action === 'pay_list') {
                  if (!payments || payments.length === 0) {
                    parseError = 'payments list is required for pay_list.';
                  } else {
                    for (const p of payments) {
                      let targetAddress = '';
                      let displayRecipient = p.recipient;
                      if (p.recipient.startsWith('@') || !p.recipient.startsWith('0x')) {
                        const cleanUsername = p.recipient.startsWith('@') ? p.recipient.slice(1) : p.recipient;
                        const targetUser = await dbService.getUserByUsername(cleanUsername);
                        if (targetUser) {
                          targetAddress = targetUser.wallet_address;
                          displayRecipient = '@' + cleanUsername;
                        } else {
                          // Try contact
                          const contactsList = await dbService.getContactsByUserId(userId);
                          const contact = contactsList.find(c => c.contact_username.toLowerCase() === cleanUsername.toLowerCase());
                          if (contact) {
                            targetAddress = contact.contact_address;
                          } else {
                            parseError = `Recipient @${cleanUsername} could not be resolved.`;
                            break;
                          }
                        }
                      } else {
                        targetAddress = p.recipient;
                      }
                      resolvedPayments.push({
                        recipientAddress: targetAddress,
                        displayRecipient,
                        amount: p.amount
                      });
                    }
                  }
                }

                if (parseError) {
                  result = { success: false, error: parseError };
                } else {
                  // Determine sender
                  let senderAddress = currentWalletAddress;
                  let senderKey = '';
                  let isTeam = false;
                  
                  if (fromTeamName) {
                    const team = await dbService.getTeamByName(fromTeamName);
                    if (!team) {
                      result = { success: false, error: `Team "${fromTeamName}" not found.` };
                    } else {
                      const membersList = await dbService.getTeamMembers(team.id);
                      const userMember = membersList.find(m => m.member.user_id === userId);
                      if (!userMember || (userMember.member.role !== 'Owner' && userMember.member.role !== 'Admin')) {
                        result = { success: false, error: `Unauthorized. Only team Owner or Admin can authorize team batch transfers.` };
                      } else {
                        senderAddress = team.wallet_address;
                        const derived = deriveTeamWallet(fromTeamName);
                        senderKey = derived.encryptedPrivateKey;
                        isTeam = true;
                      }
                    }
                  } else {
                    if (wallet) {
                      senderAddress = currentWalletAddress;
                      const embedded = await walletService.createEmbeddedWallet(userObj?.recovery_wallet || '');
                      senderKey = embedded.encryptedPrivateKey;
                    } else {
                      result = { success: false, error: 'User wallet not found.' };
                    }
                  }

                  if (result === null) {
                    // Check balance & check total
                    const totalAmount = resolvedPayments.reduce((s, p) => s + p.amount, 0);
                    const balance = await walletService.getBlockchainBalance(senderAddress);
                    
                    if (balance < totalAmount) {
                      result = { 
                        success: false, 
                        error: `Insufficient balance. Sender wallet has ${balance} ARC, but batch transaction requires ${totalAmount} ARC.` 
                      };
                    } else {
                      // Check safety limits
                      let anyOverLimit = resolvedPayments.some(p => p.amount > 20) || totalAmount > 20;
                      if (anyOverLimit) {
                        isLooping = false;
                        status = 'requires_confirmation';
                        txPreviewData = {
                          amount: totalAmount,
                          recipient: fromTeamName ? `Batch transfer from ${fromTeamName}` : `Batch transfer to ${resolvedPayments.length} recipients`,
                          recipientAddress: 'multiple',
                          fromTeamName: fromTeamName || undefined,
                          fee: 0.01 * resolvedPayments.length,
                          batchPayments: resolvedPayments
                        };
                        result = { success: false, error: 'Batch transfer requires user confirmation. Pausing execution.' };
                      } else {
                        // Execute transfers sequentially
                        const successTransfers = [];
                        const failedTransfers = [];
                        let spentBalance = 0;

                        for (const item of resolvedPayments) {
                          const txResult = await walletService.executeTransfer(
                            senderKey,
                            item.recipientAddress,
                            item.amount
                          );

                          if (txResult.success) {
                            spentBalance += item.amount + 0.01;
                            // Log transaction
                            const senderLabel = isTeam ? `@team-${fromTeamName?.toLowerCase()}` : `@${username}`;
                            await dbService.createTransaction({
                              sender: senderLabel,
                              receiver: item.displayRecipient,
                              amount: item.amount,
                              status: 'success',
                              hash: txResult.txHash
                            });
                            successTransfers.push({
                              recipient: item.displayRecipient,
                              amount: item.amount,
                              txHash: txResult.txHash
                            });
                          } else {
                            failedTransfers.push({
                              recipient: item.displayRecipient,
                              amount: item.amount,
                              error: txResult.error || 'Execution failed'
                            });
                          }
                        }

                        // Deduct local balance
                        if (!isTeam && wallet) {
                          await dbService.updateWalletBalance(userId, wallet.balance - spentBalance);
                        }

                        result = {
                          success: true,
                          totalPaid: resolvedPayments.length - failedTransfers.length,
                          totalFailed: failedTransfers.length,
                          transfers: successTransfers,
                          failed: failedTransfers
                        };
                      }
                    }
                  }
                }
              } 
              else if (name === 'manage_wallet_memory') {
                const action = args.action;
                const key = args.key;
                const value = args.value;

                if (!key) {
                  result = { success: false, error: 'key is required.' };
                } else if (action === 'set') {
                  if (value === undefined) {
                    result = { success: false, error: 'value is required for set action.' };
                  } else {
                    let parsedVal = value;
                    try {
                      parsedVal = JSON.parse(value);
                    } catch (e) {
                      // Keep as string
                    }
                    const mem = await dbService.setWalletMemory(userId, key, parsedVal);
                    result = { success: true, key, value: parsedVal };
                  }
                } else if (action === 'get') {
                  const mem = await dbService.getWalletMemory(userId, key);
                  result = { success: true, key, value: mem ? mem.value : null };
                }
              }
            } catch (err: any) {
              result = { success: false, error: err.message || 'Execution error' };
            }

            executedTools.push({ tool: name, args, result });
            
            toolCallMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name,
              content: JSON.stringify(result)
            });
          }

          // Append tool call responses to messages context
          messages.push(...toolCallMessages);
        } else {
          // No more tool calls, return final LLM response
          finalResponseText = message.content || '';
          isLooping = false;
        }
      }

      return {
        text: finalResponseText || 'Agent execution completed.',
        toolCallsExecuted: executedTools,
        status,
        txPreviewData
      };
    } catch (e: any) {
      console.error('Agent loop crashed:', e);
      return {
        text: `Error processing query: ${e.message || 'Unknown error during AI agent execution.'}`,
        toolCallsExecuted: executedTools,
        status: 'error'
      };
    }
  }
};
