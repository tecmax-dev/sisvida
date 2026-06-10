// Fonte única dos identificadores usados em `triggered_by` / `sourceFunction`.
// Centraliza strings antes espalhadas pelos edge functions para evitar
// divergência entre auditoria e callers.
export const TRIGGER_SOURCES = {
  META_SEND_TEMPLATE: "meta-send-template",
  META_SEND_TEXT: "meta-send-text",
  SEND_WHATSAPP: "send-whatsapp",
  HUMAN_OPERATOR: "human-operator",
  SESSION_REPLY: "session-reply",
} as const;

export type TriggerSource = typeof TRIGGER_SOURCES[keyof typeof TRIGGER_SOURCES];

/** Conjunto considerado "envio livre/sessão" — excluído de alertas de bypass. */
export const FREEFORM_TRIGGERS: readonly TriggerSource[] = [
  TRIGGER_SOURCES.SEND_WHATSAPP,
  TRIGGER_SOURCES.META_SEND_TEXT,
  TRIGGER_SOURCES.HUMAN_OPERATOR,
  TRIGGER_SOURCES.SESSION_REPLY,
];