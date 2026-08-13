/**
 * Regras de exibição das autorizações Biolife.
 *
 * Existem DOIS tipos distintos de autorização:
 *  - Titular  -> COBERTURA INTEGRAL (100%) custeada pelo sindicato.
 *  - Dependente -> APENAS DESCONTO DE 50% concedido pelo próprio laboratório.
 *    O sindicato NÃO custeia nada para dependentes; os 50% restantes são pagos
 *    no ato, pelo dependente, diretamente no laboratório.
 */

export type BiolifeAuthorizationKind = "coverage" | "discount";

export function isBiolifeBenefit(
  b?: { name?: string | null; partner_name?: string | null; category?: string | null } | null
): boolean {
  if (!b) return false;
  const haystack = `${b.name ?? ""} ${b.partner_name ?? ""} ${(b as any).category ?? ""}`.toLowerCase();
  return haystack.includes("biolife");
}

export interface BiolifeAuthorizationInfo {
  kind: BiolifeAuthorizationKind;
  /** Título curto para cabeçalho/impressão */
  title: string;
  /** Selo curto */
  badge: string;
  /** Texto principal e explícito para o laboratório */
  description: string;
  /** Instruções em tópicos para o laboratório */
  labInstructions: string[];
}

export function getBiolifeAuthorizationInfo(isForDependent: boolean): BiolifeAuthorizationInfo {
  if (isForDependent) {
    return {
      kind: "discount",
      title: "AUTORIZAÇÃO DE DESCONTO DE 50% (DEPENDENTE) — SEM CUSTEIO PELO SINDICATO",
      badge: "Desconto de 50% — sindicato não custeia",
      description:
        "Esta autorização NÃO gera cobertura financeira pelo sindicato. O dependente portador tem direito apenas ao DESCONTO DE 50% concedido pelo próprio laboratório Biolife sobre o valor do exame. Os 50% restantes são pagos NO ATO, pelo dependente, diretamente no laboratório.",
      labInstructions: [
        "NÃO faturar este atendimento ao sindicato.",
        "Aplicar desconto de 50% sobre o valor do exame (convênio Biolife).",
        "Cobrar os 50% restantes no ato, diretamente do dependente portador desta autorização.",
      ],
    };
  }

  return {
    kind: "coverage",
    title: "AUTORIZAÇÃO DE EXAME (TITULAR) — COBERTURA INTEGRAL (100%) PELO SINDICATO",
    badge: "Cobertura 100% pelo sindicato",
    description:
      "O sindicato custeia integralmente (100%) o exame da associada titular portadora desta autorização. Nada deve ser cobrado da associada.",
    labInstructions: [
      "Não cobrar qualquer valor da associada titular.",
      "Faturar o exame diretamente ao sindicato, conforme convênio vigente.",
    ],
  };
}
