-- Remove duplicatas mantendo apenas o registro mais recente (baseado em created_at)
DELETE FROM public.medical_records
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY clinic_id, patient_id, record_date 
             ORDER BY created_at DESC
           ) as rn
    FROM public.medical_records
  ) sub
  WHERE rn > 1
);

-- Cria índice único para prevenir duplicatas em importações futuras
CREATE UNIQUE INDEX IF NOT EXISTS medical_records_unique_import
ON public.medical_records (clinic_id, patient_id, record_date);