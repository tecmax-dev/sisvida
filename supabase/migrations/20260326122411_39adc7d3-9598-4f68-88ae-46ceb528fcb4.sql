INSERT INTO patients (
  clinic_id, name, cpf, email, phone, birth_date, gender,
  street, street_number, neighborhood, city, state, cep,
  employer_cnpj, employer_name,
  is_active, is_union_member, notes
) VALUES (
  '89e7585e-7bce-4e58-91fa-c37080d1170d',
  'Daiana Reis de Carvalho',
  '02654402541',
  'daianareisdecarvalho@gmail.com',
  '73981937533',
  NULL,
  'feminino',
  'RUA CAMPO VERDE',
  '431',
  'Teotônio Vilela',
  'ILHEUS',
  'BA',
  '45657060',
  '30785010000140',
  'MERCADO BEM MELHOR',
  true,
  true,
  'Cadastrado via correção de sincronização. Data de nascimento original inválida (2026-03-26).'
) ON CONFLICT DO NOTHING;