import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, User } from "lucide-react";
import { useModal } from "@/contexts/ModalContext";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface MemberQuickSearchProps {
  clinicId: string | undefined;
  currentMemberId?: string;
  className?: string;
  isModalMode?: boolean;
}

interface MemberHit {
  id: string;
  name: string;
  cpf: string | null;
  registration_number: string | null;
}

export function MemberQuickSearch({ clinicId, currentMemberId, className, isModalMode }: MemberQuickSearchProps) {
  const navigate = useNavigate();
  const { updateModalData } = useModal();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<MemberHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (!clinicId || debounced.length < 2) {
      setResults([]);
      return;
    }
    let cancel = false;
    const run = async () => {
      setLoading(true);
      const safe = debounced.replace(/,/g, " ");
      const text = `%${safe}%`;
      const digits = safe.replace(/\D/g, "");
      const orParts: string[] = [`name.ilike.${text}`];
      if (digits.length >= 2) {
        orParts.push(`cpf.ilike.%${digits}%`);
        orParts.push(`registration_number.ilike.%${digits}%`);
      }
      const { data } = await supabase
        .from("patients")
        .select("id,name,cpf,registration_number")
        .eq("clinic_id", clinicId)
        .eq("is_union_member", true)
        .eq("is_active", true)
        .or(orParts.join(","))
        .order("name")
        .limit(10);
      if (cancel) return;
      setResults((data || []) as MemberHit[]);
      setHighlight(0);
      setLoading(false);
    };
    run();
    return () => {
      cancel = true;
    };
  }, [debounced, clinicId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(
    () => results.filter((r) => r.id !== currentMemberId),
    [results, currentMemberId]
  );

  const goTo = (id: string) => {
    setOpen(false);
    setTerm("");
    if (isModalMode) {
      updateModalData('unionMemberEdit', { memberId: id, id: id });
      navigate(`/union/socios/${id}`, { replace: true });
    } else {
      navigate(`/union/socios/${id}`);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = filtered[highlight];
      if (hit) goTo(hit.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const formatCpf = (cpf: string | null) => {
    if (!cpf) return "";
    const d = cpf.replace(/\D/g, "");
    if (d.length !== 11) return cpf;
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-xl group", className)}>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500/50 transition-all duration-300">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
        <Input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Busca rápida: Nome, CPF ou Matrícula..."
          className="pl-11 pr-11 h-12 bg-transparent border-none shadow-none focus-visible:ring-0 text-sm font-medium placeholder:text-slate-400"
          aria-label="Buscar outro cadastro"
        />
        {loading ? (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-teal-500" />
        ) : term.length > 0 && (
          <button 
            onClick={() => { setTerm(""); setOpen(false); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
          >
            <Loader2 className="h-4 w-4 rotate-45" /> 
          </button>
        )}
      </div>


      {open && debounced.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg overflow-hidden">
          {loading && filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              Nenhum sócio encontrado para "{debounced}".
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {filtered.map((hit, idx) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => goTo(hit.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                      idx === highlight ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                    )}
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{hit.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {hit.registration_number ? `Matrícula ${hit.registration_number}` : "Sem matrícula"}
                        {hit.cpf ? ` • CPF ${formatCpf(hit.cpf)}` : ""}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default MemberQuickSearch;