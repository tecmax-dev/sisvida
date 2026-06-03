## Objetivo

Permitir que o usuário recupere a senha informando apenas o CPF. O sistema localiza o telefone do titular, envia um código de 6 dígitos via SMS (APIBrasil – plano "SMS Avulso"), valida o código e gera um link mágico de recovery do Supabase para o usuário definir a nova senha.

Escopo: PWA `/sindicato` (titulares) **e** admin `/auth` (usuários do sistema).

---

## Fluxo do usuário

```text
1. Tela "Esqueci a senha"  →  digita CPF
2. Backend acha telefone, gera código 6 dígitos, envia SMS
3. UI mostra input do código  +  contador de reenvio (60s)
4. Usuário digita código  →  validação
5. Backend troca código por link de recovery (Supabase admin.generateLink)
6. Frontend redireciona para link → tela /reset-password (nova senha)
```

Mensagem de resposta sempre genérica ("Se houver cadastro, enviaremos um SMS") para evitar enumeração de CPF.

---

## Backend

### Tabela `password_reset_sms_codes`

| coluna | tipo | observação |
|---|---|---|
| id | uuid pk | |
| cpf_digits | text | só dígitos, indexado |
| phone_masked | text | só exibição (ex: ••••1234) |
| code_hash | text | SHA‑256 do código (nunca armazenar em claro) |
| scope | text | `pwa` ou `admin` |
| attempts | int default 0 | máx 5 |
| expires_at | timestamptz | now() + 10min |
| consumed_at | timestamptz null | marca uso |
| created_at | timestamptz default now() | |
| ip | text null | rate-limit |

RLS: bloqueio total para `anon`/`authenticated`. Acesso só via service_role nas edge functions.

### Edge function `password-reset-sms-request`

Pública (verify_jwt=false). Recebe `{ cpf, scope }`.

1. Normaliza CPF (só dígitos), valida tamanho.
2. Rate-limit: máx 3 pedidos/hora por CPF e por IP (consulta a própria tabela).
3. Busca telefone:
   - `scope=pwa` → `members.phone` (where digits(cpf)=...) com fallback em `sindical_associados.telefone` e `patients.phone`.
   - `scope=admin` → `profiles.phone` via `user_roles → auth.users`, com fallback CPF.
4. Se não achar telefone válido, retorna 200 genérico (sem revelar).
5. Gera código `crypto.getRandomValues` 6 dígitos, salva `sha256(code)` na tabela.
6. Envia SMS via `apibrasil-proxy` reaproveitado (parametrizando `endpoint` para o serviço de SMS avulso) ou chamada direta usando `APIBRASIL_BEARER_TOKEN` + `APIBRASIL_SMS_DEVICE_TOKEN` quando aplicável.
7. Mensagem: `"ProsindWeb: seu código de recuperação é 123456. Validade 10 min. Não compartilhe."`
8. Sempre retorna `{ ok: true, masked_phone }`.

### Edge function `password-reset-sms-verify`

Pública. Recebe `{ cpf, code, scope }`.

1. Busca registro mais recente não consumido e não expirado.
2. Incrementa `attempts`; bloqueia após 5 tentativas.
3. Compara `sha256(code)` em tempo constante.
4. Marca `consumed_at` e gera link Supabase: `admin.generateLink({ type:'recovery', email })`.
   - `scope=pwa`: email = `members.email` (ou pseudo-email do titular se for o fluxo mobile sem auth – usar reset interno do PWA).
   - `scope=admin`: email do `auth.users` correspondente.
5. Retorna `{ ok:true, action_link }`.

### Edge function existente `apibrasil-proxy`

Sem alteração estrutural; o novo serviço de SMS reaproveita a função enviando `endpoint` adequado e payload `{ number, message, device }` conforme o plano contratado. Se o plano SMS exigir endpoint dedicado (ex.: `sms/send`), eu uso o proxy passando esse path.

> ⚠️ Como você informou apenas "SMS avulso" sem confirmar o endpoint da APIBrasil, vou implementar o cliente parametrizado e deixar o **endpoint configurável via secret** `APIBRASIL_SMS_ENDPOINT` (default `sms/send`). Se a APIBrasil exigir token de dispositivo separado (`DeviceToken`), você adiciona `APIBRASIL_SMS_DEVICE_TOKEN` e o proxy injeta no header.

---

## Frontend

### Componentes novos

- `src/components/auth/ForgotPasswordSmsDialog.tsx` – fluxo em 2 passos (CPF → código), reaproveitável.
- `src/lib/passwordResetSmsService.ts` – client tipado que chama as duas edge functions.

### Integrações

- **Admin `/auth`** (`src/pages/ProfessionalAuth.tsx` ou equivalente): substituir/agregar o "Esqueci minha senha" para abrir o novo diálogo com `scope='admin'`.
- **PWA `/sindicato`** (`src/pages/mobile/MobileAuthPage.tsx`): botão "Recuperar senha" abre o diálogo com `scope='pwa'`. Após sucesso, redireciona para o `action_link` (que cai em `/reset-password` ou `/sindicato/reset-password`).
- Garantir página `/reset-password` existente lida com `type=recovery`; se não existir versão mobile, criar `MobileResetPasswordPage.tsx` montada em `/sindicato/reset-password`.

### UX

- Inputs validados com zod (CPF 11 dígitos, código 6 dígitos numéricos).
- Botão "Reenviar código" com cooldown de 60s.
- Toast genérico de sucesso/erro.
- Loaders e estados desabilitados.

---

## Segurança

- Códigos só armazenados como hash SHA-256.
- Expiração 10 min, máx 5 tentativas, máx 3 pedidos/hora por CPF e IP.
- Resposta sempre genérica para não vazar cadastro.
- RLS total na tabela; acesso só via service_role.
- Telefone exibido mascarado (`••••1234`).
- `APIBRASIL_BEARER_TOKEN` permanece server-only (já existe).

---

## Secrets necessários

Já existe `APIBRASIL_BEARER_TOKEN`. Pode ser necessário adicionar:
- `APIBRASIL_SMS_ENDPOINT` (opcional, default `sms/send`)
- `APIBRASIL_SMS_DEVICE_TOKEN` (opcional, se o plano exigir)

Solicito via `add_secret` apenas se você confirmar que o plano "SMS Avulso" exige.

---

## Entregáveis (ordem)

1. Migração SQL: tabela `password_reset_sms_codes` + RLS + grants.
2. Edge functions `password-reset-sms-request` e `password-reset-sms-verify`.
3. Service client `passwordResetSmsService.ts`.
4. `ForgotPasswordSmsDialog` reaproveitável.
5. Integração no `MobileAuthPage` (PWA) e admin `/auth`.
6. Página `/sindicato/reset-password` (se faltar).
7. Memória de projeto com a política de reset por SMS.

---

## Pontos para você confirmar antes de eu codar

1. **APIBrasil SMS – endpoint exato e payload**: você tem a documentação do "SMS avulso"? Sem isso eu implemento com defaults razoáveis e talvez precise ajustar depois.
2. **PWA – titular tem login Supabase real?** Hoje o `MobileAuthContext` indica login por CPF/senha custom. Se for assim, o `generateLink` recovery do Supabase **não se aplica ao PWA** — o fluxo PWA precisa atualizar a senha do titular direto via `members.password_hash` (ou equivalente). Confirmar isso muda a etapa 4 do verify.
3. **Admin `/auth`**: manter também o reset por email atual (HIBP/Locaweb), apenas adicionando o SMS como alternativa?