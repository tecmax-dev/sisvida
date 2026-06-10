# RC1 — Certificação Final (v1.0-meta-compliance-certified)

Data: 2026-06-10
Classificação: DOCUMENTAÇÃO (sem alterações de código, banco, edge functions ou configuração).

## 1. Arquitetura

| Componente | Função | Localização | Status |
|---|---|---|---|
| Compliance Engine | Validação pré-envio de templates Meta | `supabase/functions/_shared/` | Congelado |
| Safe Mode | Rate limits, manutenção, dry-run, go-live caps | `supabase/functions/_shared/safe-mode.ts` | Ativo (`META_SAFE_MODE=true`) |
| Strict Mode | Bloqueia templates fora do catálogo canônico | `supabase/functions/_shared/template-catalog.ts` | Ativo (`META_TEMPLATE_STRICT_MODE=true`) |
| Circuit Breaker | Interrompe envios em degradação detectada | `meta_safe_mode_config.circuit_breaker_open` | Habilitado |
| Health Score | Score consolidado de reputação/qualidade | Meta Health Dashboard | Monitorado |
| Template Governance | Validação estrutural de definição de templates | `supabase/functions/_shared/template-governance.ts` | Congelado |
| Meta Health Dashboard | Visualização de qualidade, status e alertas | `src/pages/admin/MetaWebhookHealthPage.tsx` | Operacional |

## 2. Templates canônicos

| Nome | Categoria | Finalidade | Status esperado |
|---|---|---|---|
| `consulta_confirmacao` | UTILITY | Confirmação de agendamento | APPROVED |
| `consulta_lembrete` | UTILITY | Lembrete D-1 / dia | APPROVED |
| `lembrete_consulta_v3` | UTILITY | Lembrete informativo único (RC1, sem CTA) | APPROVED |
| `consulta_cancelamento` | UTILITY | Cancelamento pelo profissional (crítico) | APPROVED |
| `carteirinha_vencendo` | UTILITY | Aviso 30/15/7 dias antes do vencimento | APPROVED |
| `carteirinha_vencida` | UTILITY | Aviso pós-vencimento | APPROVED |
| `boleto_disponivel` | UTILITY | Boleto/Lytex emitido | APPROVED |
| `homologacao_confirmada` | UTILITY | Confirmação de homologação | APPROVED |
| `assembleia_aviso` | UTILITY | Convocação institucional | APPROVED |
| `recuperacao_senha` | AUTHENTICATION | OTP de recuperação de senha (crítico) | APPROVED |
| `agenda_medica_disponivel` | UTILITY | Cronograma mensal de atendimentos | APPROVED |
| `comunicado_marketing` | MARKETING | Campanha institucional (requer opt-in) | APPROVED |

Templates fora desta lista são considerados deprecated/arquivados e bloqueados pelo Strict Mode.

## 3. Webhooks

- Endpoint: `https://czmnkrurkzuerrcjzbkp.supabase.co/functions/v1/meta-webhook`
- Verify Token: secret `META_WEBHOOK_VERIFY_TOKEN`
- Campos inscritos (assinatura manual no WhatsApp Manager):
  - `messages`
  - `message_template_status_update`
  - `message_template_quality_update`
  - `template_category_update`
  - `account_update`
  - `phone_number_quality_update`

## 4. Secrets obrigatórias (nomes apenas)

- `META_WHATSAPP_TOKEN`
- `META_PHONE_NUMBER_ID`
- `META_WABA_ID`
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`
- `META_SAFE_MODE`
- `META_MAINTENANCE_MODE`
- `META_TEMPLATE_STRICT_MODE`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

Valores nunca são exibidos; gerenciamento exclusivo via cofre de secrets do Lovable Cloud.

## 5. Fluxos certificados

- WhatsApp é **exclusivamente informativo** — sem CTA de resposta, sem botões Confirmar/Cancelar, sem segundo lembrete.
- IA é **exclusivamente receptiva** — só responde quando o associado inicia conversa dentro da janela de 24h. Nunca insiste, nunca reenvia.
- Aplicativo oficial (PWA `prosindweb.com.br`) é o **único canal** para confirmar, cancelar, reagendar ou gerenciar atendimentos, boletos e cadastros.

## 6. Go-Live gradual

| Stage | Contatos únicos / 24h | Janela de monitoramento |
|------:|----------------------:|------------------------|
| 1 | 20 | 72h |
| 2 | 100 | 72h |
| 3 | 500 | 7 dias |
| 4 | Ilimitado (produção gradativa) | Contínuo |

Controle via `meta_safe_mode_config.go_live_stage`.

### Critérios de parada (rollback imediato)

- Health Score < 80
- Quality Rating ≠ GREEN
- Opt-out / Blocked / Reported acima do esperado
- Circuit Breaker aberto
- Qualquer template `PAUSED` / `REJECTED` / `DISABLED`
- Volume inesperado de `blocked_safe_mode` ou `blocked_status`

## 7. Baseline oficial

- Documento de referência: [`docs/RC1_META_COMPLIANCE_BASELINE.md`](./RC1_META_COMPLIANCE_BASELINE.md)
- Tag oficial: **`v1.0-meta-compliance-certified`**
- Fonte única para qualquer rollback futuro.

RC1 está **certificado e congelado**. Quaisquer evoluções devem ocorrer em RC2 / v1.1.