CREATE OR REPLACE FUNCTION public.generate_professional_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  base_slug := regexp_replace(lower(unaccent(NEW.name)), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  IF base_slug IS NULL OR base_slug = '' THEN
    base_slug := 'profissional';
  END IF;
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
$function$;

UPDATE public.homologacao_professionals p
SET slug = trim(both '-' from regexp_replace(lower(unaccent(p.name)), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS DISTINCT FROM trim(both '-' from regexp_replace(lower(unaccent(p.name)), '[^a-z0-9]+', '-', 'g'))
  AND NOT EXISTS (
    SELECT 1 FROM public.homologacao_professionals q
    WHERE q.id <> p.id
      AND q.slug = trim(both '-' from regexp_replace(lower(unaccent(p.name)), '[^a-z0-9]+', '-', 'g'))
  );