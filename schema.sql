-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  recovery_wallet TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  balance NUMERIC DEFAULT 0.0 NOT NULL
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender TEXT NOT NULL,
  receiver TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create ai_conversations table
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies allowing all operations for SELECT/INSERT/UPDATE for simple integration
CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public insert users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update users" ON public.users FOR UPDATE USING (true);

CREATE POLICY "Allow public read wallets" ON public.wallets FOR SELECT USING (true);
CREATE POLICY "Allow public insert wallets" ON public.wallets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update wallets" ON public.wallets FOR UPDATE USING (true);

CREATE POLICY "Allow public read transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read ai_conversations" ON public.ai_conversations FOR SELECT USING (true);
CREATE POLICY "Allow public insert ai_conversations" ON public.ai_conversations FOR INSERT WITH CHECK (true);
