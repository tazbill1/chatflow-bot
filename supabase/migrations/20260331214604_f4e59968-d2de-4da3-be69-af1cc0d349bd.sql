ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS business text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contact_preference text;