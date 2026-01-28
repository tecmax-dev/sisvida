-- Permitir valores nulos na coluna phone da tabela patients
ALTER TABLE public.patients ALTER COLUMN phone DROP NOT NULL;