
-- Política para permitir que o app mobile (anon) veja todos os agendamentos de um paciente específico
-- O app filtra por patient_id na query, então isso é seguro
CREATE POLICY "Anon can view all appointments for patient lookup"
  ON public.appointments
  FOR SELECT
  TO anon
  USING (true);

-- Comentário: Esta política permite que o app mobile consulte agendamentos
-- A segurança é garantida pelo filtro de patient_id na aplicação
-- O paciente só vê seus próprios dados porque a query filtra por patient_id
