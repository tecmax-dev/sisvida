# Agendamento de Consulta Médica via WhatsApp

Fluxo conversacional na Meta Cloud API, restrito ao número **(73) 98863-3535** para testes. Não toca em homologação.

## Whitelist
- Constante `BOOKING_WHITELIST` no webhook da Meta com `["5573988633535"]`.
- Quem não está na lista continua recebendo a mensagem padrão "disponível a partir de 30/05/2026".

## Fluxo conversacional

```text
1. Usuário envia "agendar" / clica botão "Agendar consulta"
2. Bot: "Informe seu CPF (somente números)"
3. Valida CPF → busca titular (members) + dependentes ativos
   - Bloqueios herdados:
     • cartão vencido (titular ou do dependente) → recusa com motivo
     • dependente "Filho(a)" > 21 anos → não listado
4. Bot lista: "Para quem é a consulta?"
   1) Titular - NOME
   2) Dependente - NOME (parentesco)
   ...
5. Bot lista profissionais ativos (com agenda configurada)
6. Bot lista próximas datas disponíveis (próximos 14 dias com slot livre,
   respeitando antecedência mínima, feriados, schedule._blocks)
7. Bot lista horários livres da data (parseDateOnlyToLocalNoon)
8. Confirmação: "Confirmar agendamento de X com Dr. Y em DD/MM às HH:mm? (sim/não)"
9. Cria appointment:
   - valida limite mensal por família
   - valida conflito do mesmo paciente
   - status 'scheduled', origem 'whatsapp'
10. Bot envia confirmação + endereço + instruções
```

Estado da conversa armazenado em nova tabela `whatsapp_booking_sessions` (phone, step, payload jsonb, expires_at 15min).

## Arquivos

**Novos**
- `supabase/functions/whatsapp-booking-flow/index.ts` — máquina de estados (handlers por step: ASK_CPF, PICK_PATIENT, PICK_PROFESSIONAL, PICK_DATE, PICK_TIME, CONFIRM).
- Migration: tabela `whatsapp_booking_sessions` + índice por phone + cleanup trigger.

**Editado**
- `supabase/functions/meta-webhook/index.ts`:
  - whitelist check
  - se telefone na whitelist e mensagem = "agendar" OU sessão ativa → delega para `whatsapp-booking-flow`
  - caso contrário, comportamento atual inalterado

## Regras aplicadas (todas confirmadas)
- Cartão vencido bloqueia (reuso de `patient_card_validation`)
- Antecedência mínima (`advance_booking_hours` do profissional/clinic)
- Limite mensal por família (titular+deps somados)
- Sem conflito do mesmo paciente (trigger DB existente garante)
- `schedule._blocks`, feriados, bloqueios de agenda
- Dependente "Filho(a)" só até 21 anos
- Datas via `parseDateOnlyToLocalNoon`
- `SINDICATO_CLINIC_ID` como contexto

## Como testar
1. Após deploy, enviar "agendar" do (73) 98863-3535.
2. Seguir o fluxo com CPF real do titular de teste.
3. Verificar appointment criado em `/agenda` no admin.
4. Testar bloqueios: CPF inválido, cartão vencido, conflito.
5. Enviar de outro número → deve receber a mensagem padrão de "disponível em 30/05/2026".

## Fora de escopo
- Homologação (intocada)
- Reagendamento/cancelamento via WhatsApp (fica para depois)
- Liberação geral (só após validação no número de teste)
