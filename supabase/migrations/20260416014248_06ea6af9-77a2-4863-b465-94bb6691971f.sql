-- ============================================
-- CORREÇÕES DE SEGURANÇA CRÍTICAS - PARTE 3 (CORRIGIDA)
-- Fix: union_authorizations - remover política anon INSERT perigosa
-- ============================================

-- Remover política anon INSERT perigosa
DROP POLICY IF EXISTS "Mobile app can create self-service authorizations" ON public.union_authorizations;
DROP POLICY IF EXISTS "Anon can create authorizations with valid token" ON public.union_authorizations;
DROP POLICY IF EXISTS "Public can create self-service authorizations" ON public.union_authorizations;

-- Criar nova política mais restrita (apenas valida existência do paciente)
CREATE POLICY "Mobile app can create self-service authorizations"
ON public.union_authorizations
FOR INSERT
TO anon
WITH CHECK (
    patient_id IS NOT NULL 
    AND created_by IS NOT NULL 
    AND created_by = patient_id
    AND EXISTS (
        SELECT 1 FROM public.patients p 
        WHERE p.id = patient_id 
        AND p.cpf IS NOT NULL  -- Paciente deve ter CPF cadastrado
        AND p.clinic_id = union_authorizations.clinic_id
    )
);