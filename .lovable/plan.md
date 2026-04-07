
Objetivo: corrigir de forma definitiva o bloqueio da edição de convênio no cadastro de sócios em `/sindicato`, já que o campo está sendo desabilitado pela UI mesmo quando a permissão deveria estar liberada.

1. Confirmar a causa raiz na camada de permissões
- O campo “Convênio” é bloqueado apenas por `canEditMemberConvenio()` em `src/pages/union/UnionMemberDetailPage.tsx`.
- Esse valor vem de `useUnionPermissions`, que por sua vez delega para `usePermissions`.
- Pela leitura do banco, a permissão `union_edit_member_convenio` existe, mas não aparece nas permissões efetivas da Tatiane via `get_user_permissions(...)`.
- Isso indica que o problema real está na atribuição/propagação da permissão, não no componente do formulário.

2. Corrigir o cadastro/listagem de permissões no gerenciamento de grupos
- Revisar `src/pages/union/UnionAccessGroupsPage.tsx` para garantir que a permissão `union_edit_member_convenio` apareça no grupo “Recepcionista Sênior”.
- Hoje a tela carrega permissões de `permission_definitions`, então é provável que a permissão não esteja sendo exibida corretamente por ordenação/categoria/filtro de módulo ou por ausência de seed complementar.
- Implementar exibição confiável dessa permissão na categoria “Sindical - Sócios”.

3. Corrigir a base de permissões do sistema
- Adicionar uma migration para garantir que `union_edit_member_convenio` exista oficialmente em `permission_definitions` com:
  - `module_type = 'union'`
  - categoria `Sindical - Sócios`
  - nome amigável “Alterar Convênio do Sócio”
- Validar se ela precisa de `order_index` para aparecer no lugar certo na tela.

4. Corrigir a propagação da permissão para grupos de acesso
- Verificar se o fluxo de salvar permissões de grupos sindicais está persistindo essa chave específica em `access_group_permissions`.
- Se necessário, ajustar o salvamento para evitar que permissões novas/fora de listas antigas sejam descartadas silenciosamente.
- Garantir que, após salvar, o grupo “Recepcionista Sênior” retenha `union_edit_member_convenio`.

5. Endurecer a lógica de leitura no frontend
- Em `usePermissions.ts`, manter a priorização do contexto sindical em rotas `/union` e `/sindicato`.
- Adicionar logging defensivo temporário e/ou tratamento explícito para facilitar diagnóstico quando a permissão existir no grupo, mas não vier em `dbPermissions`.
- Se houver cache de React Query segurando estado antigo, invalidar/refrescar a query de permissões após salvar grupos.

6. Validar a tela do sócio
- Confirmar que `PatientFormFields` continue usando `canEditConvenio`, mas que o valor reflita corretamente a permissão atualizada.
- Testar o cenário real:
  - usuário Tatiane Santos
  - grupo “Recepcionista Sênior”
  - rota `/sindicato` → `/union` → Sócios
  - campo “Convênio” habilitado quando a permissão estiver marcada
  - mensagem “Sem permissão para alterar” não deve aparecer nesse caso

Detalhes técnicos
- Arquivos principais:
  - `src/hooks/usePermissions.ts`
  - `src/hooks/useUnionPermissions.ts`
  - `src/pages/union/UnionMemberDetailPage.tsx`
  - `src/components/patients/PatientFormFields.tsx`
  - `src/pages/union/UnionAccessGroupsPage.tsx`
  - nova migration em `supabase/migrations/...sql`
- Evidência já encontrada:
  - a UI desabilita o select apenas por `canEditConvenio`
  - a permissão existe em `permission_definitions`
  - Tatiane está no grupo `Recepcionista Sênior`
  - as permissões efetivas retornadas para ela não incluem `union_edit_member_convenio`
- Conclusão prática:
  - o bug está entre “permissão marcada no grupo” e “permissão efetivamente retornada ao usuário”, não no campo em si

Resultado esperado após implementação
- Ao marcar “Alterar Convênio do Sócio” no grupo sindical correto e salvar, usuários desse grupo passam a editar o convênio imediatamente na tela de sócio.
