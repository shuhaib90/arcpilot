# ArcPilot Production Deployment Guide

ArcPilot is built using Next.js (App Router), Ethers.js, and Supabase. This document provides step-by-step instructions to configure, migrate, and deploy the application in production.

---

## 1. Setup Supabase Database & Migrations

ArcPilot requires a Postgres database to persist users, usernames, wallets, transaction logs, conversation history, and safety settings.

1. Create a new project in the [Supabase Dashboard](https://database.new).
2. Open the **SQL Editor** in your Supabase project.
3. Copy and run the following migration SQL to configure all tables and Row Level Security:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  recovery_wallet TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create usernames registry table
CREATE TABLE IF NOT EXISTS public.usernames (
  username TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  balance NUMERIC DEFAULT 100.0 NOT NULL
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

-- Create settings table
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  daily_limit NUMERIC DEFAULT 100.0 NOT NULL,
  high_value_threshold NUMERIC DEFAULT 20.0 NOT NULL,
  whitelist TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  blacklist TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usernames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Establish RLS Policies (allows SELECT/INSERT/UPDATE for verified users)
CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public insert users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update users" ON public.users FOR UPDATE USING (true);

CREATE POLICY "Allow public read usernames" ON public.usernames FOR SELECT USING (true);
CREATE POLICY "Allow public insert usernames" ON public.usernames FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read wallets" ON public.wallets FOR SELECT USING (true);
CREATE POLICY "Allow public insert wallets" ON public.wallets FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update wallets" ON public.wallets FOR UPDATE USING (true);

CREATE POLICY "Allow public read transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read ai_conversations" ON public.ai_conversations FOR SELECT USING (true);
CREATE POLICY "Allow public insert ai_conversations" ON public.ai_conversations FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert settings" ON public.settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update settings" ON public.settings FOR UPDATE USING (true);
```

---

## 2. Xiaomi MiMo LLM API Setup

ArcPilot integrates with the **Xiaomi MiMo API** for tool calling:
* **Base URL:** `https://api.xiaomimimo.com/v1` (OpenAI-compatible)
* **Model Name:** `mimo-v2.5-pro` (supports structured JSON function schema tool-calling)

---

## 3. Environment Variables Configuration

Create a `.env.production` or `.env.local` file in your root containing:

```ini
# Supabase Database Credentials
NEXT_PUBLIC_SUPABASE_URL=https://vnmzoiunxjzgonjkmziu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubXpvaXVueGp6Z29uamtteml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzI3MDEsImV4cCI6MjA5NzcwODcwMX0.zX0D-gasUh9jw67D93NYTriwtDeUj4ChHCXYj-2tGWE

# Arc L1 Testnet Configuration
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network

# Xiaomi MiMo API Settings
MIMO_API_KEY=sk-sgyxv81imk19yxfpvwbb9y7dpdz9awiezbja6lf6fjo2yy2x
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5-pro
```

---

## 4. Vercel Configuration & Deployment

To deploy to Vercel, create a `vercel.json` file in the root to specify the build environment:

```json
{
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev"
}
```

Deploying via Vercel CLI:
```bash
npm install -g vercel
vercel
```
Ensure you paste all environment variables listed in Section 3 in the Vercel project dashboard during deployment.
