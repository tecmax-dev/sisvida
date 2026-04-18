import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useCpfVisibility } from "@/hooks/useCpfVisibility";
import { formatCpf, maskCpf } from "@/lib/cpf-utils";
import { cn } from "@/lib/utils";

interface CpfDisplayProps {
  value: string | null | undefined;
  /** Se true, exibe um botão de olho para revelar (só funciona se o usuário tiver permissão). */
  revealable?: boolean;
  /** Classe CSS extra. */
  className?: string;
  /** Texto exibido quando o valor é nulo/vazio. */
  emptyText?: string;
}

/**
 * Componente padrão para exibir CPF respeitando a permissão do usuário.
 *
 * - Sem permissão: sempre mascarado (***.***.***-XX).
 * - Com permissão: formatado (123.456.789-00). Se `revealable`, exige clique no olho.
 */
export function CpfDisplay({
  value,
  revealable = false,
  className,
  emptyText = "—",
}: CpfDisplayProps) {
  const { canSeeFull } = useCpfVisibility();
  const [revealed, setRevealed] = useState(!revealable);

  if (!value) {
    return <span className={className}>{emptyText}</span>;
  }

  const showFull = canSeeFull && revealed;
  const text = showFull ? formatCpf(value) : maskCpf(value);

  return (
    <span className={cn("font-mono tabular-nums inline-flex items-center gap-1", className)}>
      {text}
      {canSeeFull && revealable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setRevealed((r) => !r);
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label={revealed ? "Ocultar CPF" : "Mostrar CPF"}
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
    </span>
  );
}
