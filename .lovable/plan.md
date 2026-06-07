# Lembrete de agendamento por SMS com Confirmar/Cancelar

SMS não suporta botões nativos. A solução padrão (usada por clínicas no Brasil) é enviar **texto curto + 2 links** (um para confirmar, outro para cancelar). O paciente toca, abre uma página pública leve, e a ação volta para o sistema automaticamente.

## Custo / tamanho
Meta: caber em **1 SMS (160 chars GSM-7)**. Exemplo (≈150 chars):

```
ProSind: ola Joao, consulta 12/06 14:30 c/ Dr Ana.
Confirmar: prosindweb.com.br/c/AbC12
Cancelar:  prosindweb.com.br/c/AbC12?x=1
```

Usaremos token curto (5–6 chars base62) por agendamento → mesma URL serve para confirmar e cancelar via `?x=1`, economizando caracteres. Domínio próprio (já temos `prosindweb.com.br`) → link mais curto que `wa.me` / qualquer encurtador externo, sem custo extra.

## Componentes

### 1. Tabela `appointment_sms_tokens` (migration)
- `token` (text PK, 6 chars) · `appointment_id` (fk) · `clinic_id` · `expires_at` · `confirmed_at` · `cancelled_at` · `sent_at` · timestamps.
- RLS: leitura/escrita só service_role; página pública usa edge function.
- GRANT para `service_role`.

### 2. Edge function `appointment-sms-reminder` (verify_jwt=true)
- Input: `{ appointment_id }` ou `{ clinic_id, date }` (lote).
- Gera token, monta texto curto (≤160 chars; trunca nome se preciso), envia via `sindicato-send-sms` reutilizando Comtele (já operacional — não toca em WhatsApp).
- Loga em `sms_send_logs`.

### 3. Edge function pública `appointment-action` (verify_jwt=false)
- Rota: `GET /functions/v1/appointment-action?t=AbC12&x=0|1`.
- Valida token, expira em 7 dias, idempotente.
- `x=1` → `appointments.status = 'cancelled'` + libera waiting list (`notifyNextInWaitingList`).
- `x=0` → `appointments.status = 'confirmed'`.
- Retorna HTML simples com cor verde/vermelha + nome da clínica.

### 4. Rota curta `/c/:token`
- `public/_redirects` + `vercel.json`: `/c/*` → edge function `appointment-action`.
- Mantém URL curtíssima no SMS.

### 5. UI — Card de SMS no detalhe do agendamento
- Em `AppointmentDetails` (ou menu de ações do card já existente): botão **"Enviar lembrete SMS"** chamando a edge.
- Toggle em `clinics` (`sms_reminder_enabled`) para envio automático D-1 (cron já existente — apenas adicionar trigger opcional, não obrigatório nesta entrega).

## O que NÃO muda
- WhatsApp Meta / Evolution / lembretes WA existentes — intocados.
- `appointments` schema (só leitura/update de `status`).
- Fluxo de reset de senha SMS.

## Entregáveis nesta ordem
1. Migration `appointment_sms_tokens` + GRANT + RLS.
2. Edge `appointment-action` (público) + `appointment-sms-reminder` (autenticado).
3. Redirect `/c/:token` no `public/_redirects` e `vercel.json`.
4. Botão "Enviar lembrete SMS" no card de agendamento.

Posso seguir?
