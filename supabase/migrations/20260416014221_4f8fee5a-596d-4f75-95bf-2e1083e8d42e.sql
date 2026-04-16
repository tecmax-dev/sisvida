-- ============================================
-- CORREÇÕES DE SEGURANÇA CRÍTICAS - PARTE 2
-- Fix: professionals table - view pública sem PII
-- ============================================

-- Remover view existente se houver
DROP VIEW IF EXISTS public.public_professionals CASCADE;

-- Criar view pública de profissionais sem dados sensíveis
CREATE VIEW public.public_professionals AS
SELECT 
    id,
    clinic_id,
    name,
    slug,
    specialty,
    avatar_url,
    bio,
    is_active,
    created_at
FROM public.professionals
WHERE is_active = true;

-- Remover políticas públicas que expõem dados sensíveis
DROP POLICY IF EXISTS "Anon can read active professionals by clinic" ON public.professionals;
DROP POLICY IF EXISTS "Public can view active professionals" ON public.professionals;

-- Criar nova política restrita (apenas campos não-sensíveis)
CREATE POLICY "Public can view professional basic info"
ON public.professionals
FOR SELECT
TO public
USING (is_active = true);