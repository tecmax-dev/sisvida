# ETAPA 3 — Fundação Segura da Integração WhatsApp (PROSINGE + ZAPRESPONDE)

> **Status:** implantada em modo FUNDAÇÃO.
> **Nenhuma mensagem de WhatsApp é enviada por esta etapa.** Todo o caminho de
> saída termina em `whatsapp_outbox` com `dry_run = true`.

---

## 1. Princípio central

Nenhum módulo do PROSINGE envia WhatsApp. Ele **emite um evento**. O evento
atravessa o compliance e, só então, é enfileirado.

```text
MÓDULO (carteirinha, agenda, financeiro...)
        │  emitWhatsappEvent()
        ▼
whatsapp_events  (barramento, idempotente por deduplication_key)
        │
        ▼
COMPLIANCE GATE  (consent.ts -> send-gate.ts -> wa_can_send -> safe-mode)
        │
        ▼
whatsapp_outbox  (dry_run = true nesta etapa; nunca "SENT")
        │
        ▼   [ETAPA FUTURA — não implementado]
ZAPRESPONDE / CHATWOOT -> META -> Associado
```

A entrada oficial (ZAPRESPONDE -> PROSINGE) é uma única edge function:
`zapresponde-action`.

---

## 2. O que foi criado

### 2.1 Banco de dados

| Tabela | Papel |
|---|---|
| `whatsapp_events` | Barramento de eventos. Único por `(clinic_id, deduplication_key)`. Status: `PENDING/PROCESSING/PROCESSED/BLOCKED/FAILED/CANCELLED`. |
| `whatsapp_outbox` | Fila de saída. `dry_run` default `true`. Único por `(clinic_id, deduplication_key)`. |
| `whatsapp_integration_credentials` | Credencial por tenant: `api_key_id`, `api_key_hash` (SHA-256), `hmac_secret`, `instance_id`, `phone_number_id`, `rate_limit_per_minute`, `dry_run`. |
| `whatsapp_inbound_nonces` | Anti-replay. Único por `(api_key_id, nonce)`. Também serve de contador do rate limit por minuto. |

RLS ativa em todas, escopada por `clinic_id` + papel de admin da clínica.
`service_role` com GRANT completo (uso exclusivo das edge functions).

### 2.2 Módulos compartilhados (`supabase/functions/_shared/`)

| Módulo | Responsabilidade |
|---|---|
| `phone-br.ts` | Normalização canônica E.164 BR (`55` + DDD + número), sem gravar nada no banco. Gera variantes de busca para dados legados. |
| `identity.ts` | Resolve TITULAR/DEPENDENTE **sempre dentro de um `clinic_id`**. Múltiplos candidatos ⇒ `AMBIGUOUS` (nunca escolhe o primeiro). |
| `consent.ts` | Unifica os três modelos de consentimento (`whatsapp_opt_outs`, `contact_preferences`, `whatsapp_consents`). |
| `card-state.ts` | Estado **virtual** da carteirinha derivado de `patient_cards.expires_at/is_active` + `payslip_requests`. Nenhuma coluna de status foi criada. |
| `dedup.ts` | `deduplication_key` determinística. Retry técnico reutiliza a chave; novo `expires_at` gera nova ocorrência. |
| `event-bus.ts` | `emitWhatsappEvent()` / `setEventStatus()`. Idempotente, inclusive sob corrida (`23505`). |
| `outbox.ts` | `enqueueWhatsappOutbox()`. Aplica consentimento + gate e grava em dry-run. |
| `inbound-auth.ts` | API key + HMAC SHA-256 + timestamp (±300s) + nonce + rate limit. Comparações timing-safe. Mascaramento de telefone em log. |
| `zapresponde-config.ts` | Fonte única de configuração: `zapster_configs` (canônica) com fallback de leitura em `zapresponder_configs` (legado). |

### 2.3 Edge function `zapresponde-action`

Entrada oficial única. Autentica, resolve tenant e identidade, consulta a
carteirinha e devolve a **próxima ação** — sem enviar nada.

Cabeçalhos exigidos:

```
x-prosinge-key-id
x-prosinge-api-key
x-prosinge-timestamp   (unix segundos, tolerância 300s)
x-prosinge-nonce       (8..128 chars, único por chave)
x-prosinge-signature   HMAC_SHA256(hmac_secret, `${keyId}.${timestamp}.${nonce}.${rawBody}`)
```

Ações suportadas:

- `health_check` — devolve tenant resolvido, origem da configuração, `dry_run` e `sending_enabled: false`.
- `carteirinha_atualizar` — resolve associado e estado da carteirinha.

Resultados possíveis de `carteirinha_atualizar`:

| Resultado | Significado |
|---|---|
| `REQUEST_PAYSLIP` | Atualização necessária. Evento emitido + outbox em dry-run. |
| `CARD_ALREADY_OK` | Carteirinha válida, a vencer ou já com solicitação em andamento. |
| `MEMBER_NOT_FOUND` | Sem vínculo/sem carteirinha ⇒ identificação segura ou atendimento humano. |
| `AMBIGUOUS_IDENTITY` | Telefone compartilhado / múltiplos cadastros ⇒ atendimento humano. |
| `POLICY_BLOCKED` | Bloqueado por consentimento/opt-out/política. |
| `INVALID_PHONE` | Telefone não normalizável. |

Todas as respostas de escrita retornam `dry_run: true` e `message_sent: false`.

---

## 3. Regras de identificação

1. Telefone é normalizado para E.164 BR **em runtime**; dados persistidos não são alterados.
2. A busca ocorre **sempre** dentro do `clinic_id` resolvido pela credencial.
3. `clinic_id` **nunca** é aceito do corpo da requisição — é derivado da integração autenticada (`integration_credential` > `instance_id` > `phone_number_id`).
4. Mais de um candidato (titular + dependente, telefone compartilhado, duplicidade) ⇒ `AMBIGUOUS` ⇒ handoff humano.
5. Nenhum dado sensível é devolvido ao ZAPRESPONDE: apenas estado e próxima ação.

## 4. Política de consentimento aplicada

- `OPT_OUT` bloqueia sempre, inclusive AUTHENTICATION.
- `MARKETING` exige opt-in explícito — `UNKNOWN` bloqueia (fail-closed).
- `AUTHENTICATION` / templates `critical`: `NOT_REQUIRED` (transacional pedido pelo usuário).
- `UTILITY`: `NOT_REQUIRED` quando há vínculo comprovado na mesma clínica; sem vínculo, `UNKNOWN` bloqueia.

Consequência desejada: `contact_preferences` estar vazia **não** bloqueia
utilitários legítimos, e nada é populado artificialmente.

## 5. Idempotência

`deduplication_key` = `clinic|CARTEIRINHA_ATUALIZACAO_NECESSARIA|patient|patient_card|card_id|expires_at`.

- Retry técnico ⇒ mesma chave ⇒ nenhum evento/outbox novo.
- Nova validade da carteirinha ⇒ nova chave ⇒ nova ocorrência legítima.

## 6. Segurança

- ZAPRESPONDE **não** tem acesso ao banco: só à edge function.
- Nenhum token de Meta/Zapresponde no frontend React.
- Segredos apenas em variáveis de ambiente das edge functions e em `whatsapp_integration_credentials` (hash + HMAC), lidos por `service_role`.
- Logs mascaram telefone (`5573****64`) e não registram conteúdo de PII.
- Falhas de autenticação retornam `401/409/429` sem revelar o motivo interno.

## 7. Interruptor global de envio

`WHATSAPP_OUTBOX_DRY_RUN` (default `"true"`). Enquanto diferente de `"false"`,
toda linha da outbox nasce com `dry_run=true` e status `BLOCKED`, com
`gate_reason = dry_run_stage3`. Nada é marcado como `SENT` nesta etapa.

## 8. Como validar sem enviar mensagem

1. `health_check` — deve retornar `sending_enabled: false` e o tenant correto.
2. `carteirinha_atualizar` com telefone de associado com carteirinha vencida — deve retornar `REQUEST_PAYSLIP` e criar 1 linha em `whatsapp_events` e 1 em `whatsapp_outbox` (`dry_run=true`).
3. Repetir a mesma chamada — nenhuma linha nova (`event_duplicated: true`).
4. Telefone compartilhado por dois cadastros — `AMBIGUOUS_IDENTITY`.
5. Reenviar a mesma requisição com o mesmo nonce — `409 replay_detected`.
6. Timestamp com mais de 5 minutos — `401 timestamp_expired`.
7. `select status, dry_run, gate_reason from whatsapp_outbox` — nenhum `SENT`.

## 9. O que NÃO foi feito (propositalmente)

- Nenhum envio real de WhatsApp, template ou chamada à Meta/Zapresponde.
- Nenhuma alteração nas funções de envio existentes (`meta-send-text`, `whatsapp-clean-flow`, `send-appointment-reminders`, `whatsapp-carteirinha-flow`).
- Nenhuma migração/normalização em massa de telefones já gravados.
- Nenhuma alteração de schema em `patient_cards` ou `payslip_requests`.

## 10. Próxima etapa sugerida

1. Provisionar a credencial de integração da clínica-piloto.
2. Rodar o roteiro da seção 8 em produção com dry-run ativo.
3. Migrar os disparos automáticos existentes para `emitWhatsappEvent()`.
4. Só então implementar o worker de envio e desligar `WHATSAPP_OUTBOX_DRY_RUN`.