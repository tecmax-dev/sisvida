# Nova página Sócios — versão de homologação isolada

## Diagnóstico (já feito)
- O menu lateral só tinha cores definidas para o tema escuro. No tema claro ele ficava sem cor de fundo e sem contraste, o que causou a aparência quebrada.
- Já corrigido: menu lateral branco no tema claro, item ativo com azul suave, largura de 224 px (64 px recolhido) e borda discreta. O tema escuro continua funcionando.
- As outras mudanças (Sócios, Empresas, Agenda e Atendimento) foram só de visual e não mexeram em dados, permissões nem regras.

## O que será feito
1. Criar uma página nova e separada, **Gestão de Sócios (prévia)**, só para administradores, em `/union/socios-v2`. A página atual de Sócios não muda.
2. Montar a página nova com:
   - Cabeçalho "Gestão de Sócios" / "Cadastro e acompanhamento de associados.", botão **Novo Sócio** e "Mais ações".
   - Quatro cartões compactos: Total, Ativos, Inativos e Convênios.
   - Abas: Titulares, Dependentes, Contribuições e Contracheques.
   - Uma barra única com busca, filtro de carteirinha, status, sincronizar e os filtros que já existem.
   - Tabela nova: nome do sócio em destaque, CPF/telefone discretos, status legível, ações no menu ⋮ e paginação organizada.
3. Usar exatamente as mesmas buscas, ações, telas de cadastro e permissões da página atual. Nada de lógica nova.
4. Tirar capturas da tela em 1920×1080, 1366×768, tablet e celular, e mostrar para você aprovar.
5. Só depois da sua aprovação, a página nova substitui a atual.

## Detalhes técnicos
- Página nova em `src/pages/union/members-v2/`, reaproveitando os hooks, as consultas e os diálogos de `UnionMembersListPage.tsx` (que fica intacta).
- A rota fica protegida pelas mesmas permissões de Sócios e também exige ser administrador.
- As capturas de tela precisam de uma conta conectada na pré-visualização: você entra na pré-visualização, ou indica qual conta de teste usar.
- Nenhuma mudança no banco de dados, nas funções do servidor, na autenticação ou nas integrações.
