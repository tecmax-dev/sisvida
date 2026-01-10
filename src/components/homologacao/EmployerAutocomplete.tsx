import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Search, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Employer {
  id: string;
  name: string;
  cnpj: string | null;
  trade_name: string | null;
  phone: string | null;
  email: string | null;
}

interface EmployerAutocompleteProps {
  clinicId: string;
  value: string;
  onChange: (cnpj: string) => void;
  onSelect: (employer: Employer) => void;
  placeholder?: string;
  className?: string;
}

const formatCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

export function EmployerAutocomplete({
  clinicId,
  value,
  onChange,
  onSelect,
  placeholder = "Digite o CNPJ ou nome da empresa",
  className,
}: EmployerAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchEmployers = useCallback(async (term: string) => {
    if (!clinicId || term.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const searchTerm = term.replace(/\D/g, "") || term;
      
      const { data, error } = await supabase
        .from("employers")
        .select("id, name, cnpj, trade_name, phone, email")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .or(`cnpj.ilike.%${searchTerm}%,name.ilike.%${term}%,trade_name.ilike.%${term}%`)
        .limit(8);

      if (error) throw error;
      setSuggestions(data || []);
    } catch (err) {
      console.error("Error searching employers:", err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value && !selectedId) {
        searchEmployers(value);
        setShowDropdown(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, searchEmployers, selectedId]);

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
      onChange(formatCNPJ(inputValue));
    } else {
      onChange(inputValue);
    }
    setSelectedId(null);
  };

  const handleSelect = (employer: Employer) => {
    setSelectedId(employer.id);
    onChange(employer.cnpj ? formatCNPJ(employer.cnpj) : employer.name);
    onSelect(employer);
    setShowDropdown(false);
    setSuggestions([]);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={() => value.length >= 2 && setShowDropdown(true)}
          placeholder={placeholder}
          className={cn(
            "pl-10 pr-10",
            selectedId && "border-blue-500 bg-blue-50/50"
          )}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
        {selectedId && !loading && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-auto"
        >
          {suggestions.map((employer) => (
            <button
              key={employer.id}
              type="button"
              onClick={() => handleSelect(employer)}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-border/50 last:border-0"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{employer.name}</p>
                  {employer.trade_name && (
                    <p className="text-xs text-muted-foreground truncate">{employer.trade_name}</p>
                  )}
                  <p className="text-xs text-blue-600 font-mono mt-0.5">
                    {employer.cnpj ? formatCNPJ(employer.cnpj) : "CNPJ não cadastrado"}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
