# Plano de Implementação: Ocultar Boletos em Duplicidade no Relatório

O objetivo é adicionar uma opção no relatório de empresas com contribuições vencidas para ocultar boletos que pareçam duplicados (mesmo valor, mesma empresa, mesma competência ou competências diferentes, conforme solicitado), facilitando a visualização quando uma empresa emite uma contribuição errada e gera outra para corrigir sem cancelar a anterior.

## Alterações Propostas

### Frontend

#### `src/pages/union/UnionOverdueReportPage.tsx`
- Adicionar um novo estado `hideDuplicates` (booleano) iniciado como `false`.
- Incluir um checkbox na seção de filtros para alternar essa opção.
- Atualizar a lógica do `useMemo` que gera os `rows` ou o `grouped` para filtrar duplicatas quando a opção estiver ativa.
- A regra de duplicidade será: se houver múltiplas contribuições para a mesma empresa com o **exatamente o mesmo valor**, manter apenas a mais recente (ou a que parecer ser a correção), ocultando as demais.

## Detalhes Técnicos
- O filtro será aplicado no `useMemo` de `rows` ou logo antes do agrupamento para garantir que os totais sejam recalculados corretamente.
- A lógica de identificação de duplicidade considerará: `employer_id` + `value`. Se o usuário preferir uma regra mais estrita (como mesma competência), podemos ajustar, mas o pedido menciona "mesmo que em contribuições diferentes".

## Verificação
- Abrir o relatório de inadimplência.
- Marcar a opção "Ocultar boletos em duplicidade".
- Verificar se o valor total vencido e a lista de contribuições são atualizados, removendo entradas redundantes de mesmo valor para a mesma empresa.
