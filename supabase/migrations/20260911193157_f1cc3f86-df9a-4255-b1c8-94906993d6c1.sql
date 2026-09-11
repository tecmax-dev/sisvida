CREATE OR REPLACE FUNCTION public.get_contribution_by_public_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', ec.id,
    'status', ec.status,
    'value', ec.value,
    'due_date', ec.due_date,
    'competence_month', ec.competence_month,
    'competence_year', ec.competence_year,
    'lytex_invoice_url', ec.lytex_invoice_url,
    'employer_id', ec.employer_id,
    'contribution_type_id', ec.contribution_type_id,
    'clinic_id', ec.clinic_id,
    'employer_name', e.name,
    'employer_cnpj', e.cnpj
  ) INTO result
  FROM public.employer_contributions ec
  LEFT JOIN public.employers e ON e.id = ec.employer_id
  WHERE ec.public_access_token = p_token
  LIMIT 1;

  RETURN result;
END;
$$;