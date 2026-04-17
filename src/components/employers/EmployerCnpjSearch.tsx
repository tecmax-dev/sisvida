import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EmployerCnpjSearchProps {
  clinicId: string;
  isUnionModule: boolean;
  currentEmployerId?: string;
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

// Detect whether the input looks like a CNPJ (mostly digits) or a name
const looksLikeCnpj = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const nonDigits = value.replace(/[\d.\-/\s]/g, "");
  return digits.length >= 3 && nonDigits.length === 0;
};

const formatInput = (value: string) => {
  return looksLikeCnpj(value) ? formatCNPJ(value) : value;
};

interface EmployerSuggestion {
  id: string;
  name: string;
  trade_name: string | null;
  cnpj: string | null;
}

export function EmployerCnpjSearch({
  clinicId,
  isUnionModule,
  currentEmployerId,
  className,
}: EmployerCnpjSearchProps) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<EmployerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  const basePath = isUnionModule ? "/union/empresas" : "/dashboard/empresas";

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced suggestions for name/CNPJ partial search
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const isCnpj = looksLikeCnpj(trimmed);
        let query = supabase
          .from("employers")
          .select("id, name, trade_name, cnpj")
          .eq("clinic_id", clinicId)
          .limit(8);

        if (isCnpj) {
          const digits = trimmed.replace(/\D/g, "");
          query = query.or(`cnpj.ilike.%${digits}%,cnpj.ilike.%${formatCNPJ(digits)}%`);
        } else {
          const term = trimmed.replace(/[%,]/g, "");
          query = query.or(`name.ilike.%${term}%,trade_name.ilike.%${term}%`);
        }

        const { data, error: qErr } = await query;
        if (qErr) throw qErr;
        setSuggestions((data ?? []) as EmployerSuggestion[]);
        setShowSuggestions(true);
      } catch (err) {
        console.error("Erro ao buscar sugestões:", err);
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, clinicId]);

  const goToEmployer = (id: string) => {
    if (id === currentEmployerId) {
      toast.info("Você já está visualizando esta empresa");
      setValue("");
      setShowSuggestions(false);
      return;
    }
    setValue("");
    setSuggestions([]);
    setShowSuggestions(false);
    navigate(`${basePath}/${id}`);
  };

  const handleSearch = async () => {
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) return;

    // Name search → if there are suggestions, pick the first; otherwise show error
    if (!looksLikeCnpj(trimmed)) {
      if (suggestions.length === 1) {
        goToEmployer(suggestions[0].id);
        return;
      }
      if (suggestions.length > 1) {
        setShowSuggestions(true);
        return;
      }
      setError("Empresa não encontrada");
      toast.error("Empresa não encontrada");
      return;
    }

    // CNPJ exact search
    const clean = trimmed.replace(/\D/g, "");
    if (clean.length !== 14) {
      setError("CNPJ inválido");
      toast.error("CNPJ inválido", { description: "Informe os 14 dígitos" });
      return;
    }

    setLoading(true);
    try {
      const formatted = formatCNPJ(clean);
      const { data, error: qErr } = await supabase
        .from("employers")
        .select("id, cnpj")
        .eq("clinic_id", clinicId)
        .or(`cnpj.eq.${clean},cnpj.eq.${formatted}`)
        .limit(1)
        .maybeSingle();

      if (qErr) throw qErr;

      if (!data) {
        setError("Empresa não encontrada");
        toast.error("Empresa não encontrada");
        return;
      }
      goToEmployer(data.id);
    } catch (err) {
      console.error("Erro ao buscar empresa:", err);
      setError("Erro ao buscar empresa");
      toast.error("Erro ao buscar empresa");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative flex flex-col gap-1 w-full max-w-xs", className)}>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            setValue(formatInput(e.target.value));
            if (error) setError(null);
          }}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar por nome ou CNPJ"
          maxLength={120}
          disabled={loading}
          className={cn(
            "pr-10 h-9",
            error && "border-destructive focus-visible:ring-destructive"
          )}
          aria-label="Buscar empresa por nome ou CNPJ"
          aria-invalid={!!error}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleSearch}
          disabled={loading || !value.trim()}
          className="absolute right-0 top-0 h-9 w-9 hover:bg-transparent"
          aria-label="Buscar"
        >
          {loading || searching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-md max-h-72 overflow-auto">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goToEmployer(s.id)}
              className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground flex items-start gap-2 border-b border-border last:border-b-0"
            >
              <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {s.trade_name || s.name}
                </div>
                {s.cnpj && (
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {formatCNPJ(s.cnpj)}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-destructive px-1">{error}</p>}
    </div>
  );
}
