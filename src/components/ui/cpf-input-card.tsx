import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCpfVisibility } from "@/hooks/useCpfVisibility";
import { cleanCpf, maskCpf } from "@/lib/cpf-utils";

interface CpfInputCardProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  showValidation?: boolean;
  loading?: boolean;
  className?: string;
  /** Quando true, mantém edição liberada mesmo com valor preenchido (uso em fluxos de busca/login). */
  allowEdit?: boolean;
}

const formatCPF = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  return numbers
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const isValidCPF = (cpf: string): boolean => {
  const numbers = cpf.replace(/\D/g, "");
  if (numbers.length !== 11) return false;
  if (/^(\d)\1+$/.test(numbers)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers.charAt(10))) return false;

  return true;
};

export function CpfInputCard({
  value,
  onChange,
  error,
  label = "CPF",
  required = false,
  disabled = false,
  placeholder = "000.000.000-00",
  showValidation = true,
  loading = false,
  className,
  allowEdit = false,
}: CpfInputCardProps) {
  const { canSeeFull } = useCpfVisibility();
  const [revealed, setRevealed] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  // Bloqueio de edição: se já existe um CPF de 11 dígitos salvo e não estamos
  // em modo "allowEdit", o campo fica readonly por segurança. Usuários com
  // permissão para ver o CPF completo podem destravar a edição manualmente.
  const hasFullCpf = cleanCpf(value).length === 11;
  const isReadOnly = !allowEdit && hasFullCpf && !unlocked;


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    onChange(formatCPF(e.target.value));
  };

  const isCpfComplete = value.replace(/\D/g, "").length === 11;
  const isValid = useMemo(() => {
    if (!isCpfComplete) return undefined;
    return isValidCPF(value);
  }, [value, isCpfComplete]);

  // O que exibir no input quando bloqueado:
  // - Tem permissão + revelado: valor real formatado.
  // - Sem permissão: mascarado.
  const displayValue = useMemo(() => {
    if (!isReadOnly) return value;
    if (canSeeFull && revealed) return value;
    return maskCpf(value);
  }, [value, isReadOnly, canSeeFull, revealed]);

  return (
    <Card
      className={cn(
        "border-2 transition-all duration-200",
        error
          ? "border-destructive bg-destructive/5"
          : isValid === false
          ? "border-destructive/50 bg-destructive/5"
          : "border-purple-300 bg-purple-50/50 dark:border-purple-700 dark:bg-purple-950/30",
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-colors",
              error || isValid === false
                ? "bg-destructive/10"
                : "bg-purple-100 dark:bg-purple-900/50"
            )}
          >
            {loading ? (
              <Loader2 className="h-7 w-7 text-purple-600 dark:text-purple-400 animate-spin" />
            ) : (
              <UserCircle
                className={cn(
                  "h-7 w-7",
                  error || isValid === false
                    ? "text-destructive"
                    : "text-purple-600 dark:text-purple-400"
                )}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <Label
              className={cn(
                "font-semibold text-sm flex items-center gap-1.5",
                error || isValid === false
                  ? "text-destructive"
                  : "text-purple-700 dark:text-purple-300"
              )}
            >
              {label}
              {required && <span className="text-destructive">*</span>}
              {isReadOnly && (
                <span className="inline-flex items-center gap-1 text-[10px] font-normal text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  somente leitura
                </span>
              )}
              {!allowEdit && hasFullCpf && canSeeFull && !disabled && (
                <button
                  type="button"
                  onClick={() => {
                    setUnlocked((u) => !u);
                    setRevealed(true);
                  }}
                  className="ml-1 text-[10px] font-medium text-purple-700 dark:text-purple-300 underline underline-offset-2"
                >
                  {unlocked ? "Bloquear edição" : "Editar CPF"}
                </button>
              )}

            </Label>
            <div className="relative mt-1.5">
              <Input
                value={displayValue}
                onChange={handleChange}
                placeholder={placeholder}
                disabled={disabled || loading}
                readOnly={isReadOnly}
                className={cn(
                  "font-mono text-base pr-16",
                  isReadOnly && "bg-muted/50 cursor-not-allowed",
                  (error || isValid === false) &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {isReadOnly && canSeeFull && (
                  <button
                    type="button"
                    onClick={() => setRevealed((r) => !r)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={revealed ? "Ocultar CPF" : "Mostrar CPF"}
                  >
                    {revealed ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                )}
                {showValidation && isCpfComplete && !loading && !isReadOnly && (
                  <>
                    {isValid === true && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    {isValid === false && (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                  </>
                )}
              </div>
            </div>
            {error && (
              <p className="text-xs text-destructive mt-1.5">{error}</p>
            )}
            {!error && isValid === false && !isReadOnly && (
              <p className="text-xs text-destructive mt-1.5">CPF inválido</p>
            )}
            {isReadOnly && !canSeeFull && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Em conformidade com a LGPD, a visualização do CPF completo é permitida apenas na presença do titular, mediante apresentação de documento oficial.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
