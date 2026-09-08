-- Integração Memed: prescrição digital assinada, restrita a profissionais
-- Cada profissional possui seu próprio token pessoal Memed (obtido em memed.com.br)
-- e pode habilitar/desabilitar a exibição do botão de prescrição digital.

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS memed_token text,
  ADD COLUMN IF NOT EXISTS memed_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.professionals.memed_token IS 'Token de integração pessoal do profissional na Memed (obtido em memed.com.br). Usado para carregar o widget de prescrição digital.';
COMMENT ON COLUMN public.professionals.memed_enabled IS 'Indica se o profissional habilitou a prescrição digital via Memed.';
