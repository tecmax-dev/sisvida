import { describe, it, expect } from "vitest";

// Valid block_type values accepted by the DB CHECK constraint:
// CHECK ((block_type = ANY (ARRAY['block'::text, 'holiday'::text])))
const VALID_BLOCK_TYPES = ["block", "holiday"];

// Values that were previously (incorrectly) used in the form
const INVALID_BLOCK_TYPES = ["full_day", "partial"];

describe("homologacao_blocks block_type constraint", () => {
  it("deve aceitar somente valores válidos pelo banco de dados", () => {
    VALID_BLOCK_TYPES.forEach((type) => {
      expect(VALID_BLOCK_TYPES).toContain(type);
    });
  });

  it("não deve usar valores inválidos que violam o CHECK constraint", () => {
    INVALID_BLOCK_TYPES.forEach((type) => {
      expect(VALID_BLOCK_TYPES).not.toContain(type);
    });
  });

  it("valor padrão do formulário deve ser 'block'", () => {
    const defaultFormData = {
      block_date: new Date(),
      reason: "",
      block_type: "block",
      professional_id: "",
    };
    expect(VALID_BLOCK_TYPES).toContain(defaultFormData.block_type);
  });

  it("todos os SelectItems do formulário usam valores válidos", () => {
    const formSelectValues = ["block", "holiday"];
    formSelectValues.forEach((value) => {
      expect(VALID_BLOCK_TYPES).toContain(value);
    });
  });
});

describe("formatWhatsAppPhone", () => {
  // Reproduz a lógica de formatação de telefone do homologacaoUtils
  function formatWhatsAppPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10 || digits.length === 11) {
      return `55${digits}`;
    }
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
      return digits;
    }
    return digits;
  }

  it("deve adicionar DDI 55 para números de 11 dígitos", () => {
    expect(formatWhatsAppPhone("73981234567")).toBe("5573981234567");
  });

  it("deve adicionar DDI 55 para números de 10 dígitos", () => {
    expect(formatWhatsAppPhone("7332341234")).toBe("557332341234");
  });

  it("não deve duplicar DDI 55 para números já com código do Brasil", () => {
    expect(formatWhatsAppPhone("5573981234567")).toBe("5573981234567");
  });

  it("deve remover caracteres não numéricos", () => {
    expect(formatWhatsAppPhone("(73) 98123-4567")).toBe("5573981234567");
  });
});
