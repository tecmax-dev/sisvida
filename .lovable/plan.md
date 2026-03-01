
Objetivo
Corrigir o motivo pelo qual lançamentos conciliados via OFX não aparecem em “Movimentação e Saldo > Extrato detalhado por portador” quando o OFX foi importado em um portador específico (ex.: “Conta Teste”).

Diagnóstico confirmado
1) O extrato detalhado lista somente lançamentos da tabela financeira do portador selecionado e com status “paid”.
2) Na conciliação manual atual, a lista de despesas pendentes não está restrita ao mesmo portador do lançamento OFX.
3) Resultado prático: a conciliação foi feita no OFX da “Conta Teste”, mas 38 vínculos foram gravados em despesas de outro portador (“Fluxo Sicoob”).  
4) Para “Conta Teste”, existe apenas 1 despesa conciliada e ainda com status “pending”; por isso ela também não entra no extrato detalhado (que filtra “paid”).

Plano de implementação
1) Blindar conciliação manual por portador (correção principal)
- Arquivo: src/components/union/financials/UnionManualReconcileDialog.tsx
- Ajustes:
  - Filtrar a lista de despesas para exibir apenas itens com cash_register_id igual ao cash_register_id do lançamento do extrato.
  - Aplicar esse filtro também na pré-seleção automática por número de cheque.
  - Exibir no topo do diálogo um aviso do portador do extrato para deixar explícito o contexto da conciliação.
- Resultado esperado:
  - Não será mais possível vincular OFX de um portador com despesa de outro portador.

2) Criar validação de segurança no backend da própria mutation (defesa em profundidade)
- Arquivo: src/hooks/useUnionReconciliation.ts
- Ajustes:
  - Antes de confirmar reconcile, buscar os financialTransactionIds selecionados e validar:
    - todos pertencem à mesma clinic_id;
    - todos possuem cash_register_id igual ao da statement transaction.
  - Se houver divergência, abortar com erro claro (“Não é permitido conciliar despesas de outro portador”).
- Resultado esperado:
  - Mesmo que a UI falhe no futuro, o vínculo cruzado entre portadores fica bloqueado.

3) Corrigir dados já conciliados incorretamente (seu caso atual)
- Ação de dados (sem alterar schema):
  - Identificar transações conciliadas do import da “Conta Teste” cujo matched_transaction_id aponta para despesa de outro portador.
  - Para esses casos:
    - remover conciliação da despesa financeira (is_conciliated=false, conciliated_at/by=null);
    - voltar o lançamento OFX para pending_review (ou status equivalente de revisão);
    - limpar matched_transaction_id/reconciled_at/reconciled_by para permitir reconciliação correta.
- Resultado esperado:
  - Você poderá reconciliar novamente, agora apenas com despesas da “Conta Teste”, e o extrato detalhado passará a refletir corretamente quando o status for “paid”.

4) Melhorar feedback no fluxo para evitar nova confusão
- Arquivos:
  - src/components/union/financials/UnionManualReconcileDialog.tsx
  - src/pages/union/UnionBankReconciliationPage.tsx (se necessário para mensagens)
- Ajustes:
  - Mostrar contagem “X despesas deste portador disponíveis”.
  - Mensagem quando não houver despesas do portador para vincular.
  - Se encontrar apenas despesas pending, orientar que “Movimentação e Saldo” mostra somente status pago.

5) Tratar consistência de indicadores pós-conciliação
- Arquivo: src/hooks/useUnionReconciliation.ts
- Ajustes:
  - Recalcular/atualizar transactions_reconciled no import após conciliar/desconciliar, para o card do OFX não ficar “0 conciliadas” quando já houve conciliações manuais.
- Resultado esperado:
  - Indicadores da tela de conciliação ficam alinhados com o estado real.

Validação (aceite)
1) Reconciliar novamente no OFX da “Conta Teste” escolhendo apenas despesas desse portador.
2) Marcar essas despesas como “paid” (se estiverem pendentes).
3) Abrir “Movimentação e Saldo”, selecionar “Conta Teste” e período correto.
4) Confirmar presença das transações na grade e no PDF.
5) Testar cenário negativo: tentar vincular despesa de outro portador e validar bloqueio.

Sequelas técnicas e risco
- Risco baixo de regressão visual (mudança concentrada no diálogo e na mutation).
- Risco médio em dados históricos se o reparo for aplicado de forma ampla; por isso farei o reparo de dados com filtro estrito por import/portador afetado.

Arquivos previstos para alteração
- src/components/union/financials/UnionManualReconcileDialog.tsx
- src/hooks/useUnionReconciliation.ts
- (opcional de UX) src/pages/union/UnionBankReconciliationPage.tsx

Observação técnica importante
- O extrato detalhado por natureza contábil usa apenas lançamentos “paid”.  
- Portanto, após corrigir o vínculo por portador, qualquer item ainda “pending” continuará fora do extrato até ser baixado/pago.
