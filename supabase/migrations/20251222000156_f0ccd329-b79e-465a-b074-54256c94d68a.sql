-- Gerar slugs para profissionais existentes sem slug
UPDATE professionals
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      TRANSLATE(name, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiioooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
      '[^a-zA-Z0-9]+', '-', 'g'
    ),
    '^-|-$', '', 'g'
  )
)
WHERE slug IS NULL;