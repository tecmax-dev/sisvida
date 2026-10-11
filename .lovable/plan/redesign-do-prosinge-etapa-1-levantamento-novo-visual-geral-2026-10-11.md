# Redesign do Prosinge: Etapa 1 (levantamento + novo visual geral e menu lateral)

## Objetivo desta etapa
Começar pelo que o pedido define como prioridade: o levantamento do sistema e o novo visual geral. Painel inicial, Sócios, Empresas e Agenda ficam para as próximas etapas, cada uma aprovada separadamente. Nada de cobrança, gravação, WhatsApp, permissões ou dados será alterado.

## O que será feito

1. **Levantamento (sem mudar nada)**
   - Listar todas as páginas reais das áreas Sindicato, Clínica e Administração, com quem pode ver cada uma.
   - Registrar os riscos: páginas com rolagem própria, telas de impressão, portais externos e o app do associado, que **não** entram nesta mudança.

2. **Padrão visual único**
   - Fundo cinza bem claro, cartões brancos com bordas suaves e sombras discretas, mantendo o verde institucional.
   - Botões, etiquetas de situação, tabelas, janelas e campos padronizados.
   - Modo claro e modo escuro preservados.

3. **Novo menu lateral (no lugar dos menus suspensos do topo)**
   - Logo Prosinge, nome da área ativa (Sindicato, Clínica ou Administração) e grupos com subitens que abrem e fecham.
   - Destaque da página aberta e campo para buscar uma função pelo nome.
   - Botão para recolher o menu, deixando só os ícones (com o nome ao passar o mouse). O menu lembra se ficou recolhido.
   - Mostra **somente** o que o usuário pode acessar, usando exatamente as mesmas regras de hoje. Nenhum item novo inventado e nenhum removido.
   - No celular, o menu abre deslizando pela lateral.

4. **Nova barra superior compacta**
   - Caminho da página (ex.: Sindicato › Sócios), avisos, troca de tema claro/escuro e menu do usuário.
   - Sem repetir o que já está no menu lateral.

5. **Conferência**
   - Abrir telas representativas em computador e celular, verificando menus, permissões e que as páginas continuam funcionando.

## Próximas etapas (cada uma com plano próprio)
Painel inicial → Sócios → Empresas → Agenda → demais telas internas → conferência final.

## Detalhes técnicos
- Novo `AppShell` com o `Sidebar` do shadcn, usado por `DashboardLayout` e `UnionModuleLayout`; `AdminLayout` passa a usar o mesmo shell.
- Os itens do menu vêm dos hooks já existentes (`useMainNavCategories`, `useUnionNavCategories` e a navegação do admin), que já filtram por permissão. `DashboardHeaderNav` fica sem uso, mas não é apagado nesta etapa.
- Ajustes de cores e sombras só nos tokens de `index.css`/`tailwind.config.ts`, sem cores fixas nos componentes.
- O estado de menu recolhido é guardado no navegador. Isso é só preferência visual, não autorização.
- Não serão alterados: portais de empresa/contador, app/PWA `/app`, páginas públicas, funções do backend e banco de dados.
