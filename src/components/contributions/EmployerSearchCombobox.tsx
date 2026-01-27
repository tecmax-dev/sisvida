import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Building2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name?: string | null;
  registration_number?: string | null;
}

interface EmployerSearchComboboxProps {
  employers: Employer[];
  value: string | null;
  onSelect: (employer: Employer | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

const formatCNPJ = (cnpj: string): string => {
  if (!cnpj) return "";
  const cleaned = cnpj.replace(/\D/g, "");
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

export function EmployerSearchCombobox({
  employers,
  value,
  onSelect,
  placeholder = "Todas as empresas",
  disabled = false,
}: EmployerSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedEmployer = useMemo(() => {
    return employers.find((e) => e.id === value) || null;
  }, [employers, value]);

  const filteredEmployers = useMemo(() => {
    if (!search.trim()) return employers.slice(0, 50);
    
    const searchLower = search.toLowerCase().trim();
    const searchClean = search.replace(/\D/g, "");
    const searchNoLeadingZeros = searchClean.replace(/^0+/, "");
    
    return employers.filter((e) => {
      // Name match
      if (e.name?.toLowerCase().includes(searchLower)) return true;
      
      // Trade name match
      if (e.trade_name?.toLowerCase().includes(searchLower)) return true;
      
      // CNPJ match (both sides normalized, handle leading zeros)
      const cnpjClean = e.cnpj?.replace(/\D/g, "") || "";
      if (searchClean.length >= 3 && cnpjClean.includes(searchClean)) return true;
      if (searchNoLeadingZeros.length >= 3 && cnpjClean.includes(searchNoLeadingZeros)) return true;
      
      // Also check if CNPJ starts with the search term
      if (searchClean.length >= 2 && cnpjClean.startsWith(searchClean)) return true;
      
      // Registration number match
      if (e.registration_number?.toLowerCase().includes(searchLower)) return true;
      
      return false;
    }).slice(0, 50);
  }, [employers, search]);

  const handleSelect = (employerId: string) => {
    if (employerId === "all") {
      onSelect(null);
    } else {
      const employer = employers.find((e) => e.id === employerId);
      onSelect(employer || null);
    }
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-10 bg-background",
            !selectedEmployer && "text-muted-foreground"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 text-amber-600" />
            {selectedEmployer ? (
              <span className="truncate">{selectedEmployer.name}</span>
            ) : (
              <span>{placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {selectedEmployer && (
              <X 
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100" 
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <CommandInput 
              placeholder="Buscar por nome, CNPJ ou matrícula..." 
              value={search}
              onValueChange={setSearch}
              className="flex-1"
            />
          </div>
          <CommandList>
            <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={() => handleSelect("all")}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="text-muted-foreground">Todas as empresas</span>
              </CommandItem>
              {filteredEmployers.map((employer) => (
                <CommandItem
                  key={employer.id}
                  value={employer.id}
                  onSelect={() => handleSelect(employer.id)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === employer.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{employer.name}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono bg-amber-100 text-amber-800 px-1 rounded">
                        {formatCNPJ(employer.cnpj)}
                      </span>
                      {employer.registration_number && (
                        <span className="bg-indigo-100 text-indigo-800 px-1 rounded">
                          Mat: {employer.registration_number}
                        </span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
