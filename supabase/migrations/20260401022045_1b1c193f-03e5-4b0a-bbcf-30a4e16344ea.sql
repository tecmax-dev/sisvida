-- Fix SECURITY DEFINER view issue
ALTER VIEW public.homologacao_availability SET (security_invoker = true);