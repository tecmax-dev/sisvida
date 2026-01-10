import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  User, 
  Building2,
  FileSearch,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentSearchCardProps {
  onSearch: (document: string, type: 'cpf' | 'cnpj') => Promise<void>;
  loading?: boolean;
  error?: string;
  success?: boolean;
  successMessage?: string;
  disabled?: boolean;
  className?: string;
}

// Format CPF
const formatCPF = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  return numbers
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

// Format CNPJ
const formatCNPJ = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 14);
  return numbers
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

// Validate CPF
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

// Validate CNPJ
const isValidCNPJ = (cnpj: string): boolean => {
  const numbers = cnpj.replace(/\D/g, "");
  if (numbers.length !== 14) return false;
  if (/^(\d)\1+$/.test(numbers)) return false;

  let size = numbers.length - 2;
  let digits = numbers.substring(0, size);
  const validators = numbers.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(digits.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(validators.charAt(0))) return false;

  size = size + 1;
  digits = numbers.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(digits.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(validators.charAt(1))) return false;

  return true;
};

export function DocumentSearchCard({
  onSearch,
  loading = false,
  error,
  success,
  successMessage,
  disabled = false,
  className,
}: DocumentSearchCardProps) {
  const [value, setValue] = useState("");

  const cleanValue = useMemo(() => value.replace(/\D/g, ""), [value]);
  
  const documentType = useMemo(() => {
    if (cleanValue.length <= 11) return 'cpf';
    return 'cnpj';
  }, [cleanValue]);

  const isComplete = useMemo(() => {
    if (documentType === 'cpf') return cleanValue.length === 11;
    return cleanValue.length === 14;
  }, [cleanValue, documentType]);

  const isValid = useMemo(() => {
    if (!isComplete) return undefined;
    if (documentType === 'cpf') return isValidCPF(value);
    return isValidCNPJ(value);
  }, [value, isComplete, documentType]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/\D/g, "");
    if (input.length <= 11) {
      setValue(formatCPF(input));
    } else {
      setValue(formatCNPJ(input));
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!isValid || loading) return;
    await onSearch(cleanValue, documentType);
  }, [isValid, loading, onSearch, cleanValue, documentType]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && isValid && !loading) {
      e.preventDefault();
      handleSearch();
    }
  }, [isValid, loading, handleSearch]);

  const handleBlur = useCallback(() => {
    if (isValid && !loading) {
      handleSearch();
    }
  }, [isValid, loading, handleSearch]);

  const getCardStyle = () => {
    if (error) return "border-destructive bg-destructive/5";
    if (success) return "border-emerald-400 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-950/30";
    if (isValid === false) return "border-destructive/50 bg-destructive/5";
    return "border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:border-blue-700 dark:bg-gradient-to-br dark:from-blue-950/40 dark:to-indigo-950/30";
  };

  const getIconBgStyle = () => {
    if (error || isValid === false) return "bg-destructive/10";
    if (success) return "bg-emerald-100 dark:bg-emerald-900/50";
    return "bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50";
  };

  const getIconColor = () => {
    if (error || isValid === false) return "text-destructive";
    if (success) return "text-emerald-600 dark:text-emerald-400";
    return "text-blue-600 dark:text-blue-400";
  };

  const getLabelColor = () => {
    if (error || isValid === false) return "text-destructive";
    if (success) return "text-emerald-700 dark:text-emerald-300";
    return "text-blue-700 dark:text-blue-300";
  };

  return (
    <Card className={cn("border-2 transition-all duration-200 shadow-sm", getCardStyle(), className)}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-colors shadow-inner",
              getIconBgStyle()
            )}
          >
            {loading ? (
              <Loader2 className={cn("h-8 w-8 animate-spin", getIconColor())} />
            ) : (
              <FileSearch className={cn("h-8 w-8", getIconColor())} />
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              <Label className={cn("font-semibold text-base", getLabelColor())}>
                CPF ou CNPJ
              </Label>
              <Badge 
                variant="secondary" 
                className={cn(
                  "text-xs uppercase font-medium",
                  documentType === 'cpf' 
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" 
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                )}
              >
                {documentType === 'cpf' ? (
                  <><User className="w-3 h-3 mr-1" /> CPF</>
                ) : (
                  <><Building2 className="w-3 h-3 mr-1" /> CNPJ</>
                )}
              </Badge>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Digite o CPF do funcionário ou CNPJ da empresa para buscar dados automaticamente
            </p>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={value}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  placeholder={documentType === 'cpf' ? "000.000.000-00" : "00.000.000/0000-00"}
                  disabled={disabled || loading}
                  className={cn(
                    "font-mono text-lg h-12 pr-10",
                    (error || isValid === false) && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {isComplete && !loading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isValid === true && !error && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    {(isValid === false || error) && (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                )}
              </div>
              <Button
                type="button"
                onClick={handleSearch}
                disabled={disabled || loading || !isValid}
                className={cn(
                  "h-12 px-6",
                  success
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    Buscar
                  </>
                )}
              </Button>
            </div>

            {/* Status messages */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {!error && isValid === false && isComplete && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                <XCircle className="h-4 w-4 shrink-0" />
                {documentType === 'cpf' ? 'CPF' : 'CNPJ'} inválido
              </div>
            )}
            {success && successMessage && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 px-3 py-2 rounded-lg">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {successMessage}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
