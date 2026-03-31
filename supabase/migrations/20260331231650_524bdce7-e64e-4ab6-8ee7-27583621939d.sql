
-- Drop overly permissive anon policies on leads
DROP POLICY IF EXISTS "Allow anonymous select on leads" ON public.leads;
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.leads;

-- Drop overly permissive anon policies on chat_sessions
DROP POLICY IF EXISTS "Allow anonymous select on chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow anonymous update" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.chat_sessions;
