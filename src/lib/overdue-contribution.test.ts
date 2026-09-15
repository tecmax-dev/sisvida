import { describe, expect, it } from "vitest";
import { isOverdueContribution } from "./overdue-contribution";

const today = new Date("2026-01-15T10:00:00");

const contribution = (status: string, due_date: string) => ({ status, due_date });

describe("isOverdueContribution", () => {
  it("aceita contribuição vencida por status", () => {
    expect(isOverdueContribution(contribution("overdue", "2026-01-14"), today)).toBe(true);
  });

  it("aceita pendente com data passada", () => {
    expect(isOverdueContribution(contribution("pending", "2026-01-14"), today)).toBe(true);
  });

  it("recusa pendente futura", () => {
    expect(isOverdueContribution(contribution("pending", "2026-01-16"), today)).toBe(false);
  });

  it("recusa overdue com data futura", () => {
    expect(isOverdueContribution(contribution("overdue", "2026-01-16"), today)).toBe(false);
  });
});
