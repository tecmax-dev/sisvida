-- Add missing email column to profiles for compatibility with source project
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;