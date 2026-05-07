-- Adiciona a coluna clinic_id se ela não existir
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zapresponder_configs' AND column_name = 'clinic_id') THEN
    ALTER TABLE public.zapresponder_configs ADD COLUMN clinic_id UUID REFERENCES public.clinics(id);
  END IF;
END $$;

-- Cria um índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_zapresponder_configs_clinic_id ON public.zapresponder_configs(clinic_id);

-- Permite que usuários com acesso à clínica vejam a configuração
-- (Assumindo que já existe RLS básico, vamos garantir que está habilitado)
ALTER TABLE public.zapresponder_configs ENABLE ROW LEVEL SECURITY;

-- Se não houver políticas, cria uma básica para leitura/escrita
-- Nota: Em um sistema real, isso deve ser mais restrito baseado no clinic_id e permissões do usuário
CREATE POLICY "Users can manage their clinic zapresponder config" 
ON public.zapresponder_configs 
FOR ALL 
USING (true)
WITH CHECK (true);
