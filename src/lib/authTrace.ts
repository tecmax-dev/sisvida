/*
  AUTH TRACE
  - Instrumentação para evidenciar execução real do login/listeners.
  - Não executa queries, não chama funções, não altera fluxo — apenas logs.
*/

declare global {
  interface Window {
    __AUTH_TRACE_ACTIVE_LISTENERS__?: number;
    __AUTH_TRACE_LISTENERS__?: Record<string, number>;
    __AUTH_TRACE_SEQ__?: number;
  }
}

const NS = "[AUTH-TRACE]";

function getSeq() {
  if (typeof window === "undefined") return 0;
  window.__AUTH_TRACE_SEQ__ = (window.__AUTH_TRACE_SEQ__ ?? 0) + 1;
  return window.__AUTH_TRACE_SEQ__;
}

function getActive() {
  if (typeof window === "undefined") return 0;
  return window.__AUTH_TRACE_ACTIVE_LISTENERS__ ?? 0;
}

function setActive(next: number) {
  if (typeof window === "undefined") return;
  window.__AUTH_TRACE_ACTIVE_LISTENERS__ = next;
}

function bumpNamed(name: string, delta: number) {
  if (typeof window === "undefined") return 0;
  window.__AUTH_TRACE_LISTENERS__ = window.__AUTH_TRACE_LISTENERS__ ?? {};
  window.__AUTH_TRACE_LISTENERS__![name] = (window.__AUTH_TRACE_LISTENERS__![name] ?? 0) + delta;
  return window.__AUTH_TRACE_LISTENERS__![name];
}

export function authTrace(event: string, data?: Record<string, unknown>) {
  // Log sempre (exigência de evidência). Evitar PII e tokens.
  if (data) {
    console.info(NS, event, data);
  } else {
    console.info(NS, event);
  }
}

export function trackAuthListener(name: string) {
  const id = getSeq();
  const active = getActive() + 1;
  setActive(active);
  const named = bumpNamed(name, +1);

  authTrace("listener+", { name, id, active, named });

  return () => {
    const nextActive = Math.max(0, getActive() - 1);
    setActive(nextActive);
    const nextNamed = bumpNamed(name, -1);
    authTrace("listener-", { name, id, active: nextActive, named: Math.max(0, nextNamed) });
  };
}

export function maskEmail(email: string) {
  const [u, d] = email.split("@");
  if (!d) return "[invalid]";
  const user = (u ?? "").slice(0, 2);
  return `${user}***@${d}`;
}
