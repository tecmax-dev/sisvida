# Plano de Correção: Ação "Nova Contribuição" em Modais

O usuário relatou que ao clicar em "Nova Contribuição" dentro dos modais de edição de Sócios e Empresas, o sistema não executa nenhuma ação. O objetivo é restaurar a funcionalidade de criação de contribuições nessas interfaces.

## Problema Identificado
1.  No componente `EmployerDetailPage.tsx` (usado no modal de Empresa), a propriedade `onOpenCreateDialog` passada para `EmployerContributionsTab` é uma função vazia `() => {}`.
2.  No componente `UnionMemberDetailPage.tsx` (usado no modal de Sócio), não existe uma aba de contribuições implementada, embora a aba "Dados Sindicais" exista. Contudo, o usuário especificou "clique em contribuição, nova", indicando que ele espera essa funcionalidade nos modais.

## Alterações Propostas

### 1. Componente de Detalhes da Empresa (`src/pages/dashboard/EmployerDetailPage.tsx`)
*   Implementar o estado `isCreateDialogOpen` para controlar a abertura do diálogo de nova contribuição.
*   Passar a função correta para abrir o diálogo para o componente `EmployerContributionsTab`.
*   Importar e renderizar o componente `EmployerContributionDialog` (que deve ser o diálogo padrão para empresas). *Nota: Preciso verificar o nome correto do componente de diálogo para empresas, pois `EmployerContributionDialog.tsx` não foi encontrado anteriormente, talvez esteja em `src/components/contributions/`.*

### 2. Componente de Detalhes do Sócio (`src/pages/union/UnionMemberDetailPage.tsx`)
*   Adicionar a aba "Contribuições" ao menu lateral e ao conteúdo principal.
*   Importar e integrar o componente `MemberContributionsTab` ou similar que permita gerenciar as contribuições do sócio individualmente dentro do modal.
*   Garantir que o botão "Nova" dentro desse componente esteja funcional, abrando o `PFContributionDialog`.

### 3. Ajustes de Contexto e Dados
*   Garantir que após a criação de uma nova contribuição, a lista no modal seja atualizada chamando `fetchData`.

## Detalhes Técnicos
*   Utilizar os diálogos já existentes: `PFContributionDialog` para Sócios (Pessoa Física) e o diálogo correspondente para Empresas.
*   Manter a consistência visual Teal/Glass-effect aplicada anteriormente.
