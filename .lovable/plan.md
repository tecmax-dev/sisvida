
# Auditoria do banimento Meta e plano de conformidade

## 1. O que encontrei na auditoria (causas prováveis do banimento)

Levantei o código que toca o número oficial do sindicato (`meta-webhook`, `whatsapp-ai-assistant`, `send-whatsapp`, `whatsapp-clean-flow`, `boleto-whatsapp-flow`, todos os `meta-*-template`) e cruzei com a memória de templates e a regra "Meta Official Only". Pontos críticos encontrados:

### 1.1. Falta de opt-out (causa nº1 de banimento por "user feedback")
- Nenhum lugar do código (`meta-webhook`, `whatsapp-ai-assistant`) trata palavras `PARAR`, `SAIR`, `CANCELAR`, `STOP`, `UNSUBSCRIBE`.
- Não existe tabela/coluna `whatsapp_opt_out` nem checagem antes de disparar templates MARKETING ou UTILITY recorrentes (`carteira_vencendo`, `carteira_vencida`, `vaga_medica_*`, `agenda_disponivel`, lembretes).
- Resultado: usuário só consegue "parar" bloqueando o número → bloqueios em massa = quality rating despenca → banimento.

### 1.2. Templates MARKETING disparados sem consentimento explícito comprovável
- `carteira_vencendo` e `carteira_vencida` estão classificados como **MARKETING** na memória, mas são disparados em automação para toda a base sem registro de opt-in 24h (origem do telefone vs. data/hora do consentimento).
- A Meta exige prova de opt-in para qualquer template MARKETING; sem isso, "Block Rate" > 2% derruba o número.

### 1.3. Templates fora de política (já desativado, mas histórico contou)
- `meta-create-carteirinha-whats-info` / `ia_prontuario_informativo` pedia para o associado **enviar foto de contracheque pelo WhatsApp** — violação de política de PII/documentos sensíveis. Já está bloqueado (HTTP 410), mas foi enviado por algum tempo e provavelmente gerou reportes.
- `register_templates.ts` mantém esse mesmo template na lista — risco de re-registro acidental.

### 1.4. Fluxo de botões fora do spec da Meta
- `mainMenuPayload`, `withMenuButtonsPayload` e `withMenuListPayload` (em `meta-webhook/index.ts`) montam interactive corretamente, **mas**:
  - `withMenuButtonsPayload` reserva 1 slot para "Menu Principal" e usa `buttons.slice(0,2)` → ok (limite 3).
  - `withMenuListPayload` empacota 2 seções (truncado em 9 + 1 navegação) → ok no total de 10.
  - **Não há limite enforcement para `title` (20 chars) nem `description` (72 chars) em todos os call sites** — mensagens são truncadas no momento da criação, mas dados vindos de banco (nome de profissional, serviço) podem estourar e gerar erro 131009/100 → reentregas em loop.
  - `header.text` em `mainMenuPayload` ("Sindicato dos Comerciários") não tem limite checado (max 60).
- `buildWhazingExternalButtonPayload` em `whatsapp-ai-assistant` envia `{ buttons: [{id,title}] }` sem `type: reply` — formato proprietário do Chatgoo/Whazing. Se em algum momento esse payload bater no endpoint Meta sem transformação, vira erro de schema.

### 1.5. Mirror Chatgoo com assinatura inválida
- `mirrorToChatgoo` reenvia o payload **transformado** (`transformInteractiveToText`) mas mantém o `X-Hub-Signature-256` **original** da Meta. Assinatura passa a não bater com o corpo. Não derruba o número Meta diretamente, mas indica acoplamento frágil — e qualquer reentrada desse payload no `meta-webhook` cai no caminho "envelope chatgoo", podendo ecoar mensagens duplicadas (mais um vetor de spam percebido).

### 1.6. Janela 24h não validada antes de free-form
- Memória diz "atendimento humano fora da janela 24h → obrigatório template", mas não há checagem em `send-whatsapp` / `whatsapp-ai-assistant` que valide `last_inbound_at` do contato antes de enviar `type: text`. Operadores do Chatgoo/Whazing podem enviar texto livre fora da janela → erro 131047 e marcação como spam.

### 1.7. Bot responde a `fromMe` / loops
- Já existe proteção `fromMe=true` ignorada, mas o caminho do envelope Chatgoo confia em `body.fromMe` (cliente envia). Sem validação cruzada com `phoneNumberId`, é possível eco de mensagem do bot ser reprocessado como mensagem de entrada → resposta automática para outra automação = padrão clássico de "looping" que a Meta também pune.

## 2. Correções propostas (escopo deste plano)

Trabalho **apenas** em backend (edge functions + 1 migração). Sem mexer em UI.

### 2.1. Sistema de opt-out (bloqueante para banimento futuro)
- Migração: nova tabela `whatsapp_opt_outs (clinic_id, phone, opted_out_at, reason, last_template_received)` com índice único `(clinic_id, phone)`, RLS + grants.
- Em `meta-webhook` (entrada): detectar mensagens com texto exato `PARAR`, `SAIR`, `CANCELAR`, `STOP`, `UNSUBSCRIBE` (case-insensitive, trim) → upsert em `whatsapp_opt_outs` + responder com mensagem de confirmação (dentro da janela 24h, free-form) + encerrar ticket.
- Em **todos** os disparos de template (`send-whatsapp`, `send-appointment-reminders`, `batch-send-boleto-whatsapp`, `send-comunicado-whatsapp-batch`, `boleto-whatsapp-flow`, `send-filiacao-notification`, `whatsapp-carteirinha-flow`, `meta-send-template`): checar opt-out antes do POST para Meta. Se opt-out existe → skip + log em `whatsapp_audit_logs`.
- Adicionar comando `VOLTAR` / `REATIVAR` para remover opt-out (uso humano em atendimento).

### 2.2. Novos templates UTILITY com botão de opt-out
- Recriar `carteira_vencendo_v3` e `carteira_vencida_v3` como **UTILITY** (são notificações de serviço, não marketing) com footer "Responda PARAR para não receber mais avisos."
- Mesma adequação para `vaga_medica_*`, `agenda_disponivel`, `informativo_agenda_medica`.
- Edge function `meta-register-templates` ganha action `register-with-optout&name=X` que adiciona o footer padronizado.

### 2.3. Validação de janela 24h
- Novo helper `assertInsideSessionWindow(phone)` em módulo compartilhado: consulta `whatsapp_tickets.last_inbound_at`; se > 24h → bloqueia envio free-form e retorna instrução para usar template.
- `send-whatsapp` (modo `type: text`) e `whatsapp-ai-assistant` aplicam a checagem antes de chamar Graph API.

### 2.4. Hardening dos botões interativos
- Centralizar builders interactive em `supabase/functions/_shared/meta-interactive.ts`:
  - `buildButtonMessage(body, buttons[])` — força `title.slice(0,20)`, max 3 botões, body max 1024, header max 60, footer max 60.
  - `buildListMessage(body, sections[])` — força total ≤10 rows, title 24, description 72, sectionTitle 24.
  - Lança erro tipado se input estourar (em vez de truncar silenciosamente em alguns lugares e não em outros).
- Substituir os builders inline de `meta-webhook` e `whatsapp-ai-assistant` por esses helpers.

### 2.5. Remover/blindar templates fora de política
- Remover `ia_prontuario_informativo` da lista de `register_templates.ts` (mantém edge function 410 como guarda) para impedir re-registro acidental por script local.
- Auditar `meta-create-vaga-templates` para garantir que body **não** instrui envio de PII e classifica `UTILITY` corretamente.

### 2.6. Mirror Chatgoo correto
- Em `mirrorToChatgoo`: ao transformar o body (`transformInteractiveToText`), **remover** o header `X-Hub-Signature-256` (assinatura deixa de ser válida para o corpo modificado). Manter apenas `X-Webhook-Token` autoral.
- Adicionar dedupe por `meta_message_id` antes do mirror para impedir loop ↔ reprocessamento.

### 2.7. Anti-loop reforçado no envelope Chatgoo
- Em vez de confiar só em `body.fromMe`, comparar `body.contact.phoneNumberId` (quando disponível) com `META_PHONE_NUMBER_ID` do sindicato. Se bate → eco interno → ignorar.

### 2.8. Observabilidade
- Nova tabela `whatsapp_policy_events (clinic_id, phone, event, payload, created_at)` para registrar: opt-out, opt-in, bloqueio por janela 24h, bloqueio por opt-out, erro Meta com `code` de policy (131026, 131045, 131049, 131051).
- Página existente `WhatsAppAuditPage` consome essa tabela (sem alteração visual estrutural; só adiciona uma aba/filtro — **a confirmar contigo se quer já incluir UI ou só backend agora**).

## 3. Fora do escopo deste plano
- Reativação do número banido (depende de processo manual com a Meta — fornecemos as evidências de "controles implementados" para o appeal).
- Migração de provedor (continua Meta Cloud API oficial).
- Mudança visual em telas `/sindicato`.

## 4. Detalhes técnicos

### 4.1. Migração `whatsapp_opt_outs`
```sql
CREATE TABLE public.whatsapp_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  phone text NOT NULL,
  opted_out_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  source text NOT NULL DEFAULT 'user_reply',
  reactivated_at timestamptz,
  UNIQUE (clinic_id, phone)
);
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_opt_outs TO authenticated;
GRANT ALL ON public.whatsapp_opt_outs TO service_role;
ALTER TABLE public.whatsapp_opt_outs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinic admins manage opt-outs"
  ON public.whatsapp_opt_outs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (true);
```

### 4.2. Códigos de erro Meta a tratar
- `131026` Message undeliverable / `131047` Re-engagement required (janela 24h) / `131049` user marked spam / `131051` unsupported message type / `131045` template paused → todos disparam `policy_events`.

### 4.3. Lista exata de arquivos a alterar
- `supabase/migrations/<ts>_whatsapp_opt_outs.sql` (novo)
- `supabase/migrations/<ts>_whatsapp_policy_events.sql` (novo)
- `supabase/functions/_shared/meta-interactive.ts` (novo)
- `supabase/functions/_shared/opt-out.ts` (novo)
- `supabase/functions/_shared/session-window.ts` (novo)
- `supabase/functions/meta-webhook/index.ts` (detecção PARAR/SAIR + mirror sem signature + anti-loop)
- `supabase/functions/send-whatsapp/index.ts` (checagem opt-out + janela 24h)
- `supabase/functions/send-appointment-reminders/index.ts` (opt-out)
- `supabase/functions/batch-send-boleto-whatsapp/index.ts` (opt-out)
- `supabase/functions/send-comunicado-whatsapp-batch/index.ts` (opt-out)
- `supabase/functions/boleto-whatsapp-flow/index.ts` (opt-out + interactive helper)
- `supabase/functions/send-filiacao-notification/index.ts` (opt-out)
- `supabase/functions/whatsapp-carteirinha-flow/index.ts` (opt-out)
- `supabase/functions/meta-send-template/index.ts` (opt-out central)
- `supabase/functions/whatsapp-ai-assistant/index.ts` (interactive helper + janela 24h)
- `supabase/functions/meta-register-templates/index.ts` (action `register-with-optout`)
- `register_templates.ts` (remover template proibido)

## 5. Perguntas para você antes de implementar

1. **Comando de opt-out**: aceito que `PARAR` / `SAIR` / `CANCELAR` (qualquer um deles, sozinho na mensagem) marque opt-out? Quer adicionar outra palavra (ex.: `DESCADASTRAR`)?
2. **Escopo de opt-out**: por número de clínica (sindicato) ou global (afeta todas as clínicas)? Recomendo por clínica.
3. **Templates MARKETING → UTILITY**: posso recriar `carteira_vencendo` e `carteira_vencida` como `_v4` UTILITY com o footer de opt-out, ou prefere manter MARKETING e adicionar registro de opt-in formal antes?
4. **UI**: incluo já uma aba "Opt-outs" em `WhatsAppAuditPage` para ver/reativar manualmente, ou foco só no backend nessa rodada?
