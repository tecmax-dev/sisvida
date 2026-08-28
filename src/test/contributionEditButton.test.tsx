import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
  },
}));

import EmployerContributionsTab from "@/components/employers/EmployerContributionsTab";

const baseProps = () => ({
  contributions: [
    {
      id: "c-overdue",
      status: "pending",
      value: 9780,
      due_date: "2020-01-15", // vencida -> editável
      competence_month: 4,
      competence_year: 2026,
      contribution_types: { name: "TAXA NEGOCIAL" },
    },
    {
      id: "c-paid",
      status: "paid",
      value: 5000,
      due_date: "2020-01-15",
      competence_month: 4,
      competence_year: 2026,
      contribution_types: { name: "MENSALIDADE" },
    },
  ],
  contributionTypes: [],
  stats: { total: 2, paid: 1, pending: 1, overdue: 0, yearTotal: 2, totalValue: 14780, paidValue: 5000 },
  currentClinic: { id: "clinic-1" },
  employer: { id: "emp-1", trade_name: "Empresa Teste" },
  syncing: false,
  generatingInvoice: false,
  selectedContributionIds: new Set<string>(),
  setSelectedContributionIds: vi.fn(),
  onSyncLytex: vi.fn(),
  onOpenWhatsappDialog: vi.fn(),
  onOpenEmailDialog: vi.fn(),
  onOpenCreateDialog: vi.fn(),
  onOpenOverdueDialog: vi.fn(),
  onViewContribution: vi.fn(),
  onGenerateInvoice: vi.fn(),
});

describe("Botão Editar de contribuições (regressão modal /sindicato)", () => {
  beforeEach(() => {
    window.localStorage.setItem("employerContributionsViewMode", "list");
  });

  it("botão editar de contribuição vencida responde ao clique e chama onViewContribution", () => {
    const props = baseProps();
    render(<EmployerContributionsTab {...(props as any)} />);

    const editButton = screen.getByTitle("Editar");
    expect(editButton).toBeInTheDocument();
    expect(editButton).not.toBeDisabled();

    fireEvent.click(editButton);
    expect(props.onViewContribution).toHaveBeenCalledTimes(1);
    expect(props.onViewContribution).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c-overdue" })
    );
  });

  it("contribuição paga não exibe botão editar", () => {
    const props = baseProps();
    props.contributions = props.contributions.filter((c) => c.id === "c-paid");
    render(<EmployerContributionsTab {...(props as any)} />);

    expect(screen.queryByTitle("Editar")).not.toBeInTheDocument();
  });

  it("contribuição a vencer mostra aviso de restrição de data", () => {
    const props = baseProps();
    props.contributions = [
      {
        ...props.contributions[0],
        id: "c-future",
        due_date: "2099-12-31",
      },
    ];
    render(<EmployerContributionsTab {...(props as any)} />);

    const btn = screen.getByTitle("Somente contribuições vencidas podem ter a data alterada");
    fireEvent.click(btn);
    expect(props.onViewContribution).toHaveBeenCalledWith(expect.objectContaining({ id: "c-future" }));
  });
});
