import { useState, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
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

// Validates CNPJ via mod 11 algorithm
function isValidCnpj(cnpj: string): boolean {
  const c = cnpj.replace(/\D/g, "");
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let s = 0;
  for (let i = 0; i < 12; i++) s += parseInt(c[i]) * w1[i];
  let r = s % 11;
  const d1 = r < 2 ? 0 : 11 - r;
  if (parseInt(c[12]) !== d1) return false;
  s = 0;
  for (let i = 0; i < 13; i++) s += parseInt(c[i]) * w2[i];
  r = s % 11;
  const d2 = r < 2 ? 0 : 11 - r;
  return parseInt(c[13]) === d2;
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

  const handleSearch = async () => {
    setError(null);
    const clean = value.replace(/\D/g, "");

    if (clean.length !== 14) {
      setError("CNPJ inválido");
      toast.error("CNPJ inválido", { description: "Informe os 14 dígitos" });
      return;
    }
    if (!isValidCnpj(clean)) {
      setError("CNPJ inválido");
      toast.error("CNPJ inválido", { description: "Dígitos verificadores incorretos" });
      return;
    }

    setLoading(true);
    try {
      // Server-side filter: scoped by clinic_id (RLS also enforces this).
      // We pass the cleaned CNPJ as a parameter — not interpolated into raw SQL —
      // so there's no injection surface. We also try a few common stored formats.
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

      if (data.id === currentEmployerId) {
        toast.info("Você já está visualizando esta empresa");
        setValue("");
        return;
      }

      const base = isUnionModule ? "/union/empresas" : "/dashboard/empresas";
      setValue("");
      navigate(`${base}/${data.id}`);
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
    }
  };

  const isComplete = value.replace(/\D/g, "").length === 14;

  return (
    <div className={cn("flex flex-col gap-1 w-full max-w-xs", className)}>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            setValue(formatCNPJ(e.target.value));
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar por CNPJ"
          maxLength={18}
          inputMode="numeric"
          disabled={loading}
          className={cn(
            "font-mono pr-10 h-9",
            error && "border-destructive focus-visible:ring-destructive"
          )}
          aria-label="Buscar empresa por CNPJ"
          aria-invalid={!!error}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleSearch}
          disabled={loading || !isComplete}
          className="absolute right-0 top-0 h-9 w-9 hover:bg-transparent"
          aria-label="Buscar"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive px-1">{error}</p>}
    </div>
  );
}
