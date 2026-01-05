-- Add down_payment_due_date column to debt_negotiations
ALTER TABLE public.debt_negotiations
ADD COLUMN down_payment_due_date date;