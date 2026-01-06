-- Remove o trigger que força erro em CPF duplicado (permitindo UPSERT funcionar)
DROP TRIGGER IF EXISTS trigger_check_cpf_duplicate ON public.patients;

-- A função check_cpf_duplicate() permanece para uso em outros contextos se necessário
-- mas o trigger não vai mais bloquear a importação em massa