
-- 1) employer_contributions: índices compostos para filtros + ordenação
CREATE INDEX IF NOT EXISTS idx_employer_contributions_clinic_status
  ON public.employer_contributions (clinic_id, status);

CREATE INDEX IF NOT EXISTS idx_employer_contributions_clinic_competence_ordered
  ON public.employer_contributions (clinic_id, competence_year DESC, competence_month DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employer_contributions_clinic_member
  ON public.employer_contributions (clinic_id, member_id);

CREATE INDEX IF NOT EXISTS idx_employer_contributions_clinic_employer
  ON public.employer_contributions (clinic_id, employer_id);

-- 2) medical_records: faltava índice direto por clinic_id
CREATE INDEX IF NOT EXISTS idx_medical_records_clinic
  ON public.medical_records (clinic_id);

CREATE INDEX IF NOT EXISTS idx_medical_records_clinic_patient_date
  ON public.medical_records (clinic_id, patient_id, record_date DESC);

-- 3) whatsapp_incoming_logs: filtro/ordenação por clinic_id + tempo
CREATE INDEX IF NOT EXISTS idx_whatsapp_incoming_logs_clinic_created
  ON public.whatsapp_incoming_logs (clinic_id, created_at DESC);

-- 4) patients: índice para ordenação alfabética dentro da clínica (listagens grandes)
CREATE INDEX IF NOT EXISTS idx_patients_clinic_name
  ON public.patients (clinic_id, name);

-- 5) Atualizar estatísticas (planner) das tabelas afetadas
ANALYZE public.employer_contributions;
ANALYZE public.medical_records;
ANALYZE public.whatsapp_incoming_logs;
ANALYZE public.patients;
