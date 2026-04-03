
-- Drop the simple list function, replace with a search function
DROP FUNCTION IF EXISTS public.list_employers_for_filiacao(uuid);

CREATE OR REPLACE FUNCTION public.search_employers_for_filiacao(
  _clinic_id uuid,
  _search_term text DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, trade_name text, cnpj text, address text, registration_number text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.name, e.trade_name, e.cnpj, e.address, e.registration_number
  FROM public.employers e
  WHERE e.clinic_id = _clinic_id
    AND e.is_active = true
    AND (
      _search_term IS NULL
      OR e.name ILIKE '%' || _search_term || '%'
      OR e.trade_name ILIKE '%' || _search_term || '%'
      OR e.cnpj ILIKE '%' || _search_term || '%'
    )
  ORDER BY e.name
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.search_employers_for_filiacao(uuid, text) TO anon, authenticated;
