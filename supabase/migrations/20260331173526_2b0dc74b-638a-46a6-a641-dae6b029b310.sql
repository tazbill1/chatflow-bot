
-- Leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sales', 'service')),
  summary TEXT,
  conversation JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Allow edge functions (anon) to insert leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous insert" ON public.leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON public.leads FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Conversation analytics table
CREATE TABLE public.chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  first_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  topics TEXT[],
  led_to_lead BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous insert" ON public.chat_sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update" ON public.chat_sessions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON public.chat_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
