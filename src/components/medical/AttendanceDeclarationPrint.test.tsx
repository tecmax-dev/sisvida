import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { createRef } from "react";
import { AttendanceDeclarationPrint } from "./AttendanceDeclarationPrint";

describe("AttendanceDeclarationPrint", () => {
  it("renderiza sem crashar quando clinic e patient são undefined", () => {
    expect(() =>
      render(
        <AttendanceDeclarationPrint
          ref={createRef<HTMLDivElement>()}
          clinic={undefined as any}
          patient={undefined as any}
          date={undefined as any}
          startTime={undefined as any}
          endTime={undefined as any}
        />,
      ),
    ).not.toThrow();
  });

  it("renderiza sem crashar quando settings é undefined e dados mínimos presentes", () => {
    const { container } = render(
      <AttendanceDeclarationPrint
        ref={createRef<HTMLDivElement>()}
        clinic={{ name: "Clínica Teste" }}
        patient={{ name: "Maria Silva" }}
        date="2026-06-04"
        startTime="08:00"
        endTime="09:00"
      />,
    );
    expect(container.textContent).toContain("Clínica Teste");
    expect(container.textContent).toContain("Maria Silva");
  });

  it("re-renderiza com props completas após primeiro render vazio (sem erro de hooks)", () => {
    const { rerender, container } = render(
      <AttendanceDeclarationPrint
        ref={createRef<HTMLDivElement>()}
        clinic={undefined as any}
        patient={undefined as any}
        date={undefined as any}
        startTime={undefined as any}
        endTime={undefined as any}
      />,
    );
    expect(() =>
      rerender(
        <AttendanceDeclarationPrint
          ref={createRef<HTMLDivElement>()}
          clinic={{ name: "Clínica X", address: "Rua A" }}
          patient={{ name: "João" }}
          professional={{ name: "Dr. House", specialty: "Geral" }}
          date="2026-06-04"
          startTime="10:00"
          endTime="10:30"
        />,
      ),
    ).not.toThrow();
    expect(container.textContent).toContain("Clínica X");
    expect(container.textContent).toContain("Dr. House");
  });
});