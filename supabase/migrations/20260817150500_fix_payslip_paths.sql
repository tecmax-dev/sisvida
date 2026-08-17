-- Migration to fix payslip attachment paths that were incorrectly recorded
-- Cruzamento de dados entre patient_attachments (onde o arquivo real é registrado) 
-- e payslip_requests (onde o sistema busca o arquivo para revisão)

WITH CorrectedPaths AS (
    SELECT 
        pa.patient_id,
        REPLACE(pa.file_path, 'contra-cheques:', '') as real_storage_path,
        pa.created_at as pa_created_at
    FROM public.patient_attachments pa
    WHERE pa.file_path LIKE 'contra-cheques:%'
)
UPDATE public.payslip_requests pr
SET attachment_path = cp.real_storage_path
FROM CorrectedPaths cp
WHERE pr.patient_id = cp.patient_id
  AND pr.status = 'received'
  AND pr.attachment_path IS NOT NULL
  AND pr.attachment_path != cp.real_storage_path
  AND pr.created_at >= (cp.pa_created_at - interval '10 minutes')
  AND pr.created_at <= (cp.pa_created_at + interval '10 minutes');

-- Adicionando log de auditoria simples para conferência
INSERT INTO public.system_logs (event_type, description)
VALUES ('MAINTENANCE', 'Payslip attachment paths recovery executed');
