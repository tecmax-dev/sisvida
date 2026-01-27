import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Building2 } from "lucide-react";
import { CnpjInputCard } from "@/components/ui/cnpj-input-card";
import { supabase } from "@/integrations/supabase/client";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name: string | null;
  registration_number?: string | null;
}

interface NegotiationStepEmployerProps {
  employers: Employer[];
  clinicId: string;
  selectedEmployer: Employer | null;
  onSelectEmployer: (employer: Employer) => void;
}

export default function NegotiationStepEmployer({
  employers,
  clinicId,
  selectedEmployer,
  onSelectEmployer,
}: NegotiationStepEmployerProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Server-side search to avoid row limits (e.g., 1000) and prevent missing employers.
  const [remoteEmployers, setRemoteEmployers] = useState<Employer[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const latestRequestRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const run = async () => {
      const term = debouncedSearch.trim();
      if (!clinicId || !term) {
        setRemoteEmployers([]);
        setRemoteLoading(false);
        return;
      }

      const requestId = ++latestRequestRef.current;
      setRemoteLoading(true);

      try {
        const searchLower = term.toLowerCase().trim();
        const searchClean = term.replace(/\D/g, "");
        const searchNoLeadingZeros = searchClean.replace(/^0+/, "");

        const orParts: string[] = [];

        // Text fields (name / trade name / registration)
        if (searchLower.length >= 2) {
          // NOTE: PostgREST .or uses comma-separated conditions.
          orParts.push(`name.ilike.%${searchLower}%`);
          orParts.push(`trade_name.ilike.%${searchLower}%`);
          orParts.push(`registration_number.ilike.%${searchLower}%`);
        }

        // CNPJ field (digits)
        if (searchClean.length >= 3) {
          orParts.push(`cnpj.ilike.%${searchClean}%`);
          // Some legacy records might have lost leading zeros; allow matching without them.
          if (searchNoLeadingZeros && searchNoLeadingZeros !== searchClean && searchNoLeadingZeros.length >= 3) {
            orParts.push(`cnpj.ilike.%${searchNoLeadingZeros}%`);
          }
        }

        if (orParts.length === 0) {
          setRemoteEmployers([]);
          return;
        }

        const { data, error } = await supabase
          .from("employers")
          .select("id, name, cnpj, trade_name, registration_number")
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .or(orParts.join(","))
          .order("name")
          .limit(50);

        if (requestId !== latestRequestRef.current) return;
        if (error) throw error;

        setRemoteEmployers((data || []) as Employer[]);
      } catch (e) {
        if (requestId !== latestRequestRef.current) return;
        console.error("Employer search error:", e);
        setRemoteEmployers([]);
      } finally {
        if (requestId === latestRequestRef.current) {
          setRemoteLoading(false);
        }
      }
    };

    run();
  }, [debouncedSearch, clinicId]);

  const isSearching = debouncedSearch.trim().length > 0;

  const filteredEmployers = useMemo(() => {
    // Prefer server-side results while searching (prevents missing data due to row caps).
    if (isSearching) return remoteEmployers;

    return employers.filter((emp) => {
      if (!searchTerm.trim()) return true;

      const searchLower = searchTerm.toLowerCase().trim();
      const searchClean = searchTerm.replace(/\D/g, "");
      const searchNoLeadingZeros = searchClean.replace(/^0+/, "");

      // Name match
      if (emp.name?.toLowerCase().includes(searchLower)) return true;

      // Trade name match
      if (emp.trade_name?.toLowerCase().includes(searchLower)) return true;

      // CNPJ match (both sides normalized) - match from any position
      const cnpjClean = emp.cnpj?.replace(/\D/g, "") || "";
      if (searchClean.length >= 3 && cnpjClean.includes(searchClean)) return true;

      // Also check if the search term starts the CNPJ (user typing from beginning)
      if (searchClean.length >= 2 && cnpjClean.startsWith(searchClean)) return true;

      // Handle leading zeros mismatch (when stored value may not be 14 digits)
      if (searchNoLeadingZeros.length >= 3 && cnpjClean.includes(searchNoLeadingZeros)) return true;

      // Registration number match
      if (emp.registration_number?.toLowerCase().includes(searchLower)) return true;

      return false;
    });
  }, [employers, isSearching, remoteEmployers, searchTerm]);

  const formatCNPJ = (cnpj: string) => {
    const digits = (cnpj || "").replace(/\D/g, "");
    const padded = digits.padStart(14, "0");
    return padded.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CNPJ ou matrícula..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {isSearching && remoteLoading && (
        <p className="text-xs text-muted-foreground">Buscando no banco de dados…</p>
      )}

      <div className="max-h-[400px] overflow-y-auto space-y-2">
        <RadioGroup
          value={selectedEmployer?.id || ""}
          onValueChange={(value) => {
            // Search in BOTH arrays: server-side results AND local list
            const employer =
              remoteEmployers.find((e) => e.id === value) ||
              employers.find((e) => e.id === value);
            if (employer) onSelectEmployer(employer);
          }}
        >
          {filteredEmployers.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma empresa encontrada</p>
                <p className="text-xs mt-2">
                  Dica: busque pelo CNPJ (somente números) ou por parte do nome.
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredEmployers.map((employer) => (
              <Card
                key={employer.id}
                className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                  selectedEmployer?.id === employer.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => onSelectEmployer(employer)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <RadioGroupItem value={employer.id} id={employer.id} />
                  <Label htmlFor={employer.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{employer.name}</p>
                      {employer.registration_number && (
                        <Badge variant="outline" className="text-xs font-mono">
                          Mat. {employer.registration_number}
                        </Badge>
                      )}
                    </div>
                    {employer.trade_name && (
                      <p className="text-sm text-muted-foreground">{employer.trade_name}</p>
                    )}
                    <p className="text-xs text-muted-foreground font-mono">
                      {formatCNPJ(employer.cnpj)}
                    </p>
                  </Label>
                </CardContent>
              </Card>
            ))
          )}
        </RadioGroup>
      </div>
    </div>
  );
}
