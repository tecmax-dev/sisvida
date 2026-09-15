# Simplificar o fluxo de boletos no WhatsApp

## Objetivo
Substituir a mensagem com vários endereços longos por uma seleção clara dentro do WhatsApp.

## Implementação
- Mostrar as contribuições elegíveis em uma lista, com competência, vencimento e valor, sem exibir endereços.
- Ao tocar em uma contribuição, enviar um botão “Atualizar boleto” que abre diretamente a página segura correspondente.
- Manter as regras atuais de CNPJ, tipos permitidos, vencimento, consentimento, janela de 24 horas, descadastro e envio pela Meta oficial.
- Preservar uma mensagem de reserva caso a Meta não aceite o formato interativo.

## Validação
- Confirmar que a lista contém somente as contribuições permitidas.
- Confirmar que cada botão abre a contribuição correta e que nenhum endereço longo aparece na mensagem principal.
