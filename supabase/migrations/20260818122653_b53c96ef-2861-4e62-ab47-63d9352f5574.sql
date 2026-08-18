
  INSERT INTO public.employer_contributions (
    employer_id, clinic_id, contribution_type_id, competence_month, competence_year, 
    due_date, value, status, notes, origin, is_editable
  )
  SELECT 
    '0ca3d458-401f-40ce-b31f-0c75a7a8afda', -- Target MASTER CENTER ID
    clinic_id, 
    contribution_type_id, 
    competence_month, 
    competence_year, 
    due_date, 
    value, 
    status, 
    'Copiado de ARILUZ (41996539000120)', 
    'manual', 
    true
  FROM public.employer_contributions 
  WHERE employer_id = '0abea3f4-e670-4647-a3e5-14a0315fe1f5';
