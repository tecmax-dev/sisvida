# Fila de Espera Inteligente para Agendamentos Médicos

Hoje já existe uma "lista de espera" simples (tabela `waiting_list`, notificação por WhatsApp ao cancelar no calendário administrativo). Ela não tem FIFO garantido, não tem ofertas com expiração, não tem aceite pelo app e não tem toggle. O plano evolui isso para o fluxo completo descrito, reaproveitando a tabela existente e adicionando a camada de ofertas.

## 1. Banco de dados

**`waiting_list` (fila) — campos novos**
- `queue_position` (ordem FIFO, atribuída por trigger na inserção, por clínica+profissional)
- `queue_status`: `ATIVO | OFERTADO | ACEITO | RECUSADO | EXPIRADO | REMOVIDO`
- `specialty_id`, `source` (`app` / `painel`), `entered_at`
- Índice único parcial: um associado ativo por profissional.

**`waiting_list_offers` (nova) — oferta de vaga**
- `waiting_list_id`, `clinic_id`, `patient_id`, `professional_id`
- `cancelled_appointment_id`, `appointment_date`, `start_time`, `end_time`
- `offered_at`, `expires_at`, `responded_at`
- `status`: `PENDENTE | ACEITA | RECUSADA | EXPIRADA`
- `created_appointment_id`
- Índice único parcial: uma oferta PENDENTE por slot (garante que dois dispositivos não reservem a mesma vaga).

**`clinics` — configuração**
- `waiting_list_enabled` (boolean, default false)
- `waiting_list_offer_timeout_minutes` (int, default 30)

**Funções/RPC (SECURITY DEFINER, transacionais)**
- `wl_join_queue(...)` — entra na fila, calcula posição FIFO, bloqueia duplicidade.
- `wl_offer_next_slot(...)` — pega o 1º da fila (`FOR UPDATE SKIP LOCKED`) e cria a oferta.
- `wl_accept_offer(offer_id)` — revalida disponibilidade, cria o agendamento, marca fila como ACEITO, tudo em transação; retorna erro `slot_taken` se já ocupada.
- `wl_decline_offer(offer_id)` — recusa, remove da fila e oferta ao próximo.
- `wl_expire_offers()` — expira pendentes vencidas e passa ao próximo (rodada por cron).

**RLS**
- Associado (mobile/PWA) só lê e responde a própria fila/ofertas.
- Operadores da clínica leem tudo, podem remover da fila e reenviar oferta, mas **não** podem aceitar em nome do associado nem reordenar (sem UPDATE em `queue_position`).
- Toggle só editável por admin/owner.

## 2. Backend (edge functions)

- `waiting-list-offer` — dispara a oferta ao cancelar: chama `wl_offer_next_slot`, envia push (OneSignal), notificação interna (`patient_notifications`) e WhatsApp opcional.
- `waiting-list-respond` — aceitar/recusar vindo do app (valida sessão do associado, chama a RPC correspondente).
- `waiting-list-expire` — job agendado (pg_cron a cada 5 min) chamando `wl_expire_offers` e ofertando ao próximo.
- Auditoria: todos os eventos gravados em `audit_logs` (entrada na fila, oferta criada/aceita/recusada/expirada, agendamento criado, remoção, alteração do toggle).

## 3. Configurações (Painel)

Em **Configurações → Agendamentos**, nova seção **Fila de Espera**:
- Toggle "Fila de Espera Automática" (Ativada/Desativada) + descrição
- Campo "Tempo máximo de resposta da oferta" (minutos)
- Visível e editável apenas para Administrador Master / Gestor Admin (oculto para os demais e bloqueado por RLS).

## 4. Painel Administrativo — menu "Fila de Espera"

Substitui/expande a página atual `WaitingListPage`:
- Lista por profissional: quantidade na fila, primeiro da fila, tempo médio de espera, ofertas pendentes, ofertas expiradas.
- Ao abrir um profissional: ordem numerada (1º, 2º, 3º) com horário de entrada.
- Ações: Visualizar, Remover da fila, Reenviar oferta, Histórico (linha do tempo de auditoria).
- Sem qualquer ação de reordenação manual.

## 5. App/PWA do associado

- **Booking** (`MobileBookingPage`): quando não houver horários para o profissional escolhido e o recurso estiver ativo, exibir o card "Não há vagas disponíveis… Deseja entrar na fila de espera?" com os botões **Entrar na fila** / **Cancelar**, e a mensagem de confirmação.
- **Oferta de vaga**: modal/card destacado na home com profissional, data, horário, contador regressivo e botões **✅ Aceitar vaga** / **❌ Recusar**; badge de nova oportunidade no sino de notificações + push.
- **Novo menu "Minhas Filas de Espera"**: profissional, especialidade, data de entrada, posição na fila e status (Aguardando / Oferta Recebida / Aceita / Recusada / Expirada).

## 6. Integração com cancelamentos

- Cancelamento e no-show no calendário administrativo (`CalendarPage`) e cancelamento pelo app passam a chamar automaticamente o fluxo de oferta, sem ação extra do operador.
- Se o toggle estiver desativado, mantém-se o comportamento atual (vaga simplesmente liberada).

## Notas técnicas

- Concorrência resolvida no banco (`SELECT ... FOR UPDATE SKIP LOCKED` + índice único parcial na oferta pendente e no slot do agendamento), então dois aceites simultâneos resultam em um sucesso e a mensagem "Esta vaga já foi ocupada por outro associado".
- FIFO é imutável: posição atribuída por trigger, nenhuma rota de escrita expõe reordenação.
- Datas seguem `parseDateOnlyToLocalNoon` conforme o padrão do projeto.
- A expiração depende de pg_cron/pg_net (já usados no projeto).
