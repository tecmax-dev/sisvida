import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Search, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
}

interface Employer {
  id: string;
  name: string;
  cnpj: string | null;
  trade_name: string | null;
  phone: string | null;
  email: string | null;
}

interface EmployeeAutocompleteProps {
  clinicId: string;
  value: string;
  onChange: (cpf: string) => void;
  onSelect: (employee: Employee) => void;
  placeholder?: string;
  className?: string;
}

const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export function EmployeeAutocomplete({
  clinicId,
  value,
  onChange,
  onSelect,
  placeholder = "Digite o CPF ou nome do funcionário",
  className,
}: EmployeeAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchEmployees = useCallback(async (term: string) => {
    if (!clinicId || term.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const searchTerm = term.replace(/\D/g, "") || term;
      
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, cpf, phone, email")
        .eq("clinic_id", clinicId)
        .or(`cpf.ilike.%${searchTerm}%,name.ilike.%${term}%`)
        .limit(8);

      if (error) throw error;
      setSuggestions(data || []);
    } catch (err) {
      console.error("Error searching employees:", err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value && !selectedId) {
        searchEmployees(value);
        setShowDropdown(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, searchEmployees, selectedId]);

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
      onChange(formatCPF(inputValue));
    } else {
      onChange(inputValue);
    }
    setSelectedId(null);
  };

  const handleSelect = (employee: Employee) => {
    setSelectedId(employee.id);
    onChange(employee.cpf ? formatCPF(employee.cpf) : employee.name);
    onSelect(employee);
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
            selectedId && "border-green-500 bg-green-50/50"
          )}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
        {selectedId && !loading && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-auto"
        >
          {suggestions.map((employee) => (
            <button
              key={employee.id}
              type="button"
              onClick={() => handleSelect(employee)}
              className="w-full px-4 py-3 text-left hover:bg-green-50 transition-colors border-b border-border/50 last:border-0"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{employee.name}</p>
                  <p className="text-xs text-green-600 font-mono mt-0.5">
                    {employee.cpf ? formatCPF(employee.cpf) : "CPF não cadastrado"}
                  </p>
                  {employee.phone && (
                    <p className="text-xs text-muted-foreground mt-0.5">{employee.phone}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
