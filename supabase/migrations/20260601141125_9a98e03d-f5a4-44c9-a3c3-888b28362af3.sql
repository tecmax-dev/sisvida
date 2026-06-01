UPDATE public.employer_contributions
SET status = CASE WHEN due_date < CURRENT_DATE THEN 'overdue' ELSE 'pending' END,
    paid_at = NULL,
    paid_value = NULL,
    payment_method = NULL,
    notes = concat('[AUDITORIA LYTEX ', to_char(now(),'YYYY-MM-DD'), '] Revertido manualmente - fatura Lytex 6a0666daae9fbc159f4f6968 não está paga. ', coalesce(notes,''))
WHERE id = '30743f56-cd65-4dda-99a2-922fe7914060';