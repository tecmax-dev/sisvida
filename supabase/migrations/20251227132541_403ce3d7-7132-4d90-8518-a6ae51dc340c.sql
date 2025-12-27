-- Create email_confirmations table for email verification flow
CREATE TABLE public.email_confirmations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Add index for token lookups
CREATE INDEX idx_email_confirmations_token ON public.email_confirmations(token);
CREATE INDEX idx_email_confirmations_user_id ON public.email_confirmations(user_id);

-- Enable RLS
ALTER TABLE public.email_confirmations ENABLE ROW LEVEL SECURITY;

-- Allow public read for token verification (no auth required for email confirmation)
CREATE POLICY "Allow public read by token" 
ON public.email_confirmations 
FOR SELECT 
USING (true);

-- Allow public update for confirmation (by token)
CREATE POLICY "Allow public update by token" 
ON public.email_confirmations 
FOR UPDATE 
USING (true);

-- Allow authenticated insert
CREATE POLICY "Allow authenticated insert" 
ON public.email_confirmations 
FOR INSERT 
WITH CHECK (true);

-- Add email_confirmed field to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN DEFAULT false;