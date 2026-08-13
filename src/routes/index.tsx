import React from 'react';
import IndexPage from '@/pages/Index';

/**
 * REGRA PERMANENTE META — MODO MANUAL E CONSERVADOR
 * 
 * NÃO executar automaticamente operações de escrita na Meta.
 * Proibido sem autorização manual explícita:
 * - criar template; reenviar template; editar template; excluir template;
 * - alterar webhook/callback; alterar WABA; alterar Phone Number ID;
 * - gerar retry; auto-retry; backoff automático; scheduler; loop de tentativa;
 * - reenvio de mensagem; alteração de permissões; troca de token.
 * 
 * Consultas READ-ONLY são permitidas.
 * Toda operação de escrita na Graph API deve obedecer:
 * MANUAL_AUTHORIZATION_REQUIRED = true | MAX_ATTEMPTS = 1 | AUTO_RETRY = false
 */

const Index = () => {
  return <IndexPage />;
};

export default Index;