// Validação de definição de templates antes do registro na Meta.
// Foco: governança e prevenção de crescimento descontrolado do catálogo.

import { TEMPLATE_CATALOG, type TemplateCategory } from "./template-catalog.ts";

export interface TemplateDefinition {
  name: string;
  category: TemplateCategory | string;
  components: Array<{ type: string; text?: string; buttons?: any[] }>;
}

export interface GovernanceResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const PROMOTIONAL_REGEX =
  /\b(promo(ç|c)?ão|desconto|oferta|aproveite|imperd(í|i)vel|gr(á|a)tis|cupom|black friday|liquida(ç|c)ão)\b/i;

const AUTH_ALLOWED_WORDS =
  /(c(ó|o)digo|verifica(ç|c)(ã|a)o|login|autentica(ç|c)(ã|a)o|senha|otp|2fa|acesso)/i;

const MAX_VARIABLES = 8;

function countVars(components: TemplateDefinition["components"]): number {
  let total = 0;
  for (const c of components || []) {
    const t = c.text || "";
    total += (t.match(/\{\{\d+\}\}/g) || []).length;
    for (const b of c.buttons || []) {
      total += ((b.url || "").match(/\{\{\d+\}\}/g) || []).length;
    }
  }
  return total;
}

export function validateTemplateDefinition(def: TemplateDefinition): GovernanceResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Nome ∈ catálogo
  const canonical = TEMPLATE_CATALOG[def.name];
  if (!canonical) {
    errors.push(`Template '${def.name}' não pertence ao catálogo canônico.`);
  }

  // 2. Categoria compatível
  if (canonical && canonical.category !== def.category) {
    errors.push(
      `Categoria '${def.category}' divergente do catálogo (esperado '${canonical.category}').`,
    );
  }

  const body = (def.components || []).find((c) => c.type === "BODY")?.text ?? "";

  // 3. UTILITY não pode conter texto promocional
  if (def.category === "UTILITY" && PROMOTIONAL_REGEX.test(body)) {
    errors.push("Template UTILITY contém vocabulário promocional (proibido pela Meta).");
  }

  // 4. AUTHENTICATION apenas para OTP/login/2FA/recuperação
  if (def.category === "AUTHENTICATION") {
    if (!AUTH_ALLOWED_WORDS.test(body)) {
      errors.push(
        "AUTHENTICATION deve ser usado apenas para OTP/código/login/2FA/recuperação de senha.",
      );
    }
    if (PROMOTIONAL_REGEX.test(body)) {
      errors.push("AUTHENTICATION não pode conter texto promocional.");
    }
  }

  // 5. Quantidade máxima de variáveis
  const vars = countVars(def.components || []);
  if (vars > MAX_VARIABLES) {
    errors.push(`Template excede o limite de ${MAX_VARIABLES} variáveis (${vars}).`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Verifica duplicidade contra whatsapp_meta_templates (chamado opcionalmente). */
export async function checkDuplicate(
  supabase: any,
  name: string,
  language = "pt_BR",
): Promise<boolean> {
  const { data } = await supabase
    .from("whatsapp_meta_templates")
    .select("id")
    .eq("name", name)
    .eq("language", language)
    .maybeSingle();
  return !!data;
}