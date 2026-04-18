import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { displayCpf as displayCpfUtil } from "@/lib/cpf-utils";

/**
 * Hook centralizado para decidir se o usuário atual pode ver o CPF completo.
 *
 * Regras:
 * - Super Admin sempre pode ver completo.
 * - Em rotas /union ou /sindicato → exige permissão `view_full_cpf_union`.
 * - Em rotas administrativas da clínica → exige permissão `view_full_cpf_clinic`.
 * - Sem permissão → CPF é mascarado (***.***.***-XX).
 *
 * IMPORTANTE: este hook controla apenas EXIBIÇÃO. A busca por CPF deve continuar
 * usando o valor real do banco (string sem formatação).
 */
export function useCpfVisibility() {
  const { hasPermission, isAdmin } = usePermissions();
  const location = useLocation();

  const isUnionRoute =
    location.pathname.startsWith("/union") ||
    location.pathname.startsWith("/sindicato");

  const canSeeFull =
    isAdmin ||
    (isUnionRoute
      ? hasPermission("view_full_cpf_union")
      : hasPermission("view_full_cpf_clinic"));

  return {
    canSeeFull,
    /** Retorna o CPF pronto para exibição (formatado ou mascarado). */
    displayCpf: (cpf: string | null | undefined) => displayCpfUtil(cpf, canSeeFull),
    /** Sempre readonly por padrão — nem mesmo admin edita CPF na UI (regra do sistema). */
    isCpfReadOnly: true,
  };
}
