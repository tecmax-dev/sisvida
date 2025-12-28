-- Adicionar campos para modo manutenção (separado do bloqueio)
ALTER TABLE public.clinics
ADD COLUMN IF NOT EXISTS is_maintenance boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS maintenance_reason text,
ADD COLUMN IF NOT EXISTS maintenance_at timestamptz,
ADD COLUMN IF NOT EXISTS maintenance_by uuid;