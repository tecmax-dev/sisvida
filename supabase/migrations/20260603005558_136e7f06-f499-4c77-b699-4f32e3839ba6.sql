-- Limpa o telefone 73988633535 / 557388633535 de todos os pacientes que NÃO são o titular real (CPF 55905552568 - SERGIO NASCIMENTO DE JESUS).
-- Isso permite que o fluxo do WhatsApp identifique automaticamente o associado pelo número.
UPDATE public.patients
SET phone = NULL,
    updated_at = now()
WHERE phone IN ('73988633535', '557388633535')
  AND (cpf IS DISTINCT FROM '55905552568');