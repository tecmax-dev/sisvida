import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Truck, Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Supplier {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
}

interface UnionSupplierComboboxProps {
  value: string;
  onChange: (value: string) => void;
  clinicId: string;
  placeholder?: string;
  disabled?: boolean;
  onAddNew?: () => void;
}

export function UnionSupplierCombobox({
  value,
  onChange,
  clinicId,
  placeholder = "Selecione um fornecedor",
  disabled = false,
  onAddNew,
}: UnionSupplierComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["union-suppliers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_suppliers")
        .select("id, name, cnpj, email, phone")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!clinicId,
  });

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    if (!search) return suppliers;

    const searchLower = search.toLowerCase();
    return suppliers.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(searchLower) ||
        (supplier.cnpj && supplier.cnpj.includes(search.replace(/\D/g, "")))
    );
  }, [suppliers, search]);

  const selectedSupplier = suppliers?.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn(
            "w-full justify-between",
            !value && "text-muted-foreground"
          )}
        >
          {selectedSupplier ? (
            <span className="flex items-center gap-2 truncate">
              <Truck className="h-4 w-4 shrink-0" />
              <span className="truncate">{selectedSupplier.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {isLoading ? "Carregando..." : placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nome ou CNPJ..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum fornecedor encontrado.
                </p>
                {onAddNew && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setOpen(false);
                      onAddNew();
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar novo fornecedor
                  </Button>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {filteredSuppliers.map((supplier) => (
                <CommandItem
                  key={supplier.id}
                  value={supplier.id}
                  onSelect={() => {
                    onChange(supplier.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex flex-col flex-1">
                    <span className="font-medium">{supplier.name}</span>
                    {supplier.cnpj && (
                      <span className="text-xs text-muted-foreground">
                        CNPJ: {supplier.cnpj}
                      </span>
                    )}
                  </div>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === supplier.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            {onAddNew && filteredSuppliers.length > 0 && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    setOpen(false);
                    onAddNew();
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar novo fornecedor
                </Button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
