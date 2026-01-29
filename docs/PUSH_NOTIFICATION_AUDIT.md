# Auditoria Completa - Sistema de Notificações Push SECMI

**Data:** 2026-01-29  
**Versão do App:** 2.0.4  
**Plataformas:** Web/PWA (OneSignal) + Native (Capacitor/APNs/FCM)

---

## 1. Resumo Executivo

O sistema de notificações push do SECMI utiliza **OneSignal** para Web/PWA e está preparado para **Capacitor Push Notifications** em apps nativos. A auditoria identificou os seguintes pontos:

### ✅ Funcionando Corretamente
- OneSignal Web Push SDK v16 integrado
- Edge Function `send-push-notification` operacional
- Registro de tokens na tabela `push_notification_tokens`
- Invalidação automática de Player IDs inválidos
- Histórico de notificações em `push_notification_history`

### ⚠️ Problemas Identificados
1. **Tokens Android/iOS inativos** - 4 tokens Android registrados mas todos inativos
2. **Prompt em inglês no rodapé** - OneSignal default slidedown aparece em alguns casos
3. **Configuração nativa incompleta** - Capacitor configurado mas sem service de push no app

---

## 2. Configuração de Credenciais

### 2.1 OneSignal (Web Push)
| Secret | Status | Descrição |
|--------|--------|-----------|
| `ONESIGNAL_APP_ID` | ✅ Configurado | ID do app OneSignal |
| `ONESIGNAL_REST_API_KEY` | ✅ Configurado | Chave REST API para backend |

**App ID no Frontend:** `8522abd2-4541-4ada-9f7c-49d453642042` (hardcoded em `src/lib/onesignal.ts`)

### 2.2 Firebase (Legacy - Desativado)
| Secret | Status | Descrição |
|--------|--------|-----------|
| `FCM_SERVER_KEY` | ⚠️ Obsoleto | Não mais utilizado |
| `FIREBASE_SERVICE_ACCOUNT` | ⚠️ Obsoleto | Não mais utilizado |
| `VITE_FIREBASE_*` | ⚠️ Obsoleto | Variáveis frontend não utilizadas |

### 2.3 Apple Push Notification Service (APNs)
| Secret | Status | Descrição |
|--------|--------|-----------|
| APNs Key | ❌ Não configurado | Necessário para iOS nativo |

---

## 3. Análise de Código

### 3.1 Frontend (`src/lib/onesignal.ts`)
- SDK: OneSignal Web v16
- Service Worker: `public/OneSignalSDKWorker.js`
- Cache busting: `ONESIGNAL_CONFIG_VERSION = '2026-01-29-pt-1'`
- Prompt customizado em português ✅
- Retry logic para obter Player ID (5 tentativas) ✅
- Função `subscribeToNotificationsWithRefresh()` para renovação forçada ✅

### 3.2 Backend (`supabase/functions/send-push-notification/index.ts`)
- Suporta targets: `all`, `specific`, `segment`
- Detecta tokens OneSignal vs legacy FCM
- Invalida automaticamente Player IDs inválidos ✅
- Registra histórico em `push_notification_history` ✅

### 3.3 Hooks React
- `usePushNotifications.ts` - Orquestra native vs web
- `useWebPushNotifications.ts` - Lógica OneSignal
- Deduplicação de tokens por `userAgent` ✅

### 3.4 Capacitor (Native)
- Configurado em `capacitor.config.ts`
- Plugin `@capacitor/push-notifications` instalado
- **Problema:** App mobile não inicializa listeners nativos automaticamente

---

## 4. Estatísticas de Tokens

```
Plataforma | Total | Ativos | Inativos | OneSignal
-----------|-------|--------|----------|----------
web        |   3   |   2    |    1     |    3
android    |   4   |   0    |    4     |    0
```

**Observação:** Tokens Android são legados (FCM) e foram desativados. Não há tokens iOS.

---

## 5. Logs Recentes

### Último envio bem-sucedido (2026-01-29 03:09:51 UTC)
```
- Found 1 OneSignal tokens, 0 legacy FCM tokens
- OneSignal: Sending notification to 1 devices
- OneSignal: Notification sent successfully { id: "6a0dd010..." }
- Push notification completed: 1 success, 0 failed
```

### Envio com Player ID inválido (2026-01-29 03:07:33 UTC)
```
- Found 2 OneSignal tokens
- Notification sent successfully (errors: { invalid_player_ids: [...] })
- OneSignal: Deactivating invalid player IDs: 1
- Push notification completed: 2 success, 1 failed
```

---

## 6. Problemas e Correções

### 6.1 ❌ Prompt em inglês aparece no rodapé
**Causa:** OneSignal slidedown default é ativado quando `autoPrompt: false` mas usuário não clica no botão nativo.

**Correção:** Desabilitar completamente o slidedown default:
```typescript
promptOptions: {
  native: { enabled: true },
  slidedown: { 
    enabled: false,  // <-- Adicionar
    prompts: [] 
  },
}
```

### 6.2 ❌ Tokens Android inativos
**Causa:** Tokens são FCM legados, não OneSignal. O app nativo precisa ser atualizado para usar OneSignal ou ter backend FCM v1.

**Correção:** Implementar plugin OneSignal no Capacitor OU manter FCM via backend.

### 6.3 ❌ Sem suporte iOS nativo
**Causa:** APNs não configurado no OneSignal dashboard.

**Correção:** Configurar certificado/key APNs no painel OneSignal.

---

## 7. Conformidade com Políticas

### Google Play Store
- ✅ Notificações são opt-in (usuário clica botão)
- ✅ Conteúdo relevante (avisos do sindicato, agendamentos)
- ✅ Não usa para spam ou publicidade agressiva

### Apple App Store
- ⚠️ APNs não configurado ainda
- ✅ Quando implementado, seguirá padrão opt-in

---

## 8. Próximos Passos

1. [x] Documentar auditoria
2. [ ] Corrigir slidedown para não aparecer em inglês
3. [ ] Adicionar diagnóstico de conexão OneSignal na UI
4. [ ] Implementar suporte nativo completo (OneSignal SDK nativo ou FCM v1)
5. [ ] Configurar APNs para iOS

---

## 9. Arquivos Relevantes

- `src/lib/onesignal.ts` - Configuração OneSignal
- `src/hooks/useWebPushNotifications.ts` - Hook de inscrição
- `src/hooks/usePushNotifications.ts` - Orquestrador
- `supabase/functions/send-push-notification/index.ts` - Envio backend
- `public/OneSignalSDKWorker.js` - Service Worker
- `capacitor.config.ts` - Config nativa

---

*Documento gerado automaticamente pela auditoria de sistema.*
