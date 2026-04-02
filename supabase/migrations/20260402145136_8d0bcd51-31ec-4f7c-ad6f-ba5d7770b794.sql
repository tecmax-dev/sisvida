UPDATE public.appointments 
SET status = 'cancelled', 
    cancellation_reason = 'Conflito de horário - horário sobreposto com outro agendamento confirmado', 
    cancelled_at = now(),
    updated_at = now()
WHERE id = 'c20fc367-beb2-451a-97de-d8446ba9096f';