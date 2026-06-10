# RC1 — Meta Compliance v1.0 (Baseline Congelado)

Data de fechamento: 2026-06-10

## Política oficial

- WhatsApp = canal **exclusivamente informativo**.
- Aplicativo oficial = único canal para confirmar, cancelar, reagendar ou gerenciar atendimentos.
- IA: só responde quando o associado inicia. Nunca insiste, nunca reenvia, nunca mede confirmação por WhatsApp.

## Lembretes

- Apenas **um** lembrete por agendamento (24h antes).
- Sem segundo lembrete, sem reenvio, sem follow-up, sem `pending_confirmations`.
- Sem botões `Confirmar`/`Cancelar`, sem quick reply, sem CTA de resposta.

### Template padrão

```
Olá, {{1}}.
Lembramos que você possui um atendimento agendado para:
Data: {{2}}
Horário: {{3}}
Profissional: {{4}}
Caso seja necessário alterar ou cancelar seu atendimento, utilize exclusivamente o aplicativo oficial do Sindicato.
Esta é uma comunicação automática referente a um serviço previamente agendado.
Sindicato dos Comerciários.
```

### Termos proibidos em templates de lembrete

`Confirmar`, `Cancelar`, `Clique aqui`, `Responda SIM`, `Responda NÃO`, `Confirme seu agendamento`, qualquer quick reply ou CTA que induza resposta pelo WhatsApp.

## Templates em produção (RC1)

Manter apenas canônicos. Versões `_v2/_v3/teste/temp/novo` permanecem como deprecated até remoção pela Meta.

Ativos relevantes:

- `lembrete_consulta_v3` — lembrete informativo único (RC1).
- `consulta_confirmacao`, `consulta_cancelamento`, `boleto_disponivel`, `boleto_mensalidade`, `boleto_vencido`, `carteirinha_*`, `homologacao_confirmada`, `homologacao_protocolo`, `recuperacao_senha`, `codigo_acesso`, `atendimento_encerrado_inatividade`.

Deprecated (não disparar novos envios): `lembrete_consulta`, `lembrete_consulta_v2`, `homologacao_lembrete_v2/v3`, `homologacao_lembrete_profissional_v2/v3` (botões), todos `_v*` antigos com Quick Reply.

## Componentes congelados (NÃO alterar em RC1)

Compliance Engine, Safe Mode, Strict Mode, Template Governance, Meta Health Dashboard, Circuit Breaker, `assertCanSend`, `wa_can_send`, `meta-send-template`, `meta-send-text`, `meta-webhook`, `meta-sync-templates`.

Configuração obrigatória:

- Safe Mode: **on**
- Strict Mode (`META_TEMPLATE_STRICT_MODE`): **true**
- Circuit Breaker: **habilitado**
- Dry Run obrigatório antes de qualquer mudança de template.

## Métricas oficiais

Descontinuadas: Taxa de confirmação, Taxa de clique, Taxa de resposta.

Priorizar: Comparecimento, Opt-out, Blocked, Reported, Health Score, Quality Rating, Circuit Breaker, Delivery Rate, Read Rate.

## Go-Live gradual

| Stage | Contatos/dia | Janela de monitoramento |
|------:|-------------:|------------------------|
| 1     | 20           | 72h                    |
| 2     | 50           | 72h                    |
| 3     | 100          | 7 dias                 |
| 4     | produção gradativa | contínuo          |

Stage é controlado por `meta_safe_mode_config.go_live_stage` (já existente). Não criar novo schema.

## Critérios de parada (rollback imediato)

- Health Score < 80
- Quality Rating ≠ GREEN
- Opt-out acima do esperado
- Circuit Breaker aberto
- Qualquer template PAUSED / REJECTED / DISABLED
- `blocked_safe_mode` ou `blocked_status` inesperado em volume

## Política de alteração durante RC1

Aceito: **BUG**, **CONFIGURAÇÃO**, **SEGURANÇA**, **DOCUMENTAÇÃO**.

Proibido: novos templates, automações, fluxos, lembretes, webhooks, integrações, migrations. Melhorias → RC2/v1.1.

## Validação final

- Arquivos alterados nesta entrega: este documento + `mem://features/whatsapp/meta-templates-sindicato.md` (descrição da política) + `mem://index.md`.
- Fluxos removidos: segundo lembrete, botões Confirmar/Cancelar em lembretes, `pending_confirmations` em lembretes, Whazing paralelo em lembretes.
- Fluxos ativos: lembrete informativo único, confirmação pós-agendamento, boletos, carteirinha, homologação (sem botões em lembretes), IA receptiva na janela 24h.
- Compliance Engine, Safe Mode, Strict Mode, Template Governance, Circuit Breaker, Meta Health Dashboard: **intactos**.

RC1 está **congelado** como baseline oficial. Próximas evoluções → RC2/v1.1.