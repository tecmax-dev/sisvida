-- Adicionar novo valor 'blocked' ao enum appointment_status
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'blocked';