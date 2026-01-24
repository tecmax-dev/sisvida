-- Update create_first_access_token function to use 60 minutes expiration
CREATE OR REPLACE FUNCTION public.create_first_access_token(p_patient_id UUID, p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Generate 6-digit code
  v_token := lpad(floor(random() * 1000000)::text, 6, '0');
  
  -- Delete any existing unused tokens for this email
  DELETE FROM public.first_access_tokens 
  WHERE email = lower(trim(p_email)) AND used_at IS NULL;
  
  -- Insert new token with 60 minutes expiration
  INSERT INTO public.first_access_tokens (patient_id, token, email, expires_at)
  VALUES (p_patient_id, v_token, lower(trim(p_email)), now() + interval '60 minutes');
  
  RETURN v_token;
END;
$$;