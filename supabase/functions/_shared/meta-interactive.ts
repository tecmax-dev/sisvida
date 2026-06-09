// Shared helpers to build Meta WhatsApp Cloud API "interactive" payloads
// strictly within the platform's published limits. Use these in every
// place that builds button/list messages — silent truncation in some
// call sites has caused malformed payloads (error 131009/100) which
// trigger re-delivery loops and hurts quality rating.

const META_LIMITS = {
  HEADER_TEXT: 60,
  BODY_TEXT: 1024,
  FOOTER_TEXT: 60,
  BUTTON_TITLE: 20,
  BUTTON_ID: 256,
  LIST_SECTION_TITLE: 24,
  LIST_ROW_TITLE: 24,
  LIST_ROW_DESCRIPTION: 72,
  LIST_ROW_ID: 200,
  LIST_BUTTON_LABEL: 20,
  MAX_REPLY_BUTTONS: 3,
  MAX_LIST_ROWS_TOTAL: 10,
} as const;

function clip(s: string | undefined | null, max: number): string {
  if (!s) return "";
  const str = String(s);
  return str.length > max ? str.slice(0, max) : str;
}

export interface ReplyButton { id: string; title: string }
export interface ListRow { id: string; title: string; description?: string }
export interface ListSection { title: string; rows: ListRow[] }

export function buildButtonMessage(opts: {
  body: string;
  buttons: ReplyButton[];
  header?: string;
  footer?: string;
}) {
  if (!opts.buttons?.length) throw new Error("[meta-interactive] buttons required");
  const buttons = opts.buttons.slice(0, META_LIMITS.MAX_REPLY_BUTTONS).map((b) => ({
    type: "reply" as const,
    reply: {
      id: clip(b.id, META_LIMITS.BUTTON_ID),
      title: clip(b.title, META_LIMITS.BUTTON_TITLE),
    },
  }));
  const payload: Record<string, unknown> = {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: clip(opts.body, META_LIMITS.BODY_TEXT) },
      action: { buttons },
    },
  };
  if (opts.header) {
    (payload.interactive as any).header = { type: "text", text: clip(opts.header, META_LIMITS.HEADER_TEXT) };
  }
  if (opts.footer) {
    (payload.interactive as any).footer = { text: clip(opts.footer, META_LIMITS.FOOTER_TEXT) };
  }
  return payload;
}

export function buildListMessage(opts: {
  body: string;
  buttonLabel: string;
  sections: ListSection[];
  header?: string;
  footer?: string;
}) {
  if (!opts.sections?.length) throw new Error("[meta-interactive] sections required");

  // Enforce the global max of 10 rows across all sections.
  let remaining = META_LIMITS.MAX_LIST_ROWS_TOTAL;
  const sections = opts.sections
    .map((s) => {
      const allowed = Math.max(0, remaining);
      const rows = (s.rows || []).slice(0, allowed).map((r) => ({
        id: clip(r.id, META_LIMITS.LIST_ROW_ID),
        title: clip(r.title, META_LIMITS.LIST_ROW_TITLE),
        ...(r.description ? { description: clip(r.description, META_LIMITS.LIST_ROW_DESCRIPTION) } : {}),
      }));
      remaining -= rows.length;
      return { title: clip(s.title || "Opções", META_LIMITS.LIST_SECTION_TITLE), rows };
    })
    .filter((s) => s.rows.length > 0);

  if (!sections.length) throw new Error("[meta-interactive] list must have at least one row");

  const payload: Record<string, unknown> = {
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: clip(opts.body, META_LIMITS.BODY_TEXT) },
      action: {
        button: clip(opts.buttonLabel || "Escolher", META_LIMITS.LIST_BUTTON_LABEL),
        sections,
      },
    },
  };
  if (opts.header) {
    (payload.interactive as any).header = { type: "text", text: clip(opts.header, META_LIMITS.HEADER_TEXT) };
  }
  if (opts.footer) {
    (payload.interactive as any).footer = { text: clip(opts.footer, META_LIMITS.FOOTER_TEXT) };
  }
  return payload;
}

/** Standard opt-out footer to append in every recurring template/notice. */
export const OPT_OUT_FOOTER = "Responda PARAR para não receber mais avisos.";
