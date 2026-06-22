import { supabase } from '@/lib/supabase';
import { User, Wallet, Transaction, AIConversation, Team, TeamMember, ScheduledPayment, Contact, WalletMemory } from '@/types';

// Detect if we are running client-side
const isClient = typeof window !== 'undefined';

// Memory database for mock fallback (persisted in localStorage if client-side)
const mockDB = {
  users: [] as User[],
  wallets: [] as Wallet[],
  transactions: [] as Transaction[],
  ai_conversations: [] as AIConversation[],
  teams: [] as Team[],
  team_members: [] as TeamMember[],
  scheduled_payments: [] as ScheduledPayment[],
  contacts: [] as Contact[],
  wallet_memory: [] as WalletMemory[],
};

// Initialize mock data if running in fallback mode
const loadMockDB = () => {
  if (!isClient) return;
  const stored = localStorage.getItem('arcpilot_mock_db');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      mockDB.users = parsed.users || [];
      mockDB.wallets = parsed.wallets || [];
      mockDB.transactions = parsed.transactions || [];
      mockDB.ai_conversations = parsed.ai_conversations || [];
      mockDB.teams = parsed.teams || [];
      mockDB.team_members = parsed.team_members || [];
      mockDB.scheduled_payments = parsed.scheduled_payments || [];
      mockDB.contacts = parsed.contacts || [];
      mockDB.wallet_memory = parsed.wallet_memory || [];
    } catch (e) {
      console.error('Failed to parse mock database', e);
    }
  } else {
    // Seed some mock users for payments testing
    const seedUsers: User[] = [
      { id: 'u1', username: 'alice', wallet_address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', recovery_wallet: '0xabc123...', created_at: new Date().toISOString() },
      { id: 'u2', username: 'bob', wallet_address: '0x90f79bf6eb2c4f870365e785982e1f101e93b906', recovery_wallet: '0xdef456...', created_at: new Date().toISOString() },
      { id: 'u3', username: 'creatorchain', wallet_address: '0x15d34aafc52c96fdc0d40cca9c589e7697966a36', recovery_wallet: '0x789ghi...', created_at: new Date().toISOString() },
    ];
    mockDB.users = seedUsers;
    mockDB.wallets = seedUsers.map(u => ({ id: 'w_' + u.id, user_id: u.id, balance: 100.0 }));
    saveMockDB();
  }
};

const saveMockDB = () => {
  if (!isClient) return;
  localStorage.setItem('arcpilot_mock_db', JSON.stringify(mockDB));
};

if (isClient) {
  loadMockDB();
}

// Database Service interface
export const dbService = {
  // Users
  async createUser(user: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const formattedUser = {
      ...user,
      wallet_address: user.wallet_address.toLowerCase(),
      recovery_wallet: user.recovery_wallet.toLowerCase()
    };
    if (supabase) {
      const { data, error } = await supabase.from('users').insert([formattedUser]).select().single();
      if (!error && data) {
        const createdUser = data as User;
        // Also register username in usernames registry
        await supabase.from('usernames').insert([{ username: user.username, user_id: createdUser.id }]);
        return createdUser;
      }
      if (error) {
        console.warn('Supabase createUser failed, falling back:', error.message);
      }
    }

    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const newUser: User = {
      ...formattedUser,
      id,
      created_at: new Date().toISOString()
    };
    mockDB.users.push(newUser);
    saveMockDB();
    return newUser;
  },

  async getUserByUsername(username: string): Promise<User | null> {
    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
    
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('username', cleanUsername).maybeSingle();
      if (!error && data) return data as User;
    }

    const found = mockDB.users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase());
    return found || null;
  },

  async getUserByWalletAddress(walletAddress: string): Promise<User | null> {
    const cleanAddress = walletAddress.toLowerCase();
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', cleanAddress)
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) return data[0] as User;
    }

    const found = mockDB.users.find(u => u.wallet_address.toLowerCase() === cleanAddress);
    return found || null;
  },

  async getUserByRecoveryWallet(recoveryWallet: string): Promise<User | null> {
    const cleanAddress = recoveryWallet.toLowerCase();
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('recovery_wallet', cleanAddress)
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) return data[0] as User;
    }

    const found = mockDB.users.find(u => u.recovery_wallet.toLowerCase() === cleanAddress);
    return found || null;
  },

  async getUserById(id: string): Promise<User | null> {
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
      if (!error && data) return data as User;
    }

    const found = mockDB.users.find(u => u.id === id);
    return found || null;
  },

  // Wallets
  async createWallet(userId: string): Promise<Wallet> {
    if (supabase) {
      const { data, error } = await supabase
        .from('wallets')
        .insert([{ user_id: userId, balance: 0.0 }])
        .select()
        .single();
      if (!error && data) return data as Wallet;
      if (error) console.error('Supabase createWallet error:', error.message);
    }

    const fallbackWallet: Wallet = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      user_id: userId,
      balance: 0.0
    };
    mockDB.wallets.push(fallbackWallet);
    saveMockDB();
    return fallbackWallet;
  },

  async getWalletByUserId(userId: string): Promise<Wallet | null> {
    if (supabase) {
      const { data, error } = await supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle();
      if (!error && data) return data as Wallet;
    }

    const found = mockDB.wallets.find(w => w.user_id === userId);
    return found || null;
  },

  async updateWalletBalance(userId: string, newBalance: number): Promise<Wallet | null> {
    if (supabase) {
      const { data, error } = await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', userId).select().maybeSingle();
      if (!error && data) return data as Wallet;
    }

    const found = mockDB.wallets.find(w => w.user_id === userId);
    if (found) {
      found.balance = newBalance;
      saveMockDB();
      return found;
    }
    return null;
  },

  // Transactions
  async createTransaction(tx: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction> {
    if (supabase) {
      const { data, error } = await supabase.from('transactions').insert([tx]).select().single();
      if (!error && data) return data as Transaction;
      if (error) console.error('Supabase createTransaction error:', error.message);
    }

    const newTx: Transaction = {
      ...tx,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      created_at: new Date().toISOString()
    };
    mockDB.transactions.unshift(newTx);
    saveMockDB();
    return newTx;
  },

  async getTransactionsByUsernameOrAddress(identifier: string, limit = 10): Promise<Transaction[]> {
    const cleanId = identifier.toLowerCase();
    
    if (supabase) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`sender.eq.${cleanId},receiver.eq.${cleanId}`)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!error && data) return data as Transaction[];
    }

    const txs = mockDB.transactions.filter(
      t => t.sender.toLowerCase() === cleanId || 
           t.receiver.toLowerCase() === cleanId ||
           t.sender.toLowerCase() === '@' + cleanId ||
           t.receiver.toLowerCase() === '@' + cleanId
    );
    return txs.slice(0, limit);
  },

  // AI Conversations
  async createAIConversation(convo: Omit<AIConversation, 'id' | 'created_at'>): Promise<AIConversation> {
    if (supabase) {
      const { data, error } = await supabase.from('ai_conversations').insert([convo]).select().single();
      if (!error && data) return data as AIConversation;
      if (error) console.error('Supabase createAIConversation error:', error.message);
    }

    const newConvo: AIConversation = {
      ...convo,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      created_at: new Date().toISOString()
    };
    mockDB.ai_conversations.unshift(newConvo);
    saveMockDB();
    return newConvo;
  },

  async getAIConversationsByUserId(userId: string, limit = 50): Promise<AIConversation[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!error && data) return data as AIConversation[];
    }

    const found = mockDB.ai_conversations.filter(c => c.user_id === userId);
    return found.slice(0, limit);
  },

  async clearAIConversations(userId: string): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase.from('ai_conversations').delete().eq('user_id', userId);
      if (!error) return true;
      console.error('Supabase clearAIConversations error:', error.message);
    }

    mockDB.ai_conversations = mockDB.ai_conversations.filter(c => c.user_id !== userId);
    saveMockDB();
    return true;
  },

  // Teams
  async createTeam(name: string, walletAddress: string, ownerUserId: string): Promise<Team> {
    const formattedAddress = walletAddress.toLowerCase();
    if (supabase) {
      const { data, error } = await supabase
        .from('teams')
        .insert([{ name, wallet_address: formattedAddress }])
        .select()
        .single();
      if (!error && data) {
        const team = data as Team;
        await supabase.from('team_members').insert([{ team_id: team.id, user_id: ownerUserId, role: 'Owner' }]);
        return team;
      }
      if (error) console.error('Supabase createTeam error:', error.message);
    }

    const teamId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const newTeam: Team = {
      id: teamId,
      name,
      wallet_address: formattedAddress,
      created_at: new Date().toISOString()
    };
    mockDB.teams.push(newTeam);
    
    const memberId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    mockDB.team_members.push({
      id: memberId,
      team_id: teamId,
      user_id: ownerUserId,
      role: 'Owner',
      created_at: new Date().toISOString()
    });

    saveMockDB();
    return newTeam;
  },

  async getTeamByName(name: string): Promise<Team | null> {
    if (supabase) {
      const { data, error } = await supabase.from('teams').select('*').eq('name', name).maybeSingle();
      if (!error && data) return data as Team;
    }
    const found = mockDB.teams.find(t => t.name.toLowerCase() === name.toLowerCase());
    return found || null;
  },

  async addTeamMember(teamId: string, userId: string, role: 'Owner' | 'Admin' | 'Member' | 'Viewer'): Promise<TeamMember | null> {
    if (supabase) {
      const { data, error } = await supabase
        .from('team_members')
        .insert([{ team_id: teamId, user_id: userId, role }])
        .select()
        .single();
      if (!error && data) return data as TeamMember;
      if (error) console.error('Supabase addTeamMember error:', error.message);
    }

    const existing = mockDB.team_members.find(m => m.team_id === teamId && m.user_id === userId);
    if (existing) {
      existing.role = role;
      saveMockDB();
      return existing;
    }

    const newMember: TeamMember = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      team_id: teamId,
      user_id: userId,
      role,
      created_at: new Date().toISOString()
    };
    mockDB.team_members.push(newMember);
    saveMockDB();
    return newMember;
  },

  async getTeamMembers(teamId: string): Promise<{ member: TeamMember; user: User }[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('team_members')
        .select('*, users(*)')
        .eq('team_id', teamId);
      if (!error && data) {
        return (data as any[]).map(row => ({
          member: { id: row.id, team_id: row.team_id, user_id: row.user_id, role: row.role, created_at: row.created_at },
          user: row.users as User
        }));
      }
    }

    const members = mockDB.team_members.filter(m => m.team_id === teamId);
    return members.map(m => {
      const userObj = mockDB.users.find(u => u.id === m.user_id) || {
        id: m.user_id,
        username: 'unknown',
        wallet_address: '0x0000000000000000000000000000000000000000',
        recovery_wallet: '0x0000000000000000000000000000000000000000',
        created_at: new Date().toISOString()
      };
      return { member: m, user: userObj };
    });
  },

  async getUserTeams(userId: string): Promise<{ team: Team; role: string }[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('team_members')
        .select('*, teams(*)')
        .eq('user_id', userId);
      if (!error && data) {
        return (data as any[])
          .filter(row => row.teams !== null)
          .map(row => ({
            team: row.teams as Team,
            role: row.role
          }));
      }
    }

    const memberships = mockDB.team_members.filter(m => m.user_id === userId);
    return memberships.map(m => {
      const team = mockDB.teams.find(t => t.id === m.team_id) || {
        id: m.team_id,
        name: 'Deleted Team',
        wallet_address: '0x0000000000000000000000000000000000000000',
        created_at: new Date().toISOString()
      };
      return { team, role: m.role };
    });
  },

  // Scheduled Payments
  async createScheduledPayment(payment: Omit<ScheduledPayment, 'id' | 'created_at'>): Promise<ScheduledPayment> {
    if (supabase) {
      const { data, error } = await supabase
        .from('scheduled_payments')
        .insert([payment])
        .select()
        .single();
      if (!error && data) return data as ScheduledPayment;
      if (error) console.error('Supabase createScheduledPayment error:', error.message);
    }

    const newPayment: ScheduledPayment = {
      ...payment,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      created_at: new Date().toISOString()
    };
    mockDB.scheduled_payments.push(newPayment);
    saveMockDB();
    return newPayment;
  },

  async getScheduledPaymentsByUserId(userId: string): Promise<ScheduledPayment[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('scheduled_payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!error && data) return data as ScheduledPayment[];
    }
    return mockDB.scheduled_payments.filter(p => p.user_id === userId);
  },

  async updateScheduledPaymentStatus(paymentId: string, status: 'active' | 'paused' | 'cancelled' | 'completed', nextExecution?: string): Promise<boolean> {
    if (supabase) {
      const updateData: any = { status };
      if (nextExecution) updateData.next_execution = nextExecution;
      const { error } = await supabase
        .from('scheduled_payments')
        .update(updateData)
        .eq('id', paymentId);
      if (!error) return true;
      console.error('Supabase updateScheduledPaymentStatus error:', error.message);
    }

    const found = mockDB.scheduled_payments.find(p => p.id === paymentId);
    if (found) {
      found.status = status;
      if (nextExecution) found.next_execution = nextExecution;
      saveMockDB();
      return true;
    }
    return false;
  },

  async getAllDueScheduledPayments(): Promise<ScheduledPayment[]> {
    const now = new Date().toISOString();
    if (supabase) {
      const { data, error } = await supabase
        .from('scheduled_payments')
        .select('*')
        .eq('status', 'active')
        .lte('next_execution', now);
      if (!error && data) return data as ScheduledPayment[];
    }
    return mockDB.scheduled_payments.filter(p => p.status === 'active' && p.next_execution <= now);
  },

  // Contacts
  async createContact(contact: Omit<Contact, 'id' | 'created_at'>): Promise<Contact> {
    if (supabase) {
      const { data, error } = await supabase
        .from('contacts')
        .insert([contact])
        .select()
        .single();
      if (!error && data) return data as Contact;
      if (error) console.error('Supabase createContact error:', error.message);
    }

    const existingIndex = mockDB.contacts.findIndex(c => c.user_id === contact.user_id && c.contact_username.toLowerCase() === contact.contact_username.toLowerCase());
    const formattedContact: Contact = {
      ...contact,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      created_at: new Date().toISOString()
    };
    if (existingIndex > -1) {
      mockDB.contacts[existingIndex] = formattedContact;
    } else {
      mockDB.contacts.push(formattedContact);
    }
    saveMockDB();
    return formattedContact;
  },

  async getContactsByUserId(userId: string): Promise<Contact[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', userId)
        .order('contact_username', { ascending: true });
      if (!error && data) return data as Contact[];
    }
    return mockDB.contacts.filter(c => c.user_id === userId);
  },

  async getContactsByGroup(userId: string, groupName: string): Promise<Contact[]> {
    const cleanGroup = groupName.toLowerCase();
    if (supabase) {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', userId)
        .eq('group_name', cleanGroup);
      if (!error && data) return data as Contact[];
    }
    return mockDB.contacts.filter(c => c.user_id === userId && c.group_name?.toLowerCase() === cleanGroup);
  },

  async deleteContact(userId: string, contactUsername: string): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('user_id', userId)
        .eq('contact_username', contactUsername);
      if (!error) return true;
    }
    const lenBefore = mockDB.contacts.length;
    mockDB.contacts = mockDB.contacts.filter(c => !(c.user_id === userId && c.contact_username.toLowerCase() === contactUsername.toLowerCase()));
    saveMockDB();
    return mockDB.contacts.length < lenBefore;
  },

  // Wallet Memory
  async setWalletMemory(userId: string, key: string, value: any): Promise<WalletMemory> {
    if (supabase) {
      const { data, error } = await supabase
        .from('wallet_memory')
        .upsert({ user_id: userId, key, value })
        .select()
        .single();
      if (!error && data) return data as WalletMemory;
      if (error) console.error('Supabase setWalletMemory error:', error.message);
    }

    const existingIndex = mockDB.wallet_memory.findIndex(m => m.user_id === userId && m.key === key);
    const newMemory: WalletMemory = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      user_id: userId,
      key,
      value,
      created_at: new Date().toISOString()
    };
    if (existingIndex > -1) {
      mockDB.wallet_memory[existingIndex] = newMemory;
    } else {
      mockDB.wallet_memory.push(newMemory);
    }
    saveMockDB();
    return newMemory;
  },

  async getWalletMemory(userId: string, key: string): Promise<WalletMemory | null> {
    if (supabase) {
      const { data, error } = await supabase
        .from('wallet_memory')
        .select('*')
        .eq('user_id', userId)
        .eq('key', key)
        .maybeSingle();
      if (!error && data) return data as WalletMemory;
    }
    const found = mockDB.wallet_memory.find(m => m.user_id === userId && m.key === key);
    return found || null;
  }
}
