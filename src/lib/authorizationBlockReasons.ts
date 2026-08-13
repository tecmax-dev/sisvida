import { format } from "date-fns";

export type AuthorizationBlockCode =
  | "card_expired"
  | "biolife_titular_male"
  | "biolife_cooldown"
  | "already_active";

export interface AuthorizationBlockReason {
  code: AuthorizationBlockCode;
  /** Título curto do motivo */
  title: string;
  /** Explicação exata do bloqueio */
  detail: string;
  /** O que o associado deve fazer para regularizar */
  howToFix: string[];
}

const fmt = (d: Date) => format(d, "dd/MM/yyyy");

export interface AuthorizationBlockInput {
  /** Data de vencimento da carteirinha, caso esteja vencida/inexistente */
  cardExpiredAt?: Date | null;
  /** Não há carteirinha ativa cadastrada */
  cardMissing?: boolean;
  /** Benefício selecionado é Biolife */
  isBiolife?: boolean;
  /** Beneficiário é dependente */
  isForDependent?: boolean;
  /** Titular é do sexo feminino */
  titularIsFemale?: boolean;
  /** Próxima data disponível para novo Biolife (cooldown de 12 meses) */
  biolifeNextAvailableAt?: Date | null;
  /** Já existe autorização ativa deste benefício para o beneficiário */
  hasActiveAuthorization?: boolean;
}

export function getAuthorizationBlockReasons(
  input: AuthorizationBlockInput
): AuthorizationBlockReason[] {
  const reasons: AuthorizationBlockReason[] = [];

  if (input.cardMissing) {
    reasons.push({
      code: "card_expired",
      title: "Carteirinha não localizada ou inativa",
      detail:
        "Não há carteirinha ativa vinculada ao associado. A autorização só pode ser emitida com a carteirinha válida.",
      howToFix: [
        "Procure o sindicato para emitir/ativar a carteirinha do titular.",
        "Envie o contracheque mais recente pelo aplicativo para validação.",
        "Após a emissão, tente gerar a autorização novamente.",
      ],
    });
  } else if (input.cardExpiredAt) {
    reasons.push({
      code: "card_expired",
      title: "Carteirinha vencida",
      detail: `A carteirinha do titular venceu em ${fmt(
        input.cardExpiredAt
      )}. Enquanto estiver vencida, nenhuma autorização (titular ou dependente) pode ser emitida.`,
      howToFix: [
        "Envie o contracheque mais recente pelo aplicativo, na área da carteirinha, para renovação automática.",
        "Se o desconto sindical não constar no contracheque, procure o sindicato para regularizar.",
        "Após a renovação, a emissão será liberada imediatamente.",
      ],
    });
  }

  if (input.isBiolife && !input.isForDependent && input.titularIsFemale === false) {
    reasons.push({
      code: "biolife_titular_male",
      title: "Biolife (titular) exclusivo para associadas",
      detail:
        "A cobertura integral (100%) do convênio Biolife é destinada apenas a associadas do sexo feminino.",
      howToFix: [
        "Se o cadastro estiver com o sexo incorreto, solicite a correção ao sindicato.",
        "Para dependentes, emita a autorização de desconto de 50% (o restante é pago no ato, no laboratório).",
      ],
    });
  }

  if (input.isBiolife && input.biolifeNextAvailableAt) {
    reasons.push({
      code: "biolife_cooldown",
      title: "Limite anual do Biolife atingido",
      detail: `O Biolife permite 1 autorização a cada 12 meses por beneficiário. A próxima emissão para este beneficiário estará disponível em ${fmt(
        input.biolifeNextAvailableAt
      )}.`,
      howToFix: [
        `Aguarde até ${fmt(input.biolifeNextAvailableAt)} para emitir uma nova autorização Biolife.`,
        "Verifique se a autorização anterior ainda está válida — ela pode ser reutilizada dentro do prazo.",
        "Cada dependente possui contagem própria: é possível emitir para outro beneficiário.",
      ],
    });
  }

  if (input.hasActiveAuthorization) {
    reasons.push({
      code: "already_active",
      title: "Já existe autorização ativa",
      detail:
        "Este beneficiário já possui uma autorização válida para este benefício.",
      howToFix: [
        "Utilize a autorização já emitida (disponível na lista de autorizações).",
        "Aguarde o vencimento da autorização atual para emitir uma nova.",
      ],
    });
  }

  return reasons;
}
