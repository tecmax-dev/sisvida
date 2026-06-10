# Meta Safe Mode — Camada adicional de proteção

Objetivo: adicionar guard-rails operacionais **acima** do Compliance Engine. Nada do fluxo atual muda; o Safe Mode apenas pode **bloquear preventivamente** envios automáticos antes de chegar em `meta-send-template` e expor health/auditoria no dashboard.

## Princípios
- Zero alteração em: `_shared/template-catalog.ts`, STRICT_MODE, `assertCanSend`, `wa_can_send`, `meta-send-template`, `meta-send-text`, `meta-webhook`.
- Toda lógica nova fica em `_shared/safe-mode.ts` + nova tabela `meta_safe_mode_config` + tabela de auditoria.
- Flags por env (`META_SAFE_MODE`, `META_MAINTENANCE_MODE`) **e** por linha em DB (DB tem prioridade quando existir).
- Não cria cron novo nem altera assinaturas públicas.

## 1. Migration (única)
Tabelas novas:
- `meta_safe_mode_config` (singleton, id fixo): `safe_mode bool`, `maintenance_mode bool`, `dry_run bool`, `max_per_hour int`, `max_per_day int`, `max_per_contact_30d int`, `circuit_breaker_open bool`, `circuit_reason text`, `circuit_opened_at`, `go_live_stage int` (0-4), `go_live_started_at`, `manual_override bool`.
- `meta_safe_mode_audit`: `field`, `old_value jsonb`, `new_value jsonb`, `changed_by uuid`, `reason text`, `created_at`.
- View `meta_health_score_v` calculando 0-100 a partir de `whatsapp_template_logs` (últimas 24h), `whatsapp_meta_templates` (REJECTED/PAUSED), `whatsapp_opt_outs`, falhas Graph.
- GRANTs + RLS (admin-only via `has_role`).

## 2. `_shared/safe-mode.ts` (novo)
Funções puras:
- `loadSafeConfig(supabase)` → cacheável.
- `checkSafeMode({ supabase, templateName, category, contactPhone, triggerSource })` → retorna `{ allowed: bool, reason?, dryRun?: bool }`.
  - Sempre permite: `human-operator`, `AUTHENTICATION`, `meta-send-text` (janela 24h).
  - Em `maintenance_mode`: bloqueia automáticos.
  - Em `circuit_breaker_open`: bloqueia automáticos.
  - Em `safe_mode`: aplica rate limits + go-live stage (cap de contatos únicos por janela).
- `computeHealthScore(supabase)` → 0-100 + breakdown.
- `tripCircuitBreakerIfNeeded(supabase)` → chamado opcionalmente após logs; abre breaker se thresholds estourados.

## 3. Integração mínima (não invasiva)
- `meta-send-template/index.ts`: **uma chamada** `checkSafeMode(...)` logo após resolver template e ANTES de `assertCanSend`. Se `dryRun`, retorna 200 com `{ simulated: true, would_send: bool, reasons: [...] }` sem tocar Graph. Se bloqueado, retorna 423 + log em `whatsapp_template_logs` com `reason='safe_mode_blocked:<...>'`. Assinatura pública preservada (mesmos campos de entrada/saída + campos extras opcionais).
- Nada mais alterado em outras edge functions.

## 4. Edge function nova: `meta-safe-mode-admin`
GET retorna config + health score + breakdown.
POST atualiza campos (admin only), grava `meta_safe_mode_audit`, reseta breaker manualmente.

## 5. Dashboard `/admin/meta-health`
Adicionar aba **Safe Mode**:
- Toggles: Safe Mode, Maintenance, Dry Run, Circuit Breaker (reset).
- Inputs: limites/hora/dia/contato.
- Seletor Go-Live stage (Semana 1/2/3/4/Total) + override manual.
- Card Health Score (0-100) com cor e breakdown.
- Tabela últimos 20 eventos de auditoria.

## 6. Go-Live wizard
Implementado como `go_live_stage` no config:
- 0=desligado, 1=≤20 contatos únicos/dia, 2=≤100, 3=≤500, 4=ilimitado.
- Verificação em `checkSafeMode` consulta `whatsapp_template_logs` (distinct phone últimas 24h).
- Admin pode pular stages com `manual_override`.

## 7. Auditoria
Trigger `before update` em `meta_safe_mode_config` grava diffs em `meta_safe_mode_audit` (user via `auth.uid()` quando disponível, senão NULL + reason do POST).

## Arquivos
**Criar:**
- `supabase/migrations/<ts>_meta_safe_mode.sql`
- `supabase/functions/_shared/safe-mode.ts`
- `supabase/functions/meta-safe-mode-admin/index.ts`
- `src/pages/admin/MetaSafeModePage.tsx` (ou nova aba dentro de `MetaHealthDashboard.tsx`)

**Editar (mínimo):**
- `supabase/functions/meta-send-template/index.ts` (+ ~15 linhas)
- `src/pages/admin/MetaHealthDashboard.tsx` (+ aba Safe Mode)

## Não-objetivos
- Não muda `TEMPLATE_CATALOG`, STRICT_MODE, `wa_can_send`, webhook, sync.
- Não cria cron. Health score é calculado on-demand pela view.
- Não muda mensagens livres <24h nem operador humano.

Confirmar para implementar?
