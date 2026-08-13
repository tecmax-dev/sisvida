# Etapa 2 — Auditoria Técnica do PROSINGE (pré-integração Zapresponde)

Referências: `docs/ARQUITETURA_FUNCIONAL_OFICIAL_INTEGRACAO_WHATSAPP.md` e
`mem/technical/whatsapp/arquitetura-funcional-oficial-integracao.md`.
**Nenhuma alteração foi feita**: sem migrations, sem tabelas, sem edge functions, sem RLS.

---

## 1. Estrutura real existente

| Domínio | Tabela | PK | Tenant | Relacionamentos | Campos p/ WhatsApp | RLS |
|---|---|---|---|---|---|---|
| Associados | `patients` (74 col.) | `id` uuid | `clinic_id` | cards, dependents, appointments | `phone`, `cpf`, `blocked_whatsapp`, `blocked_whatsapp_at/_reason`, `is_union_member`, `union_member_status` | Sim (7 policies) |
| Associados (filiação) | `sindical_associados` | `id` | `sindicato_id` | patients | `telefone`, `cpf`, `status` | Sim (5) |
| Associados PF (contrib.) | `members` | `id` | `clinic_id` | member_contributions | `phone`, `cpf` (único por clínica) | Sim (4) |
| Dependentes | `patient_dependents` | `id` | `clinic_id` | `patient_id` (titular) | `phone`, `cpf` | Sim (7) |
| Empresas | `employers` | `id` | `clinic_id` + `union_entity_id` | contribuições, escritórios | `phone`, CNPJ | Sim (3) |
| Carteirinha | `patient_cards` | `id` | `clinic_id` | `patient_id` | `expires_at`, `is_active`, `qr_code_token` | Sim (6) |
| Contracheque | `payslip_requests`, `patient_payslip_history` | `id` | `clinic_id` | `patient_id`, `card_id` | `status`, `attachment_path`, `validation_status` | Sim (5/3) |
| Documentos | `patient_attachments`, `medical_documents`, buckets privados | `id` | `clinic_id` | `patient_id` | caminhos assinados | Sim |
| Agenda / Saúde | `appointments` | `id` | `clinic_id` | patient, professional | status, datas, `appointment_sms_tokens` | Sim (7) |
| Profissionais | `professionals` | `id` | `clinic_id` | especialidades, agenda | slug público | Sim (7) |
| Homologação | `homologacao_appointments` + 8 tabelas | `id` | `clinic_id` | professionals, empresas | protocolo, notificações | Sim (7) |
| Jurídico | módulo `union_legal_*` | `id` | `union_entity_id`/`clinic_id` | prazos, documentos | — | Sim |
| Benefícios | `union_benefits`, `union_convenios` | `id` | `clinic_id`/entidade | associados | — | Sim |
| Financeiro | `employer_contributions`, `member_contributions`, `union_financial_transactions` | `id` | `clinic_id` | empresas/associados | boleto/Lytex, tokens públicos | Sim |
| Tenant | `clinics` (20 registros) + `union_entities` | `id` | — | tudo | `whatsapp_provider`, `whatsapp_header_image_url`, `whatsapp_message_delay_seconds` | Sim (9) |
| Usuários / permissões | `profiles`, `user_roles`, `access_groups`, `feature_permissions`, `super_admins` | `id` | `clinic_id` | — | — | Sim |
| Integrações | `zapster_configs` (1), `zapresponder_configs` (1), `evolution_configs`, `twilio_configs`, `webhooks` | `id` | `clinic_id` | — | `instance_id`, `phone_number`, `webhook_id` | Sim |

**Modelo de tenant real = `clinic_id`** (uuid da tabela `clinics`). Entidades sindicais usam
`union_entity_id` como recorte adicional, resolvido pelo `SINDICATO_CLINIC_ID`.

---

## 2. O que já existe de WhatsApp / Meta / Zapresponde

### Tabelas (51 relacionadas)
Conversas e atendimento: `whatsapp_contacts`, `whatsapp_tickets`, `whatsapp_ticket_messages`,
`whatsapp_sectors`, `whatsapp_operators`, `whatsapp_operator_sectors`, `whatsapp_quick_replies`,
`whatsapp_module_settings`, `whazing_messages`.
Compliance: `contact_preferences` (opt-in/opt-out/score), `whatsapp_opt_outs`,
`whatsapp_consents` (LGPD, com `tenant_id`), `marketing_consents`, `whatsapp_policy_events`,
`whatsapp_template_logs`, `whatsapp_audit_logs`, `meta_safe_mode_config`, `meta_safe_mode_audit`,
`meta_health_score_v`.
Templates: `whatsapp_meta_templates`, `whatsapp_templates`.
Sessões/fluxos: `whatsapp_sessions`, `whatsapp_booking_sessions`, `whatsapp_boleto_sessions`,
`whatsapp_ai_conversations`, `whatsapp_incoming_logs`.
Identidade: **`whatsapp_phone_identity`** (`clinic_id`, `phone`, `patient_id`, `identified_via`).
Integração: `zapster_configs`, `zapresponder_configs`, `zapster_webhook_logs`, `webhooks`, `webhook_logs`.

### Camada de compliance em código (`supabase/functions/_shared/`)
- `send-gate.ts` — `assertCanSend` / `recordSent` / `recordFailure`, fail-closed.
- RPC `wa_can_send` — opt-out, consentimento, categoria MARKETING, score, rate 24h/7d/30d, críticos.
- `opt-out.ts` — `normalizePhone` (força prefixo 55), palavras PARAR/SAIR/..., `logPolicyEvent`.
- `session-window.ts` — janela 24h por `whatsapp_tickets.last_inbound_at` + fallback `whatsapp_incoming_logs`.
- `template-catalog.ts` — 12 templates canônicos + STRICT_MODE.
- `safe-mode.ts` — maintenance, dry-run, circuit breaker, caps hora/dia/contato, go-live stages.
- `template-governance.ts`, `trigger-sources.ts`, `meta-creds.ts` (v1/v2 via `global_config.meta_api_active`).

### Edge functions relevantes (~190 no total)
Saída: `send-whatsapp`, `meta-send-template`, `meta-send-text`, `send-whatsapp-document`,
`send-whatsapp-zapresponder`, `send-comunicado-whatsapp-batch`, `batch-send-boleto-whatsapp`, etc.
Entrada: `meta-webhook` (2.065 linhas), `zapster-webhook`, `whazing-actions`,
`zapresponder-webhook` (**desativada — retorna `legacy_disabled`**), `bot-sindicato-gateway`,
`whatsapp-carteirinha-flow`, `whatsapp-clean-flow`, `whatsapp-ai-assistant`, `zapresponder-bot-actions`.
Governança: `meta-compliance-audit`, `meta-safe-mode-admin`, `meta-templates-report`, `meta-sync-templates`.

---

## 3. Identificação pelo telefone (situação atual)

- Armazenamento: `patients.phone` (text livre), `patient_dependents.phone`, `employers.phone`,
  `members.phone`, `sindical_associados.telefone`.
- **Sem normalização persistida.** Amostra atual de `patients` (8.290 registros):
  - 1.507 telefones sem DDI (10–11 dígitos), 6 com DDI, 24 fora de padrão, restante nulo/vazio.
  - 151 telefones duplicados **dentro da mesma clínica**.
  - 4 telefones presentes em **mais de uma clínica**.
- Índices: apenas `idx_patients_phone` sobre o valor **bruto** — não serve para busca normalizada.
  Não há índice de telefone em `employers`, `patient_dependents`, `members`.
- Titular e dependente **podem** compartilhar telefone (nenhuma restrição).
- Normalização existe só em runtime (`normalizePhone` no Deno) e nas tabelas de WhatsApp
  (`contact_preferences`, `whatsapp_contacts` — únicas por `clinic_id, phone`).
- Busca segura futura: `clinic_id` (vindo da configuração da integração) + telefone normalizado,
  com `whatsapp_phone_identity` como cache de vínculo já existente.

---

## 4. Carteirinha — fluxo real

- **Não existe coluna de status de carteirinha.** O estado é *derivado*:
  `patient_cards.is_active` + `patient_cards.expires_at` (validade). Regra de negócio via
  `is_patient_card_valid()` e `enforce_authorization_card_validity()`.
- Atualização: `payslip_requests` com `status` real em uso — `pending` (61), `received` (4),
  `approved` (230), `rejected` (137).
- Documento: bucket privado **`contra-cheques`** (`attachment_path`), URLs assinadas de 1h.
- Aprovação: painel admin (`send-payslip-approval`, `verify-payslip-document` com GPT-4o Vision);
  admin pode renovar sem contracheque; não-admin emite 1ª via com validade fixa de 30 dias.
- Histórico: **existe** — `patient_payslip_history` (`previous_card_expiry`, `new_card_expiry`,
  `validation_status`, `validated_by`) e `card_expiry_notifications` (30/15/7 dias).
- Evento futuro `CARTEIRINHA_ATUALIZACAO_NECESSARIA`: **derivar** de
  `patient_cards.expires_at <= hoje + N` com `is_active = true` e sem `payslip_request` em
  `pending/received`. **Não criar novo status.**

---

## 5. Multi-tenant

- Todas as tabelas operacionais carregam `clinic_id`; RLS usa `has_clinic_access()`,
  `get_user_clinic_ids()`, `is_clinic_admin()`, `is_super_admin()`.
- **Inconsistência:** `whatsapp_consents` usa `tenant_id` (não `clinic_id`) — único caso.
- Cadeia segura de resolução para requisições do Zapresponde:
  `instance_id` / `phone_number` do webhook → `zapster_configs` (ou `zapresponder_configs`) →
  `clinic_id` → telefone normalizado → `whatsapp_phone_identity` / `patients` → associado/empresa.
- Hoje existe **1 registro** em `zapster_configs` e **1** em `zapresponder_configs`: a resolução
  funciona, mas não está formalizada como contrato único (`zapresponder-bot-actions` faz fallback
  manual entre as duas tabelas).
- Confirmado: **nunca** identificar tenant pelo telefone — há telefones repetidos entre clínicas.

---

## 6. Segurança

- RLS: **0 tabelas sem RLS** no schema `public`.
- **67 policies permissivas** com `USING (true)` ou `WITH CHECK (true)` — precisam de revisão
  caso a caso antes de expor dados à integração.
- **25 policies com role `anon`** (portais públicos, homologação, filiação, carteirinha por QR,
  `whatsapp_consents` insert). Nenhuma expõe telefone de associado diretamente.
- **165 funções SECURITY DEFINER** — superfície ampla; a integração deve usar apenas funções
  específicas, nunca RPC genérica.
- Storage: `contra-cheques`, `patient-attachments`, `legal-documents`, `dependent-documents`,
  `sindical-documentos`, `chat-attachments` são **privados** (URL assinada). Públicos:
  `whatsapp-assets`, `whatsapp-headers`, `patient-photos`, `union-app-content` — nunca colocar
  contracheque nesses.
- Secrets: `META_WHATSAPP_TOKEN(_V2)`, `META_PHONE_NUMBER_ID(_V2)`, `META_WABA_ID(_V2)`,
  `ZAPSTER_API_TOKEN` / `ZAPRESPONDER_API_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` — todos server-side.
  Nenhum token aparece no frontend React.

---

## 7. Relatório

### O QUE JÁ EXISTE (reutilizar)
1. Gate de compliance completo: `send-gate.ts` + RPC `wa_can_send` (opt-out, consentimento,
   categoria, score, rate 24h/7d/30d, fail-closed).
2. Safe mode: circuit breaker, caps hora/dia/contato, dry-run, manutenção, go-live stages.
3. Catálogo canônico de templates + STRICT_MODE + governança + `whatsapp_meta_templates`.
4. Janela de 24h (`session-window.ts`) com ticket + fallback de inbound.
5. Auditoria: `whatsapp_template_logs`, `whatsapp_policy_events`, `whatsapp_audit_logs`, `meta_safe_mode_audit`.
6. Atendimento conversacional: contatos, tickets, mensagens, setores, operadores.
7. Cache de identidade: `whatsapp_phone_identity`.
8. Resolução de tenant por instância: `zapster_configs.instance_id` / `phone_number`.
9. Fluxo de carteirinha completo, com histórico e documento em bucket privado.

### O QUE EXISTE PARCIALMENTE (adaptar)
1. **Adesão ao gate**: apenas `send-whatsapp` e `meta-send-template` chamam `assertCanSend`.
   Dezenas de funções enviam fora do gate — viola a arquitetura oficial.
2. **`contact_preferences` está vazia (0 registros)**: com o gate ativo, todo envio não-crítico
   retorna `blocked_consent`. Precisa de backfill/regra de consentimento antes do go-live.
3. **Consentimento duplicado** em três modelos: `contact_preferences`, `whatsapp_opt_outs`,
   `whatsapp_consents` (`tenant_id`) — consolidar a fonte de verdade.
4. **Telefone**: sem coluna/índice normalizado, com duplicidades — precisa de estratégia de
   normalização e desempate.
5. **`zapresponder-webhook` desativada** e lógica dividida com `zapster-webhook`/`whazing-actions`.
6. **Configuração da integração** espalhada em `zapster_configs` + `zapresponder_configs` legado.
7. **Meta chamada direta** por várias funções (`meta-send-text`, `send-whatsapp-document`), sem
   passar pela camada única.

### O QUE NÃO EXISTE (criar futuramente)
1. **Fila de envio** (outbox) com estados, retry e idempotência — hoje o envio é síncrono.
2. **Barramento de eventos** dos módulos (`CARTEIRINHA_ATUALIZACAO_NECESSARIA`, etc.); hoje cada
   função decide sozinha quando enviar.
3. **API/Edge Function única de integração para o Zapresponde** (contrato inbound com
   autenticação por chave da integração e resolução de tenant).
4. **Resolução de identidade formal** (função única telefone+tenant → associado/empresa/dependente,
   com desfecho `ambiguous` → atendimento humano).
5. **Registro de ações autorizadas** por canal (quais consultas/ações o WhatsApp pode executar).
6. **Rate limit por integração/tenant** (existe por contato/global, não por origem).

### RISCOS ENCONTRADOS
| # | Risco | Impacto |
|---|---|---|
| R1 | Envio fora do gate na maioria das funções | Violação Meta, ban do número |
| R2 | `contact_preferences` vazia | Gate bloqueia 100% dos envios não críticos ao ser generalizado |
| R3 | 151 telefones duplicados na mesma clínica e 4 entre clínicas | Identificação errada / vazamento de PII entre cadastros |
| R4 | Telefone sem normalização persistida (1.507 sem DDI) | Falha de match no inbound |
| R5 | Titular e dependente com mesmo telefone | Ambiguidade de identidade |
| R6 | 67 policies `true` e 165 SECURITY DEFINER | Superfície ampla se a integração usar service_role sem escopo |
| R7 | Modelos de consentimento divergentes (`tenant_id` × `clinic_id`) | Decisão de compliance inconsistente |
| R8 | Documentos privados exigem URL assinada de 1h | Link expirado no WhatsApp |
| R9 | Duas tabelas de config de integração com fallback manual | Tenant resolvido de forma inconsistente |
| R10 | `zapresponder-webhook` desativada | Inbound do Zapresponde hoje não chega ao Prosinge |

### PLANO DE IMPLEMENTAÇÃO RECOMENDADO
| Ordem | Ação | Classificação |
|---|---|---|
| 1 | Consolidar configuração da integração em `zapster_configs` (instance_id + phone_number → clinic_id) | ADAPTAR |
| 2 | Normalização de telefone: coluna gerada + índice único por clínica, e relatório de duplicidades | CRIAR |
| 3 | Função única de resolução de identidade (tenant + telefone → titular/dependente/empresa/`ambiguous`) | CRIAR |
| 4 | Reaproveitar `whatsapp_phone_identity` como cache do item 3 | REUTILIZAR |
| 5 | Edge Function única de integração inbound (auth por chave da integração, ações autorizadas) | CRIAR |
| 6 | Catálogo de eventos de saída por módulo, começando por `CARTEIRINHA_ATUALIZACAO_NECESSARIA` derivado de `patient_cards.expires_at` | CRIAR |
| 7 | Fila de envio (outbox) com idempotência e retry, consumindo os eventos | CRIAR |
| 8 | Forçar `assertCanSend` em **todas** as funções de saída e remover chamadas diretas à Meta | ADAPTAR |
| 9 | Consolidar consentimento numa fonte única e fazer backfill de `contact_preferences` | ADAPTAR |
| 10 | Reutilizar safe-mode, catálogo de templates e logs de auditoria como estão | REUTILIZAR |
| 11 | Revisar as 67 policies `true` que a integração tocar | ADAPTAR |
| 12 | Dar ao Zapresponde acesso direto ao banco / service_role | **NÃO RECOMENDADO** |
| 13 | Criar novo status de carteirinha | **NÃO RECOMENDADO** (derivar de `expires_at`) |
| 14 | Manter `zapresponder_configs` legado e o webhook desativado | **NÃO RECOMENDADO** (migrar e remover) |

---

**Aguardando aprovação antes de qualquer implementação.**