# Redesign Prosinge: Etapa 1, levantamento

## Molduras (layouts) e onde o novo menu lateral se aplica
| Área | Rotas | Moldura | Itens do menu vêm de | Filtro de acesso |
|---|---|---|---|---|
| Clínica | `/dashboard/*` | `DashboardLayout` → `AppShell` | `navCategories` (no próprio layout) + `useUnionNavCategories` quando a clínica tem entidade sindical | `hasPermission`, add-ons, recursos do plano, módulo Clínica |
| Sindicato | `/union/*` | `UnionModuleLayout` → `AppShell` | `useUnionNavCategories` + `useMainNavCategories` | `useUnionPermissions`, admin da entidade, plano (`mobile_app`) |
| Super admin | `/admin/*` | `AdminLayout` → `AppShell` | `adminNavItems` agrupados | rota protegida para super admin |

## Fora do escopo (não alterados)
- Portais de empresa e contador (`PortalLayout`, `SindSystemLayout`).
- App/PWA do associado (`/app`, `MobileLayout`).
- Páginas públicas, landing, links por token (boleto, confirmação, assinatura).
- Funções do backend, banco de dados, WhatsApp, cobrança.

## Riscos observados
- Páginas com rolagem própria (agenda, kanban WhatsApp): a área de conteúdo mantém `overflow-y-auto`, igual ao comportamento anterior.
- Telas de impressão usam rotas/janelas próprias e não dependem da moldura.
- `DashboardHeaderNav` ficou sem uso; mantido para eventual reversão.
- O estado "menu recolhido" fica no navegador (`prosinge-sidebar-collapsed`) e é apenas preferência visual.

## Padrão visual
- Fundo cinza claro (`--background`), cartões brancos (`--card`), menu lateral branco com destaque em `primary`.
- Etiquetas de situação: `Badge` com variantes `success`, `warning`, `info`, `destructive`, `muted`.
- Tabelas: cabeçalho em `muted`, texto pequeno em caixa alta, linha com realce suave.
