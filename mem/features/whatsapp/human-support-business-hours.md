---
name: WhatsApp Human Support Business Hours
description: Janela de atendimento humano no fluxo /sindicato do WhatsApp
type: feature
---
Horário de atendimento humano (Sindicato/WhatsApp):
- Segunda a sexta-feira, das **09h às 16h** (contínuo, SEM intervalo de almoço)
- Não atende em feriados (consulta clinic_holidays + recurring)
- Fora do horário: IA oferece abrir chamado via `abrir_chamado_atendimento`
- Implementado em supabase/functions/whatsapp-ai-assistant/index.ts (getBrazilianDateTime), mensagens em check-whazing-open-tickets, e bloqueio direto dos botões `whazing_sub_outros`/`falar_atendente` em `meta-webhook` e `whatsapp-clean-flow`
