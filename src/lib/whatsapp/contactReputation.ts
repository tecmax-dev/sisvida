// Reputação de contato — camada analítica apoiada em interaction_score
// existente em contact_preferences. NÃO interfere no gate de envio.

export type ContactReputation =
  | "EXCELLENT"
  | "GOOD"
  | "NORMAL"
  | "LOW"
  | "DO_NOT_DISTURB";

export interface ReputationInput {
  score?: number | null;
  lastInteractionAt?: string | Date | null;
  lastReplyAt?: string | Date | null;
  lastConfirmAt?: string | Date | null;
  optOutAt?: string | Date | null;
}

function daysSince(value?: string | Date | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 86400000;
}

export function computeReputation(input: ReputationInput): ContactReputation {
  if (input.optOutAt) return "DO_NOT_DISTURB";
  const score = input.score ?? 0;
  const replyDays = daysSince(input.lastReplyAt ?? input.lastConfirmAt);

  if (score >= 80 && replyDays <= 30) return "EXCELLENT";
  if (score >= 60) return "GOOD";
  if (score >= 40) return "NORMAL";
  return "LOW";
}

export const REPUTATION_COLORS: Record<ContactReputation, string> = {
  EXCELLENT: "bg-emerald-500",
  GOOD: "bg-green-500",
  NORMAL: "bg-yellow-500",
  LOW: "bg-orange-500",
  DO_NOT_DISTURB: "bg-red-600",
};