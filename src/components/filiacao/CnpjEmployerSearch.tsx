import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Search, Building2, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Employer {
  id: string;
  name: string;
  cnpj: string | null;
  trade_name: string | null;
  address?: string | null;
}

interface CnpjEmployerSearchProps {
  clinicId?: string;
  onSelect: (data: {
    employer_id?: string;
    cnpj: string;
    razao_social: string;
    nome_fantasia?: string;
    endereco?: string;
  }) => void;
  className?: string;
}

const formatCNPJ = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 14);
  return numbers
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export function CnpjEmployerSearch({
  clinicId,
  onSelect,
  className,
}: CnpjEmployerSearchProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Employer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedEmployer, setSelectedEmployer] = useState<Employer | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualData, setManualData] = useState({
    razao_social: "",
    nome_fantasia: "",
    endereco: "",
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Busca local na base de empregadores (server-side, sem limite arbitrário)
  const searchLocalEmployers = useCallback(async (term: string) => {
    if (!clinicId || term.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const termLower = term.toLowerCase().trim();
      const termDigits = term.replace(/\D/g, "");
      const termNoLeadingZeros = termDigits.replace(/^0+/, "");
      
      // Build OR conditions for comprehensive search
      const orParts: string[] = [];
      
      // Text-based search
      orParts.push(`name.ilike.%${termLower}%`);
      orParts.push(`trade_name.ilike.%${termLower}%`);
      
      // CNPJ search (handle leading zeros)
      if (termDigits.length >= 3) {
        orParts.push(`cnpj.ilike.%${termDigits}%`);
        if (termNoLeadingZeros && termNoLeadingZeros !== termDigits && termNoLeadingZeros.length >= 3) {
          orParts.push(`cnpj.ilike.%${termNoLeadingZeros}%`);
        }
      }
      
      const { data, error } = await supabase
        .from("employers")
        .select("id, name, cnpj, trade_name, address")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .or(orParts.join(","))
        .order("name")
        .limit(50);

      if (error) throw error;
      setSuggestions(data || []);
    } catch (err) {
      console.error("Error searching employers:", err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  // Busca externa via API (Receita Federal via BrasilAPI)
  const searchExternalCnpj = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) return;

    setLoading(true);
    setNotFound(false);
    setShowDropdown(false);

    try {
      console.log("Buscando CNPJ na Receita Federal:", cleanCnpj);
      
      const { data, error } = await supabase.functions.invoke("lookup-cnpj", {
        body: { cnpj: cleanCnpj },
      });

      console.log("Resposta lookup-cnpj:", { data, error });

      if (error) {
        console.error("Erro na função:", error);
        setNotFound(true);
        setManualMode(true);
        return;
      }

      if (!data?.ok) {
        console.log("CNPJ não encontrado:", data?.error);
        setNotFound(true);
        setManualMode(true);
        return;
      }

      // A resposta vem diretamente no data (não em data.data)
      const result = data;
      const endereco = [
        result.logradouro,
        result.numero,
        result.bairro,
        result.municipio,
        result.uf,
      ].filter(Boolean).join(", ");

      console.log("CNPJ encontrado:", result.razao_social);

      onSelect({
        cnpj: cleanCnpj,
        razao_social: result.razao_social || "",
        nome_fantasia: result.nome_fantasia || "",
        endereco,
      });
      
      setSelectedEmployer({
        id: "",
        name: result.razao_social || "",
        cnpj: cleanCnpj,
        trade_name: result.nome_fantasia || "",
        address: endereco,
      });
    } catch (err) {
      console.error("Error fetching CNPJ:", err);
      setNotFound(true);
      setManualMode(true);
    } finally {
      setLoading(false);
    }
  };

  // Efeito para busca automática quando não há resultados locais e CNPJ completo
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (value && !selectedEmployer && !loading) {
        const cleanCnpj = value.replace(/\D/g, "");
        
        // Se é um CNPJ completo (14 dígitos)
        if (cleanCnpj.length === 14) {
          // Primeiro busca local
          setLoading(true);
          try {
            const cnpjNoLeadingZeros = cleanCnpj.replace(/^0+/, "");
            
            // Build comprehensive OR for CNPJ search
            const orParts = [`cnpj.ilike.%${cleanCnpj}%`];
            if (cnpjNoLeadingZeros && cnpjNoLeadingZeros !== cleanCnpj) {
              orParts.push(`cnpj.ilike.%${cnpjNoLeadingZeros}%`);
            }
            
            const { data, error } = await supabase
              .from("employers")
              .select("id, name, cnpj, trade_name, address")
              .eq("clinic_id", clinicId || "")
              .eq("is_active", true)
              .or(orParts.join(","))
              .order("name")
              .limit(50);

            if (!error && data && data.length > 0) {
              setSuggestions(data);
              setShowDropdown(true);
              setLoading(false);
            } else {
              // Sem resultados locais - busca na Receita Federal
              setSuggestions([]);
              setShowDropdown(false);
              // Não chamar setLoading(false) aqui - a busca externa vai gerenciar
              searchExternalCnpj(cleanCnpj);
            }
          } catch (err) {
            console.error("Error searching local employers:", err);
            // Em caso de erro na busca local, tenta a Receita Federal
            searchExternalCnpj(cleanCnpj);
          }
        } else if (value.length >= 3) {
          // Busca local por nome/cnpj parcial
          searchLocalEmployers(value);
          setShowDropdown(true);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [value, selectedEmployer, clinicId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const isDigit = /^\d/.test(inputValue.replace(/\D/g, ""));
    
    if (isDigit) {
      setValue(formatCNPJ(inputValue));
    } else {
      setValue(inputValue);
    }
    
    setSelectedEmployer(null);
    setNotFound(false);
    setManualMode(false);
  };

  const handleSelect = (employer: Employer) => {
    setSelectedEmployer(employer);
    setValue(employer.cnpj ? formatCNPJ(employer.cnpj) : employer.name);
    setShowDropdown(false);
    setSuggestions([]);
    
    onSelect({
      employer_id: employer.id,
      cnpj: employer.cnpj || "",
      razao_social: employer.name,
      nome_fantasia: employer.trade_name || "",
      endereco: employer.address || "",
    });
  };

  const handleSearchExternal = () => {
    const cleanCnpj = value.replace(/\D/g, "");
    if (cleanCnpj.length === 14) {
      searchExternalCnpj(cleanCnpj);
    }
  };

  const handleManualSubmit = () => {
    const cleanCnpj = value.replace(/\D/g, "");
    onSelect({
      cnpj: cleanCnpj,
      razao_social: manualData.razao_social,
      nome_fantasia: manualData.nome_fantasia,
      endereco: manualData.endereco,
    });
    setManualMode(false);
    setSelectedEmployer({
      id: "",
      name: manualData.razao_social,
      cnpj: cleanCnpj,
      trade_name: manualData.nome_fantasia,
      address: manualData.endereco,
    });
  };

  const handleClear = () => {
    setValue("");
    setSelectedEmployer(null);
    setNotFound(false);
    setManualMode(false);
    setManualData({ razao_social: "", nome_fantasia: "", endereco: "" });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            onFocus={() => value.length >= 3 && setShowDropdown(true)}
            placeholder="Digite o CNPJ ou nome da empresa"
            className={cn(
              "pl-10 pr-10 h-9 text-sm",
              selectedEmployer && "border-green-500 bg-green-50/50 dark:bg-green-950/30"
            )}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
          {selectedEmployer && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {showDropdown && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-auto"
          >
            {suggestions.map((employer) => (
              <button
                key={employer.id}
                type="button"
                onClick={() => handleSelect(employer)}
                className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-0"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {employer.trade_name || employer.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{employer.name}</p>
                    {employer.cnpj && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                        {formatCNPJ(employer.cnpj)}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Botão para buscar na Receita Federal */}
      {value.replace(/\D/g, "").length === 14 && !selectedEmployer && !loading && suggestions.length === 0 && !manualMode && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSearchExternal}
          className="w-full"
        >
          <Search className="h-4 w-4 mr-2" />
          Buscar CNPJ na Receita Federal
        </Button>
      )}

      {/* Empresa selecionada */}
      {selectedEmployer && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-green-800 dark:text-green-200">
                {selectedEmployer.trade_name || selectedEmployer.name}
              </p>
              {selectedEmployer.trade_name && (
                <p className="text-xs text-green-700 dark:text-green-300">{selectedEmployer.name}</p>
              )}
              {selectedEmployer.address && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">{selectedEmployer.address}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cadastro manual */}
      {manualMode && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
            {notFound ? "CNPJ não encontrado. Preencha manualmente:" : "Cadastrar empresa manualmente:"}
          </p>
          <Input
            placeholder="Razão Social *"
            value={manualData.razao_social}
            onChange={(e) => setManualData(prev => ({ ...prev, razao_social: e.target.value }))}
            className="h-9 text-sm"
          />
          <Input
            placeholder="Nome Fantasia"
            value={manualData.nome_fantasia}
            onChange={(e) => setManualData(prev => ({ ...prev, nome_fantasia: e.target.value }))}
            className="h-9 text-sm"
          />
          <Input
            placeholder="Endereço"
            value={manualData.endereco}
            onChange={(e) => setManualData(prev => ({ ...prev, endereco: e.target.value }))}
            className="h-9 text-sm"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleManualSubmit}
            disabled={!manualData.razao_social}
            className="w-full"
          >
            Confirmar Empresa
          </Button>
        </div>
      )}
    </div>
  );
}
