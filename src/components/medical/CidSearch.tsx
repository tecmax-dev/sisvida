import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface IcdCode {
  id: string;
  code: string;
  description: string;
  category: string | null;
}

interface CidSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CidSearch({ value, onChange, placeholder = "Buscar CID...", className }: CidSearchProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<IcdCode[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search for ICD codes
  useEffect(() => {
    const searchCodes = async () => {
      if (search.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const searchTerm = `%${search}%`;
        const { data, error } = await supabase
          .from('icd10_codes')
          .select('id, code, description, category')
          .or(`code.ilike.${searchTerm},description.ilike.${searchTerm}`)
          .eq('is_active', true)
          .order('code')
          .limit(10);

        if (error) throw error;
        setResults(data || []);
      } catch (error) {
        console.error('Erro ao buscar CIDs:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchCodes, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code: IcdCode) => {
    onChange(`${code.code} - ${code.description}`);
    setSearch("");
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setSearch("");
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    setIsOpen(true);
    // Also update the value for manual typing
    if (val.length >= 2) {
      onChange(val);
    }
  };

  const handleFocus = () => {
    if (search.length >= 2) {
      setIsOpen(true);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value || search}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="pl-9 pr-8"
        />
        {(value || search) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (search.length >= 2 || results.length > 0) && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              Buscando...
            </div>
          ) : results.length > 0 ? (
            <>
              {results.map((code) => (
                <button
                  key={code.id}
                  type="button"
                  onClick={() => handleSelect(code)}
                  className="w-full px-3 py-2 text-left hover:bg-accent flex items-start gap-3 border-b border-border last:border-0"
                >
                  <span className="font-mono font-semibold text-primary shrink-0 min-w-[60px]">
                    {code.code}
                  </span>
                  <span className="text-sm text-foreground">
                    {code.description}
                  </span>
                </button>
              ))}
              <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/50 border-t border-border">
                💡 Clique para selecionar ou continue digitando
              </div>
            </>
          ) : (
            <div className="p-3 text-sm text-muted-foreground text-center">
              Nenhum CID encontrado. Continue digitando manualmente.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
