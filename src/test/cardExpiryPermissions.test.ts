import { describe, it, expect } from "vitest";
import {
  canSubmitCardExpiryChange,
  isCardExpirySubmitEnabled,
  isPayslipRequired,
  type PayslipVerificationStatus,
} from "@/lib/cardExpiryPermissions";

const date = "2026-12-31";

describe("regras de validade da carteirinha", () => {
  it("contracheque é obrigatório apenas para não-admin", () => {
    expect(isPayslipRequired(true)).toBe(false);
    expect(isPayslipRequired(false)).toBe(true);
  });

  it("admin altera a data sem anexar contracheque", () => {
    expect(
      canSubmitCardExpiryChange({ isAdmin: true, newDate: date, hasFile: false, verificationStatus: "idle" })
    ).toBe(true);
    expect(
      isCardExpirySubmitEnabled({ isAdmin: true, newDate: date, hasFile: false, verificationStatus: "idle", saving: false })
    ).toBe(true);
  });

  it("admin ainda precisa informar uma data", () => {
    expect(
      canSubmitCardExpiryChange({ isAdmin: true, newDate: "", hasFile: false, verificationStatus: "valid" })
    ).toBe(false);
  });

  it("não-admin é bloqueado sem contracheque válido", () => {
    const statuses: PayslipVerificationStatus[] = ["idle", "uploading", "verifying", "invalid"];
    for (const verificationStatus of statuses) {
      expect(
        canSubmitCardExpiryChange({ isAdmin: false, newDate: date, hasFile: true, verificationStatus })
      ).toBe(false);
      expect(
        isCardExpirySubmitEnabled({ isAdmin: false, newDate: date, hasFile: true, verificationStatus, saving: false })
      ).toBe(false);
    }
  });

  it("não-admin com verificação válida mas sem arquivo é bloqueado no submit", () => {
    expect(
      canSubmitCardExpiryChange({ isAdmin: false, newDate: date, hasFile: false, verificationStatus: "valid" })
    ).toBe(false);
  });

  it("não-admin com contracheque válido consegue alterar", () => {
    expect(
      canSubmitCardExpiryChange({ isAdmin: false, newDate: date, hasFile: true, verificationStatus: "valid" })
    ).toBe(true);
    expect(
      isCardExpirySubmitEnabled({ isAdmin: false, newDate: date, hasFile: true, verificationStatus: "valid", saving: false })
    ).toBe(true);
  });

  it("nunca habilita enquanto salvando", () => {
    expect(
      isCardExpirySubmitEnabled({ isAdmin: true, newDate: date, hasFile: true, verificationStatus: "valid", saving: true })
    ).toBe(false);
  });
});
