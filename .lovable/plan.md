# SMS Comtele em /sindicato — adição não-destrutiva

## Princípios
- **Não tocar** em fluxos existentes (WhatsApp Meta, Evolution, e-mail, recuperação de senha SMS).
- Comtele entra como **canal opcional adicional** apenas dentro do módulo `/sindicato`.
- Reaproveita `ApiBrasilSmsService` (já configurado para Comtele Gateway V4 em `supabase/functions/_shared/apibrasil-sms.ts`).

## Escopo

### 1. Tabela nova `sms_templates` (não conflita com WhatsApp)
Colunas: `id`, `clinic_id`, `name`, `meta_template_name` (origem opcional), `body` (texto puro, máx 160 chars com placeholders `{1}`,`{2}`...), `variables` (jsonb), `status` (`draft`|`active`), `comtele_template_id` (se cadastrado na Comtele), timestamps.
RLS: admin/owner do sindicato.

### 2. Edge function `sindicato-sms-templates-sync` (verify_jwt=true)
- **Lista** templates Meta aprovados via Graph API.
- **Converte** componente BODY removendo formatação Meta → texto SMS puro (`{{1}}` → `{1}`, remove `*bold*`, trunca 160).
- **Cria/atualiza** registros em `sms_templates` (idempotente por `meta_template_name`).
- **NÃO** cria templates na Comtele automaticamente (a API de templates Comtele exige aprovação manual). Apenas espelha o texto localmente.

### 3. Edge function `sindicato-send-sms` (verify_jwt=true)
- Input: `{ template_id, recipients: [{phone, vars}], clinic_id }`.
- Renderiza body substituindo `{N}` por vars.
- Envia via `ApiBrasilSmsService.fromEnv()` (Comtele já operacional).
- Loga em tabela `sms_send_log` (success/error por destinatário).

### 4. UI em `/sindicato` — nova página `UnionSmsPage`
- Rota: `/sindicato/comunicacao/sms` (nova; não substitui WhatsApp).
- Tabs: **Templates** (lista + botão "Sincronizar do WhatsApp") | **Envio** (escolhe template, cola lista de números/CPFs, envia) | **Histórico** (logs).
- Link no menu lateral do sindicato como item novo "SMS (Comtele)" — não remove nada.

### 5. Permissão
Reusa `useUnionPermissions` — só admin/owner enxerga.

## O que NÃO muda
- `send-password-reset-email`, `apibrasil-sms.ts` core, recuperação de senha mobile.
- Templates Meta WhatsApp e disparos existentes.
- Rotas, menus e schemas atuais.

## Detalhes técnicos
- Templates Comtele só podem ser criados via painel comtele.com.br (sem endpoint público estável). Por isso espelhamos localmente e enviamos **mensagem livre** com a rota 17 (transacional). Comtele aceita texto livre na rota 17 sem pré-aprovação.
- Truncamento: SMS = 160 chars GSM-7. Avisar usuário quando exceder.
- Telefones via `buildBrazilianPhoneCandidates` (já existe).

## Entregáveis em ordem
1. Migration `sms_templates` + `sms_send_log` + RLS + GRANT.
2. Edge `sindicato-sms-templates-sync` + `sindicato-send-sms`.
3. Hook `useSmsTemplates` + página `UnionSmsPage` + item de menu.
4. Teste curl em uma template e um envio.
