---
name: Card Update Secure URL Flow
description: Atualização de carteirinha via botão URL com token efêmero, substituindo o callback QUICK_REPLY do WhatsApp
type: feature
---
O clique em botões QUICK_REPLY do template Meta NÃO gera mensagem incoming no Chatwoot (falha comprovada no estágio META_TO_CHATWOOT, mensagem 1632). Por isso o fluxo de atualização de carteirinha NÃO deve depender de quick_reply, n8n-inbound, REQUEST_PAYSLIP ou orquestrador.

Fluxo canônico:
- Tabela `public.card_update_tokens` (token, patient_id, clinic_id, expires_at, used_at, revoked_at). RLS ativo sem políticas: acesso exclusivo via service_role.
- Edge function `card-update-link`: action `generate` (cria token efêmero de 60 min e devolve URL com base controlada pelo backend, `PUBLIC_APP_BASE_URL`) e action `validate` (resolve associado, carteirinha e pedido pendente).
- Rota pública: `/atualizar-carteirinha?t=<TOKEN>` (`src/pages/public/CardUpdatePage.tsx`), envia contracheque via `mobile-payslip-upload`.
- A URL nunca carrega CPF, patient_id ou telefone. Abrir a página não altera a carteirinha.
- Envio proativo do template continua obrigatoriamente passando pelo Send Gate (consent, opt-out, template status, idempotência).
