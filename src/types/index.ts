export interface User {
  id: string;
  username: string;
  wallet_address: string;
  recovery_wallet: string;
  created_at: string;
}

export interface Username {
  username: string;
  user_id: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
}

export interface Transaction {
  id: string;
  sender: string; // @username or address
  receiver: string; // @username or address
  amount: number;
  status: 'pending' | 'success' | 'failed';
  hash: string;
  created_at: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  message: string;
  response: string;
  created_at: string;
}

export interface SafetySettings {
  id: string;
  user_id: string;
  daily_limit: number;
  high_value_threshold: number;
  whitelist: string[];
  blacklist: string[];
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  wallet_address: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'Owner' | 'Admin' | 'Member' | 'Viewer';
  created_at: string;
}

export interface ScheduledPayment {
  id: string;
  user_id: string;
  recipient: string;
  recipient_username?: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'once';
  next_execution: string;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  created_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  contact_username: string;
  contact_address: string;
  role?: string;
  group_name?: string;
  notes?: string;
  created_at: string;
}

export interface WalletMemory {
  id: string;
  user_id: string;
  key: string;
  value: any;
  created_at: string;
}
