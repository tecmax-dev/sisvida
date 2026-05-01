---
name: Sindicato Meta Official API Only
description: Número oficial do sindicato usa exclusivamente Meta WhatsApp Cloud API; Evolution proibida em qualquer fluxo
type: constraint
---

# Regra absoluta — Número WhatsApp do Sindicato

O número oficial do sindicato (aprovado na Meta WhatsApp Business Cloud API) **NUNCA** pode ser usado via Evolution API, WhatsApp Web, Baileys ou qualquer ferramenta não homologada pela Meta.

**Motivo:** A Meta detecta o número operando fora da infraestrutura oficial e aplica banimento imediato/permanente, independentemente do conteúdo (humano ou automatizado) ser legítimo.

## Aplicação obrigatória

- ✅ Automações (lembretes, boletos, carteira, códigos, filiação) → templates aprovados via endpoint oficial `messages` (`type: template`)
- ✅ Atendimento humano dentro da janela de 24h → endpoint oficial `messages` (`type: text`)
- ✅ Atendimento humano fora da janela de 24h → obrigatório iniciar com template aprovado
- ✅ Envio de mídia (PDF boleto, imagem carteira) → endpoint oficial (`type: document/image`)
- ✅ Recebimento → webhook oficial da Meta
- ❌ Evolution API para o número do sindicato → proibida em qualquer cenário
- ❌ WhatsApp Web / Baileys / não oficial → proibida

## Implementação no código

- Provider `meta_official` deve ser usado exclusivamente para `clinic_id = SINDICATO_CLINIC_ID`
- Flag `whatsapp_provider` por clínica/número (`evolution` | `meta_official`)
- Roteamento centralizado: nenhum edge function pode chamar Evolution direto se `whatsapp_provider = meta_official`
- Whazing (atendimento humano) também roteia pelo provider oficial
- Evolution permanece disponível apenas para outras clínicas que não migraram

## Escopo

Esta regra vale apenas para o número oficial do sindicato. Outras clínicas podem continuar na Evolution até decidirem migrar.
