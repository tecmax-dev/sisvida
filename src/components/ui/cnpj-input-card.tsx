import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, Search, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CnpjInputCardProps {
  value: string;
  onChange: (value: string) => void;
  onLookup?: () => void;
  loading?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  showLookupButton?: boolean;
  isValid?: boolean;
  className?: string;
}

const formatCNPJ = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 14);
  return numbers
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export function CnpjInputCard({
  value,
  onChange,
  onLookup,
  loading = false,
  error,
  label = "CNPJ",
  required = false,
  disabled = false,
  placeholder = "00.000.000/0000-00",
  showLookupButton = true,
  isValid,
  className,
}: CnpjInputCardProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(formatCNPJ(e.target.value));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onLookup && value.replace(/\D/g, "").length === 14) {
      e.preventDefault();
      onLookup();
    }
  };

  const isCnpjComplete = value.replace(/\D/g, "").length === 14;

  return (
    <Card
      className={cn(
        "border-2 transition-all duration-200",
        error
          ? "border-destructive bg-destructive/5"
          : "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30",
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-colors",
              error
                ? "bg-destructive/10"
                : "bg-amber-100 dark:bg-amber-900/50"
            )}
          >
            {loading ? (
              <Loader2 className="h-7 w-7 text-amber-600 dark:text-amber-400 animate-spin" />
            ) : (
              <Building2
                className={cn(
                  "h-7 w-7",
                  error
                    ? "text-destructive"
                    : "text-amber-600 dark:text-amber-400"
                )}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <Label
              className={cn(
                "font-semibold text-sm",
                error
                  ? "text-destructive"
                  : "text-amber-700 dark:text-amber-300"
              )}
            >
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="flex gap-2 mt-1.5">
              <div className="relative flex-1">
                <Input
                  value={value}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  disabled={disabled || loading}
                  className={cn(
                    "font-mono text-base pr-10",
                    error && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {isCnpjComplete && !loading && (
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
              {showLookupButton && onLookup && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onLookup}
                  disabled={disabled || loading || !isCnpjComplete}
                  className="shrink-0 border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {error && (
              <p className="text-xs text-destructive mt-1.5">{error}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
