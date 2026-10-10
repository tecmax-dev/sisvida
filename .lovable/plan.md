# Novo visual do app SECMI: auditoria e proposta da nova tela inicial

## Fase 1: auditoria (feita)
Tudo o que existe hoje no app do associado e será mantido:
- **Serviços em destaque:** Dependentes, Alterar senha, Carteirinha (aparecem só após login).
- **Nossos serviços:** Agendamentos, Agendamento jurídico, Atualizar carteirinha, Convenções, Declarações, Autorizações, Convênios, Boletos, Diretoria, Documentos, Atendimentos, Ouvidoria.
- **Comunicação:** Galeria, Jornais, Rádios, Vídeos.
- **Ajuda:** Como chegar (mapa), canais nas redes sociais, rodapé.
- **Topo:** menu lateral, logomarca, sino de notificações com contador.
- **Barra inferior atual:** Início, Consultas, Perfil.
- **Telas extras:** avisos pop-up, chamada na fila, pedido de sexo do dependente, carrossel de notícias.
- Cada atalho continua obedecendo à configuração "abas ativas" que o sindicato já usa. Nenhum atalho some.

## Fase 2: base visual
- Verde institucional como cor principal, com branco, verde suave e cinza-claro, usando as cores do app já configuradas.
- Cartões arredondados, sombras discretas e áreas de toque com no mínimo 44px.
- Ícones padronizados no lugar das ilustrações antigas.

## Fase 3: nova tela inicial (proposta para aprovar)
```text
+-----------------------------------+
| [logo] SECMI          (sino) (foto)|  topo verde
| Olá, Sérgio! 👋                    |
| [Carteirinha ativa · vence 12/27] |  aviso de validade
+-----------------------------------+
| [Agendar] [Carteirinha]           |  4 cartões principais
| [Dependentes] [Notícias]          |
+-----------------------------------+
| Próximo atendimento (se houver)   |
+-----------------------------------+
| Notícias SECMI   (carrossel atual,|
| manchete com degradê, pontinhos)  |
| Ver todas as notícias ->          |
+-----------------------------------+
| Todos os serviços  [ buscar... ]  |
| Atendimento | Documentos | Financ.|  agrupados por categoria
| Comunicação | Ajuda e contato     |
+-----------------------------------+
| Início Agendar Carteirinha Notícias Menu |  barra inferior fixa
+-----------------------------------+
```
- O "Menu" abre o menu lateral que já existe (perfil, configurações, sair).
- Notícias, notificações, carteirinha e agendamentos vêm dos dados reais que já existem; nenhum dado novo é criado.

## Fases seguintes (depois que você aprovar esta tela)
- Fase 4: telas de Agendamentos, Carteirinha e Dependentes, só com mudança visual.
- Fase 5: nova tela de abertura, leve, com a logo, "Seu sindicato mais perto de você" e animação curta.
- Fase 6: conferir cada atalho em celular, tablet e no app instalado.

## Garantias
- Nenhuma mudança em login, sessão, regras de agendamento, dependentes, carteirinha, contracheque, WhatsApp ou dados.
- Nenhuma mudança em outras clínicas ou sindicatos além do visual do app do associado.

## Detalhes técnicos
- Mudanças apenas em apresentação: MobileLayout (topo e barra inferior com 5 opções), MobileHomePage, novo componente de cartões principais e "Todos os serviços" (com busca), reaproveitando `useMobileAppTabs`, MobileCarousel/banners e MobileNotificationBell.
- Validade da carteirinha e próximo agendamento são consultas só de leitura em tabelas que já existem (`patient_cards`, `appointments`), sujeitas às mesmas permissões de hoje.
- Sem bibliotecas novas; animações em CSS, respeitando quem prefere menos movimento.
