---
name: Password Reset System
description: Authorization rules for admin password resets, mobile app SMS recovery, and CPF-based PWA flow
type: feature
---

## Admin (sistema /auth)
- Reset por email/WhatsApp via `admin-send-password-reset` (Locaweb SMTP + Evolution).
- Apenas super_admin, owner, admin ou usuários com `manage_users`/`change_password`.

## PWA /sindicato — recuperação por email
- Fluxo: email → código (WhatsApp ou SMS) → ano de nascimento → nova senha.
- RPC: `reset_patient_password_by_code(p_email, p_code, p_birth_year, p_new_password)`.

## PWA /sindicato — recuperação por CPF (modo padrão)
- Fluxo: CPF → SMS automático no telefone do titular → código → nova senha (SEM ano de nascimento).
- Edge function `send-password-reset-email` aceita `{ cpf, channel:"sms" }`: resolve CPF → patient ativo → reusa `create_password_reset_token` e dispara APIBrasil `sms/sendSimpleSms`.
- RPC: `reset_patient_password_by_cpf_code(p_cpf, p_code, p_new_password)` — valida CPF + token + expiração, atualiza `patients.password_hash` com `crypt(bf)`.
- Resposta SEMPRE genérica para CPF não encontrado (anti-enumeração).
- SMS via APIBrasil exige `APIBRASIL_BEARER_TOKEN` + `APIBRASIL_SMS_DEVICE_TOKEN`.

## Token
- Tabela: `patient_password_resets` (token = código 6 dígitos, expira 30 min, used_at marca consumo).
