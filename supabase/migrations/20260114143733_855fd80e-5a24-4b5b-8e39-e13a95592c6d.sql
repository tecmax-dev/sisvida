-- Enable pgcrypto extension for password hashing functions (gen_salt, crypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;