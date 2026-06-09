
# Conformidade WhatsApp Business API – Plano de Implementação

Objetivo: blindar o número oficial do sindicato contra novo banimento, alinhando 100% do fluxo de templates às diretrizes da Meta + LGPD. Trabalho dividido em **6 fases incrementais**, cada uma entregável de forma independente.

> Já existe base parcial (fase 1 do plano anterior): tabelas `whatsapp_opt_outs`, `whatsapp_policy_events`, helpers `_shared/opt-out.ts`, `_shared/session-window.ts`, `_shared/meta-interactive.ts`. Este plano **estende** esse alicerce; não duplica.

---

## Fase 1 — Catálogo canônico de templates (consolidação)

Hoje há templates redundantes (`agenda_disponivel` + `agenda_disponivel_util` + `informativo_agenda_medica`, `carteira_vencendo` + `_util` + futuros `_v3/_v4`). Vamos congelar **um conjunto único e permanente**:

| Template canônico            | Categoria | Finalidade                              |
| ---------------------------- | --------- | --------------------------------------- |
| `consulta_confirmacao`       | UTILITY   | Confirmação de agendamento              |
| `consulta_lembrete`          | UTILITY   | Lembrete D-1 / dia                      |
| `consulta_cancelamento`      | UTILITY   | Cancelamento pelo profissional/clínica  |
| `carteirinha_vencendo`       | UTILITY   | Aviso 30/15/7 dias antes do vencimento  |
| `carteirinha_vencida`        | UTILITY   | Aviso pós-vencimento                    |
| `boleto_disponivel`          | UTILITY   | Boleto/Lytex emitido                    |
| `homologacao_confirmada`     | UTILITY   | Confirmação de homologação              |
| `assembleia_aviso`           | UTILITY   | Convocação institucional                |
| `recuperacao_senha`          | UTILITY   | Link de reset                           |
| `agenda_medica_disponivel`   | UTILITY   | Cronograma mensal                       |
| `comunicado_marketing`       | MARKETING | Único canal para campanhas (com opt-in) |

Ações:
- Marcar como **deprecated** no banco (`whatsapp_meta_templates.deprecated_at`) todos os nomes fora da lista; bloquear envio.
- Atualizar `register_templates.ts` para refletir só o catálogo acima, sem `_v2/_v3/_vN` automáticos.
- Reescrever textos seguindo "linguagem objetiva, neutra, institucional" — remover palavras gatilho (`última oportunidade`, `aproveite`, etc.).
- Cada template UTILITY recorrente recebe footer fixo: *"Para parar de receber este aviso, responda PARAR."*
- Remover de vez `ia_prontuario_informativo` da lista local.

---

## Fase 2 — Opt-in formal + preferências de contato

Nova tabela `contact_preferences` (chave por `clinic_id` + `phone`):

- `whatsapp_optin` (bool), `whatsapp_optin_at`, `whatsapp_optin_source` (`app | site | presencial | whatsapp | portal | formulario | import`)
- `whatsapp_optout` (bool), `whatsapp_optout_at`, `whatsapp_optout_source`, `optout_categories` (text[] — opcional, por categoria)
- `last_interaction_at`, `last_template_sent_at`, `last_template_name`
- `interaction_score` (int 0-100)

Migração de dados:
- Opt-out atual (`whatsapp_opt_outs`) → vira view + sincroniza para `contact_preferences.whatsapp_optout=true`.
- Opt-in inicial: todo associado ativo com `union_affiliation_date` válida + telefone confirmado no cadastro recebe `whatsapp_optin=true`, source=`presencial` (origem do contrato de filiação).

UI:
- Checkbox de consentimento explícito nos formulários de filiação PWA, cadastro presencial e portal do associado.
- Aba **"Preferências WhatsApp"** no perfil do associado (mobile + admin) para opt-in/opt-out manual.

---

## Fase 3 — Score de reputação + gate de envio

Função `public.calc_interaction_score(clinic_id, phone)` (security definer) retornando 0-100:

```
opt-out ativo                 → 0
respondeu nos últimos 7 d     → 100
respondeu nos últimos 30 d    → 80
só recebeu nos últimos 30 d   → 60
sem interação 30-90 d         → 40
sem interação 90-180 d        → 20
sem interação > 180 d         → 10
```

Helper `_shared/send-gate.ts` (novo) — toda edge function de envio (já listada na fase anterior + `send-appointment-reminders`, `boleto-whatsapp-flow`, `send-comunicado-whatsapp-batch`, `send-filiacao-notification`, `whatsapp-carteirinha-flow`, `meta-send-template`) chama `assertCanSend({ clinicId, phone, templateName, category, purpose })` que valida em ordem:

1. opt-out ativo → bloqueia.
2. score < 30 → bloqueia (exceto transacional crítico: `recuperacao_senha`, `consulta_cancelamento`).
3. Frequência: máx 1 mesma finalidade em 24h, 2 em 7 d, 5 em 30 d sem interação.
4. Categoria correta vs. uso (não enviar MARKETING sem opt-in marketing explícito).
5. Relacionamento ativo (associado ativo OU paciente com agendamento futuro/recente).
6. Bloqueio interno (`patients.blocked_whatsapp`).

Qualquer bloqueio → grava `whatsapp_policy_events` (já existe) + retorna `409` ao chamador.

---

## Fase 4 — Detecção de opt-out ampliada + categorias

`_shared/opt-out.ts` (já existe) expandido:
- Keywords aceitos (regex case-insensitive, trim, com/sem acento): `PARAR`, `SAIR`, `CANCELAR`, `CANCELAR AVISOS`, `REMOVER`, `DESCADASTRAR`, `STOP`, `UNSUBSCRIBE`.
- Resposta automática de confirmação (dentro da janela 24h): *"Você não receberá mais avisos automáticos. Para reativar, responda VOLTAR."*
- Suporte a opt-out por categoria (futuro): se mensagem original tinha contexto `template_category=marketing`, opt-out marca só `optout_categories=['marketing']`; caso contrário marca opt-out total.
- `meta-webhook` intercepta antes do roteamento normal e encerra ticket.

---

## Fase 5 — Auditoria e painel de qualidade

Nova tabela `whatsapp_template_logs`:
- `template_name`, `category`, `clinic_id`, `phone`, `sent_at`, `status` (`sent|delivered|read|failed|blocked_optout|blocked_score|blocked_rate|blocked_consent`), `reason`, `meta_message_id`, `meta_error_code`, `optin_source`, `interaction_score_at_send`, `triggered_by` (função/usuário), `purpose`.
- Webhook Meta de status (`messages.statuses`) atualiza `delivered`/`read`/`failed`.

Página admin `WhatsAppQualityPage` (nova, sob `/sindicato/whatsapp/qualidade`):
- KPIs: enviados, entregues, lidos, respondidos, taxa de confirmação (consulta), taxa de cancelamento, taxa de opt-out, taxa de bloqueio interno.
- Ranking de templates mais usados + taxa de resposta por template.
- Lista de contatos sem interação > 90 d (candidatos a limpeza).
- Lista de contatos bloqueados/opt-out com botão **Reativar** (apenas role admin sindicato).
- Alerta visual quando taxa de opt-out 7 d > 1% ou bloqueios Meta (131049/131045) aparecem.

`WhatsAppAuditPage` existente ganha aba **"Opt-outs"** linkada à mesma fonte.

---

## Fase 6 — Proteção contra envio massivo + revisão de campanhas

- `send-comunicado-whatsapp-batch` e `batch-send-boleto-whatsapp`: passam por `assertCanSend` por contato; lote nunca despacha sem opt-in confirmado quando categoria=MARKETING.
- Limite global por número Meta: máx **N envios/minuto** (configurável; default 30) com fila no edge function (já temos staggering recursivo para campanhas — reutilizar).
- Disparo "para toda a base" desabilitado na UI; substituído por seleção segmentada (`patient_segments`) + preview com contagem de bloqueados.
- Template MARKETING (`comunicado_marketing`) só pode ser disparado para contatos com `whatsapp_optin=true` AND `optin_source IN ('app','portal','site','formulario')` (consentimento digital comprovável).

---

## Detalhes técnicos resumidos

**Tabelas novas**
- `contact_preferences` (RLS por clinic_id + has_role admin; grants authenticated/service_role)
- `whatsapp_template_logs` (RLS admin; grants idem)
- coluna `whatsapp_meta_templates.deprecated_at` (alter)
- coluna `patients.blocked_whatsapp` (alter, default false)

**Helpers compartilhados**
- `_shared/send-gate.ts` (novo) — orquestra opt-out + score + rate + categoria + relacionamento.
- `_shared/template-catalog.ts` (novo) — lista canônica + finalidade + categoria; usado para validar `templateName` antes do POST Meta.
- `_shared/opt-out.ts` (expandir keywords + opt-out por categoria).
- `_shared/session-window.ts` (já existe — manter).
- `_shared/meta-interactive.ts` (já existe — manter, substituir últimos call sites inline).

**Edge functions impactadas** (todas as 12 já listadas no plano anterior + `whatsapp-ai-assistant` para responder com opt-out confirmation).

**Páginas/UI**
- Nova: `/sindicato/whatsapp/qualidade` (KPIs + listas).
- Atualizada: `WhatsAppAuditPage` (aba Opt-outs / Preferências).
- Atualizada: Filiação + Portal associado + Perfil mobile (consent checkboxes + tela "Preferências WhatsApp").
- Atualizada: tela de campanha — remover "enviar para todos", forçar seleção de segmento.

**Migração de dados**
- Backfill `contact_preferences` a partir de `patients`/`members`/`sindical_associados` (opt-in implícito de cadastro presencial).
- Backfill `interaction_score` a partir do histórico `whatsapp_ticket_messages`.

---

## Fora deste plano

- Reativação manual do número banido junto à Meta (processo humano — fornecemos as evidências de controles).
- Mudanças visuais não relacionadas a WhatsApp.
- Outros provedores (segue Meta Cloud API oficial).

---

## Perguntas antes de implementar

1. **Backfill de opt-in**: posso marcar associados ativos com telefone como `optin_source='presencial'` (origem contrato de filiação)? Ou prefere começar zerado e exigir reconfirmação ativa via PWA antes de qualquer disparo?
2. **Score mínimo de envio**: default 30 ok? (transacionais críticos como reset de senha sempre passam.)
3. **Rate limit global**: 30 msgs/minuto por número Meta é confortável, ou precisa mais (ex.: 60)?
4. **Fases**: implemento as 6 fases em sequência (1 PR cada, todas backend + UI) ou prefere priorizar 1+2+3+4 (compliance pura) agora e deixar 5+6 (painel + UI de campanhas) para uma segunda rodada?
