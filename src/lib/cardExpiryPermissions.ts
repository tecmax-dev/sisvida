/**
 * Regras de alteração da validade da carteirinha.
 *
 * - Admin: pode alterar a data sem anexar contracheque (anexo opcional).
 * - Demais usuários: obrigatório anexar contracheque com verificação válida.
 */
export type PayslipVerificationStatus = "idle" | "uploading" | "verifying" | "valid" | "invalid";

export interface CardExpiryChangeContext {
  isAdmin: boolean;
  newDate: string | null | undefined;
  hasFile: boolean;
  verificationStatus: PayslipVerificationStatus;
}

/** Contracheque é obrigatório para todos que não são admin. */
export function isPayslipRequired(isAdmin: boolean): boolean {
  return !isAdmin;
}

/** Regra usada no submit (handleSave). */
export function canSubmitCardExpiryChange(ctx: CardExpiryChangeContext): boolean {
  if (!ctx.newDate) return false;
  if (ctx.isAdmin) return true;
  return ctx.verificationStatus === "valid" && ctx.hasFile;
}

/** Regra usada para habilitar o botão na UI. */
export function isCardExpirySubmitEnabled(
  ctx: CardExpiryChangeContext & { saving: boolean }
): boolean {
  if (ctx.saving || !ctx.newDate) return false;
  if (ctx.isAdmin) return true;
  return ctx.verificationStatus === "valid";
}
