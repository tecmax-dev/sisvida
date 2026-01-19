
-- =====================================================
-- SECURITY FIX: Adicionar search_path às funções
-- =====================================================

-- 1. Dropar triggers que dependem das funções ANTES de dropar as funções
DROP TRIGGER IF EXISTS trigger_block_union_paid_delete ON public.union_financial_transactions;
DROP TRIGGER IF EXISTS trigger_professional_slug ON public.homologacao_professionals;

-- 2. block_union_paid_transaction_delete - Dropar CASCADE e recriar
DROP FUNCTION IF EXISTS public.block_union_paid_transaction_delete() CASCADE;
CREATE FUNCTION public.block_union_paid_transaction_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'paid' THEN
    RAISE EXCEPTION 'Não é possível excluir transações pagas. Utilize o estorno.';
  END IF;
  RETURN OLD;
END;
$$;

-- 3. generate_professional_slug
DROP FUNCTION IF EXISTS public.generate_professional_slug() CASCADE;
CREATE FUNCTION public.generate_professional_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  base_slug := lower(regexp_replace(unaccent(NEW.name), '[^a-z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;
  WHILE EXISTS (
    SELECT 1 FROM public.homologacao_professionals 
    WHERE slug = final_slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

-- 4. normalize_check_number (tem argumento text)
DROP FUNCTION IF EXISTS public.normalize_check_number(text) CASCADE;
CREATE FUNCTION public.normalize_check_number(check_num text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF check_num IS NULL OR check_num = '' THEN
    RETURN NULL;
  END IF;
  RETURN regexp_replace(trim(check_num), '[^0-9]', '', 'g');
END;
$$;

-- 5. prevent_paid_transaction_delete
DROP FUNCTION IF EXISTS public.prevent_paid_transaction_delete() CASCADE;
CREATE FUNCTION public.prevent_paid_transaction_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'paid' THEN
    RAISE EXCEPTION 'Não é permitido excluir transações pagas. Use estorno.';
  END IF;
  RETURN OLD;
END;
$$;

-- 6. generate_contribution_access_token (retorna text)
DROP FUNCTION IF EXISTS public.generate_contribution_access_token() CASCADE;
CREATE FUNCTION public.generate_contribution_access_token()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN encode(gen_random_bytes(24), 'base64');
END;
$$;

-- 7. Recriar triggers que foram dropados
CREATE TRIGGER trigger_block_union_paid_delete
  BEFORE DELETE ON public.union_financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.block_union_paid_transaction_delete();

CREATE TRIGGER trigger_professional_slug
  BEFORE INSERT OR UPDATE OF name ON public.homologacao_professionals
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_professional_slug();
