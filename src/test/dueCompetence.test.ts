// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isDueCompetence } from "../../supabase/functions/_shared/due-competence";

const now = new Date("2026-10-13T15:00:00Z"); // 12h em Brasília

describe("isDueCompetence", () => {
  it("vencimento hoje é a vencer", () => {
    expect(isDueCompetence({ status: "awaiting_value", due_date: "2026-10-13" }, now)).toBe(true);
  });
  it("vencimento ontem é vencida", () => {
    expect(isDueCompetence({ status: "awaiting_value", due_date: "2026-10-12" }, now)).toBe(false);
  });
  it("paga ou cancelada fica fora", () => {
    expect(isDueCompetence({ status: "paid", due_date: "2026-10-20" }, now)).toBe(false);
    expect(isDueCompetence({ status: "cancelled", due_date: "2026-10-20" }, now)).toBe(false);
  });
});
