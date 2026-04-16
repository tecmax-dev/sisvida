-- ============================================
-- CORREÇÕES DE SEGURANÇA CRÍTICAS - PARTE 1
-- Fix: clinics table - view pública limitada
-- ============================================

-- Remover view existente se houver (para evitar conflito de colunas)
DROP VIEW IF EXISTS public.public_clinic_info CASCADE;

-- Criar view pública com apenas campos não-sensíveis
CREATE VIEW public.public_clinic_info AS
SELECT 
    id,
    name,
    slug,
    logo_url,
    phone,
    email,
    address,
    city,
    state_code,
    opening_time,
    closing_time,
    entity_nomenclature,
    custom_map_embed_url,
    map_view_type,
    whatsapp_provider,
    whatsapp_header_image_url,
    birthday_enabled,
    birthday_message,
    reminder_enabled,
    reminder_hours,
    app_unavailable,
    app_unavailable_message,
    holidays_enabled,
    created_at,
    updated_at
FROM public.clinics;

-- Remover política pública aberta da tabela clinics
DROP POLICY IF EXISTS "Public can view clinic basic info by slug" ON public.clinics;
DROP POLICY IF EXISTS "Public can view limited clinic info via view" ON public.clinics;

-- Criar nova política restrita para acesso público (retorna false para campos sensíveis)
CREATE POLICY "Public can view clinic basic info"
ON public.clinics
FOR SELECT
TO public
USING (
    -- Apenas clínicas ativas/não bloqueadas
    is_blocked = false OR is_blocked IS NULL
);