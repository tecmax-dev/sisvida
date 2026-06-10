# RC1 – Política Informativa de Lembretes WhatsApp

WhatsApp = canal informativo. Gerenciamento de agendamento = somente no app oficial.

## Escopo (somente texto/fluxo, sem mudanças estruturais)

Não tocar: Compliance Engine, Safe Mode, Strict Mode, Template Governance, Meta Health Dashboard, `assertCanSend`, `wa_can_send`, `meta-send-template`, `meta-send-text`, `meta-webhook` (núcleo), `meta-sync-templates`. Sem migrations, sem novas tabelas.

## Templates a atualizar (novo body padrão, sem botões)

Body padrão único:

```
Olá, {{1}}.

Lembramos que sua consulta está agendada para:

Data: {{2}}
Horário: {{3}}
Profissional: {{4}}

Caso seja necessário alterar ou cancelar seu agendamento, utilize exclusivamente o aplicativo oficial do Sindicato.

Sindicato dos Comerciários
```

Templates impactados (criar novas versões `_v3`/`_v2` quando o nome estiver bloqueado pela Meta):
- `lembrete_consulta_v2` → novo `lembrete_consulta_v3` (UTILITY, sem botões, 4 vars)
- `homologacao_lembrete_v3` → novo `homologacao_lembrete_v4` (UTILITY, sem botões)
- `homologacao_lembrete_profissional_v3` → novo `homologacao_lembrete_profissional_v4` (UTILITY, sem botões)
- Catálogo canônico (`_shared/template-catalog.ts`): `consulta_lembrete` permanece, descrição atualizada para "informativo, sem CTA de resposta".

Registro: via `meta-register-templates` action existente (sem alterar a função). Apenas adicionar definições novas.

## Edge Functions de fluxo a ajustar

1. `send-appointment-reminders/index.ts`
   - Trocar template por `lembrete_consulta_v3`.
   - Remover componente `BUTTONS` (quick replies Confirmar/Cancelar).
   - Remover envio paralelo de botões Whazing.
   - Manter um único disparo; remover qualquer lógica de "segundo lembrete" por ausência de resposta.

2. `send-homologacao-reminders/index.ts` + `src/lib/homologacaoUtils.ts`
   - Trocar para `homologacao_lembrete_v4` / `homologacao_lembrete_profissional_v4`.
   - Remover botões e variável de URL "Reagendar".
   - Texto institucional referenciando o app oficial.

3. `send-uiara-april28-reminders/index.ts`
   - Reescrever templates de texto removendo "Confirmar"/"Cancelar".
   - Remover `sendConfirmationButtons` e o segundo disparo Whazing.

4. `test-reminder-message/index.ts`
   - Atualizar payload de teste para o novo body sem botões.

5. `meta-webhook/index.ts`
   - Remover handler que captura quick-reply `confirm_apt_*` / `cancel_apt_*` originados de lembretes (manter handlers de fluxos espontâneos não relacionados a lembrete, ex.: boleto/menu inicial dentro da janela 24h).
   - Não alterar verificação de assinatura, dedupe, nem roteamento principal.

## UI/KPIs

- `src/pages/admin/WhatsAppStatusPage.tsx` e dashboards de lembrete: remover cartões "Taxa de confirmação", "Taxa de resposta", "Taxa de clique" relacionados a lembrete. Priorizar: Quality Rating, Health Score, Opt-out, Bloqueios, Circuit Breaker (já existentes).
- Sem mudanças de schema; apenas esconder/retirar widgets.

## IA receptiva

- Confirmar que nenhum job agendado dispara mensagem "follow-up" de lembrete. Buscar e remover qualquer cron/trigger de "segundo lembrete". Edge `send-appointment-reminders` continua agendada uma vez por agendamento.

## Memória do projeto

- Atualizar `mem://features/whatsapp/meta-templates-sindicato.md` documentando a nova política (sem botões, sem CTA de resposta, app como canal de ação) e marcando v2/v3 com botões como deprecated.

## Validação

- Buscar no repo strings remanescentes: `Confirmar`, `Cancelar`, `Responda SIM`, `Confirme sua consulta`, `confirm_apt_`, `cancel_apt_` em contexto de lembrete; garantir remoção apenas onde ligadas a lembrete (não tocar em telas do app onde o usuário cancela pelo PWA).
- Rodar `meta-register-templates` (manual pelo usuário) para os novos nomes, aguardar aprovação Meta, então fazer cut-over das edge functions para o template novo via env/flag já existente — sem deploy crítico no Compliance Engine.

## Entregáveis

- Arquivos alterados conforme lista acima.
- Templates novos definidos no catálogo + governance.
- Relatório final: arquivos, templates, fluxos, confirmações/cancelamentos removidos, lembretes mantidos, validação RC1 ("nenhuma alteração estrutural").
