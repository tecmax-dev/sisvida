// Catálogo canônico de templates WhatsApp do sindicato/clínica.
// Toda edge function que dispara templates DEVE validar contra este catálogo
// antes de chamar a Graph API da Meta. Templates fora desta lista são
// considerados deprecated e devem ser bloqueados.

export type TemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";

export interface CanonicalTemplate {
  name: string;
  category: TemplateCategory;
  purpose: string;       // chave usada no rate-limit (mesma finalidade = mesmo bucket)
  description: string;
  critical?: boolean;    // bypass de score/frequência (ex.: reset de senha)
}

export const TEMPLATE_CATALOG: Record<string, CanonicalTemplate> = {
  consulta_confirmacao:     { name: "consulta_confirmacao",     category: "UTILITY",   purpose: "consulta",        description: "Confirmação de agendamento" },
  consulta_lembrete:        { name: "consulta_lembrete",        category: "UTILITY",   purpose: "consulta",        description: "Lembrete D-1 / dia" },
  consulta_cancelamento:    { name: "consulta_cancelamento",    category: "UTILITY",   purpose: "consulta",        description: "Cancelamento pelo profissional", critical: true },
  carteirinha_vencendo:     { name: "carteirinha_vencendo",     category: "UTILITY",   purpose: "carteirinha",     description: "Aviso 30/15/7 dias antes do vencimento" },
  carteirinha_vencida:      { name: "carteirinha_vencida",      category: "UTILITY",   purpose: "carteirinha",     description: "Aviso pós-vencimento" },
  boleto_disponivel:        { name: "boleto_disponivel",        category: "UTILITY",   purpose: "boleto",          description: "Boleto/Lytex emitido" },
  homologacao_confirmada:   { name: "homologacao_confirmada",   category: "UTILITY",   purpose: "homologacao",     description: "Confirmação de homologação" },
  assembleia_aviso:         { name: "assembleia_aviso",         category: "UTILITY",   purpose: "assembleia",      description: "Convocação institucional" },
  recuperacao_senha:        { name: "recuperacao_senha",        category: "UTILITY",   purpose: "auth",            description: "Link de recuperação de senha", critical: true },
  agenda_medica_disponivel: { name: "agenda_medica_disponivel", category: "UTILITY",   purpose: "agenda_mensal",   description: "Cronograma mensal de atendimentos" },
  comunicado_marketing:     { name: "comunicado_marketing",     category: "MARKETING", purpose: "marketing",       description: "Campanha institucional (requer opt-in digital)" },
};

export function getCanonicalTemplate(name: string): CanonicalTemplate | null {
  return TEMPLATE_CATALOG[name] ?? null;
}

export function isCanonical(name: string): boolean {
  return name in TEMPLATE_CATALOG;
}
