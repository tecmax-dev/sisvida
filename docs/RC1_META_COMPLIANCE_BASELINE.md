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

## Apêndice A — Alinhamento Final do Catálogo Meta (2026-06-10)

Objetivo: consolidar oficialmente o catálogo Meta no padrão RC1. Sem alterações estruturais; apenas classificação.

### Template oficial de lembrete

- **`lembrete_consulta_v3`** — UTILITY, sem botões, sem quick reply, sem CTA. Texto definido em "Template padrão" acima. Único template autorizado para lembretes de consulta após APPROVED.

### Template legado (DEPRECATED em RC1)

- **`lembrete_consulta_v2`** — APPROVED na Meta, porém **DEPRECATED em RC1** por possuir Quick Reply (Confirmar/Cancelar), incompatível com a política informativa. **Não utilizar em nenhum fluxo automático.** Mantido apenas por compatibilidade histórica até remoção pela Meta.

### Classificação do catálogo

**ATIVOS (RC1):**
- `retomar_atendimento`
- `lembrete_consulta_v3`
- `recuperacao_senha`
- `boleto_disponivel`
- `homologacao_confirmada`
- `comunicado_marketing`

**LEGACY / DEPRECATED (não usar, manter por histórico):**
- `lembrete_consulta_v2`
- `iniciar_atendimento`
- `iniciar_atendimento_v2`
- `hello_world`

### Política RC1 reafirmada

- WhatsApp = canal **exclusivamente informativo**.
- Aplicativo oficial = **único canal** para confirmar, alterar ou cancelar atendimentos.
- Lembretes não devem conter botões, Quick Replies, CTA de resposta, "SIM", "NÃO", "Confirmar", "Cancelar" ou "Clique".
- Qualquer tentativa de fluxo automático usar `lembrete_consulta_v2` deve ser registrada como `LEGACY_TEMPLATE_ATTEMPT` (auditoria apenas, sem alterar Compliance Engine).

### Go-Live

- Não registrar novos templates além dos estritamente necessários. Catálogo Meta deve permanecer **pequeno, limpo e estável**.

### Relatório final

- Fluxos ativos: lembrete informativo único (`lembrete_consulta_v3`), confirmação pós-agendamento, boletos, carteirinha, homologação sem botões em lembretes, IA receptiva na janela 24h.
- Fluxos deprecated: `lembrete_consulta_v2`, lembretes com botões, segundo lembrete, follow-up automático.
- Nenhum lembrete utiliza botões ou Quick Replies.
- WhatsApp confirmado como exclusivamente informativo.
- Aplicativo confirmado como único canal oficial de gestão.
- **Nenhuma alteração estrutural foi realizada.** RC1 permanece congelado.

### Declaração final

RC1 é a **baseline oficial do projeto**. Qualquer nova automação, template, integração ou alteração comportamental deve ser classificada para **RC2 / v1.1**. Prioridades permanentes, em ordem:

1. Reputação do número Meta
2. Experiência do associado
3. Estabilidade operacional
4. Compliance
5. Governança
6. Simplicidade