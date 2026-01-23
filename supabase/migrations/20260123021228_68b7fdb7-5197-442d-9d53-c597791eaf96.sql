-- Add "autorizacoes" tab to mobile_app_tabs if it doesn't exist
INSERT INTO public.mobile_app_tabs (tab_key, tab_name, tab_category, is_active, order_index)
SELECT 'autorizacoes', 'Autorizações', 'servicos', true, 
       COALESCE((SELECT MAX(order_index) FROM public.mobile_app_tabs WHERE tab_category = 'servicos'), 0) + 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.mobile_app_tabs WHERE tab_key = 'autorizacoes'
);

-- Add RLS policy to allow member portal to read union_authorizations by patient_id
CREATE POLICY "Members can view their own authorizations"
ON public.union_authorizations
FOR SELECT
TO anon
USING (
  patient_id IN (
    SELECT id FROM public.patients WHERE id = patient_id
  )
);