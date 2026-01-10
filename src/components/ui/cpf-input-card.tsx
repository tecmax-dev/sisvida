import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
}: CpfInputCardProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(formatCPF(e.target.value));
  };

  const isCpfComplete = value.replace(/\D/g, "").length === 11;
  const isValid = useMemo(() => {
    if (!isCpfComplete) return undefined;
    return isValidCPF(value);
  }, [value, isCpfComplete]);

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
                "font-semibold text-sm",
                error || isValid === false
                  ? "text-destructive"
                  : "text-purple-700 dark:text-purple-300"
              )}
            >
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="relative mt-1.5">
              <Input
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                disabled={disabled || loading}
                className={cn(
                  "font-mono text-base pr-10",
                  (error || isValid === false) &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
              {showValidation && isCpfComplete && !loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isValid === true && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  {isValid === false && (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                </div>
              )}
            </div>
            {error && (
              <p className="text-xs text-destructive mt-1.5">{error}</p>
            )}
            {!error && isValid === false && (
              <p className="text-xs text-destructive mt-1.5">CPF inválido</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
