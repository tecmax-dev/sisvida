-- Add prior notice date field to homologacao_appointments
ALTER TABLE public.homologacao_appointments
ADD COLUMN employee_prior_notice_date DATE;