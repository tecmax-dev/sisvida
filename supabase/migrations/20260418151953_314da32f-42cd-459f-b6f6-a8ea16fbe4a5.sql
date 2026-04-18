DO $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt('Sup3rAdm!n#643CLY2026', gen_salt('bf')),
      updated_at = now()
  WHERE id = '67946ebd-ba8a-422d-812a-39f557aca850';
END $$;