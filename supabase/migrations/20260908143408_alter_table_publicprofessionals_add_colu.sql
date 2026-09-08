-- Migration criada automaticamente pelo LOV3 em 2026-09-08T14:34:08.855Z
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS memed_token text,
  ADD COLUMN IF NOT EXISTS memed_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.professionals.memed_token IS 'Token de integração pessoal do profissional na Memed (obtido em memed.com.br). Usado para carregar o widget de prescrição digital.';
COMMENT ON COLUMN public.professionals.memed_enabled IS 'Indica se o profissional habilitou a prescrição digital via Memed.';