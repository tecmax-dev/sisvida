# Restaurar cliques reais do WhatsApp

## Objetivo
Fazer os toques nos menus e botões do número oficial chegarem ao sistema e avançarem a conversa.

## Implementação
- Confirmar e restaurar a inscrição do número oficial no aplicativo Meta responsável pelo webhook.
- Fortalecer o receptor para registrar a chegada real de mensagens interativas antes do processamento.
- Manter os controles atuais de consentimento, janela de 24 horas, opt-out e envio exclusivo pela Meta oficial.
- Validar o fluxo publicado com menu inicial, “Sou empresa” e uma opção do submenu, distinguindo claramente teste técnico de clique real.

## Detalhes técnicos
- Usar a credencial Meta já armazenada com segurança; nenhum token será exibido.
- Verificar `subscribed_apps` da conta WhatsApp e reinscrever o aplicativo canônico se necessário.
- Implantar somente as funções envolvidas no recebimento e roteamento do WhatsApp.
