import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Search,
  Loader2,
  X,
  Check,
  Phone,
  Mail,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

interface AccountingOffice {
  id: string;
  name: string;
  trade_name: string | null;
  cnpj: string | null;
  email: string;
  phone: string | null;
}

interface AccountingOfficeSelectorProps {
  clinicId: string;
  employerId: string | null;
  currentOfficeId: string | null;
  onOfficeChange: (officeId: string | null, office: AccountingOffice | null) => void;
  disabled?: boolean;
}

export function AccountingOfficeSelector({
  clinicId,
  employerId,
  currentOfficeId,
  onOfficeChange,
  disabled = false,
}: AccountingOfficeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [offices, setOffices] = useState<AccountingOffice[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<AccountingOffice | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  // Load current linked office
  useEffect(() => {
    if (currentOfficeId && clinicId) {
      loadOfficeById(currentOfficeId);
    } else {
      setSelectedOffice(null);
    }
  }, [currentOfficeId, clinicId]);

  const loadOfficeById = async (officeId: string) => {
    setLoadingInitial(true);
    try {
      const { data, error } = await supabase
        .from("accounting_offices")
        .select("id, name, trade_name, cnpj, email, phone")
        .eq("id", officeId)
        .single();

      if (error) throw error;
      setSelectedOffice(data);
    } catch (error) {
      console.error("Error loading office:", error);
    } finally {
      setLoadingInitial(false);
    }
  };

  // Search offices with debounce
  const searchOffices = useCallback(async (term: string) => {
    if (!clinicId) return;

    setLoading(true);
    try {
      let query = supabase
        .from("accounting_offices")
        .select("id, name, trade_name, cnpj, email, phone")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name")
        .limit(10);

      if (term && term.trim()) {
        const cleanTerm = term.trim();
        const cnpjDigits = cleanTerm.replace(/\D/g, "");
        
        if (cnpjDigits.length > 0) {
          query = query.or(`name.ilike.%${cleanTerm}%,cnpj.ilike.%${cnpjDigits}%,trade_name.ilike.%${cleanTerm}%`);
        } else {
          query = query.or(`name.ilike.%${cleanTerm}%,trade_name.ilike.%${cleanTerm}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setOffices(data || []);
    } catch (error) {
      console.error("Error searching offices:", error);
      setOffices([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  // Initial load and search on term change
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        searchOffices(searchTerm);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchTerm, open, searchOffices]);

  const handleSelectOffice = (office: AccountingOffice) => {
    setSelectedOffice(office);
    onOfficeChange(office.id, office);
    setOpen(false);
    setSearchTerm("");
  };

  const handleRemoveLink = () => {
    setConfirmRemoveOpen(true);
  };

  const confirmRemove = () => {
    setSelectedOffice(null);
    onOfficeChange(null, null);
    setConfirmRemoveOpen(false);
  };

  const formatCNPJ = (cnpj: string | null) => {
    if (!cnpj) return "-";
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  if (loadingInitial) {
    return (
      <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando escritório...</span>
      </div>
    );
  }

  // State: With linked office
  if (selectedOffice) {
    return (
      <div className="border rounded-lg bg-card">
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{selectedOffice.name}</p>
                {selectedOffice.trade_name && (
                  <p className="text-xs text-muted-foreground truncate">{selectedOffice.trade_name}</p>
                )}
                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                  {formatCNPJ(selectedOffice.cnpj)}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 shrink-0">
              Vinculado
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {selectedOffice.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {selectedOffice.phone}
              </span>
            )}
            {selectedOffice.email && (
              <span className="flex items-center gap-1 truncate">
                <Mail className="h-3 w-3" />
                {selectedOffice.email}
              </span>
            )}
          </div>

          {!disabled && (
            <div className="flex items-center gap-2 pt-1">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Trocar
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Buscar por CNPJ ou nome..."
                      value={searchTerm}
                      onValueChange={setSearchTerm}
                    />
                    <CommandList>
                      {loading && (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {!loading && offices.length === 0 && searchTerm && (
                        <CommandEmpty>Nenhum escritório encontrado</CommandEmpty>
                      )}
                      {!loading && offices.length === 0 && !searchTerm && (
                        <CommandEmpty>Digite para buscar...</CommandEmpty>
                      )}
                      {!loading && offices.length > 0 && (
                        <CommandGroup>
                          {offices.map((office) => (
                            <CommandItem
                              key={office.id}
                              value={office.id}
                              onSelect={() => handleSelectOffice(office)}
                              className="flex items-center gap-3 cursor-pointer"
                            >
                              <div className="h-8 w-8 rounded bg-indigo-100 flex items-center justify-center shrink-0">
                                <Building2 className="h-4 w-4 text-indigo-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{office.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {formatCNPJ(office.cnpj)}
                                </p>
                              </div>
                              {office.id === selectedOffice.id && (
                                <Check className="h-4 w-4 text-primary shrink-0" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleRemoveLink}
              >
                <X className="h-3.5 w-3.5" />
                Remover
              </Button>
            </div>
          )}
        </div>

        <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja remover o vínculo com o escritório de contabilidade "{selectedOffice.name}"?
                Esta ação não exclui nenhum dado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRemove}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // State: No linked office
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 h-auto py-3"
          disabled={disabled}
        >
          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-muted-foreground">Vincular Escritório de Contabilidade</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por CNPJ ou nome..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && offices.length === 0 && searchTerm && (
              <CommandEmpty>Nenhum escritório encontrado</CommandEmpty>
            )}
            {!loading && offices.length === 0 && !searchTerm && (
              <CommandEmpty>Digite para buscar...</CommandEmpty>
            )}
            {!loading && offices.length > 0 && (
              <CommandGroup>
                {offices.map((office) => (
                  <CommandItem
                    key={office.id}
                    value={office.id}
                    onSelect={() => handleSelectOffice(office)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <div className="h-8 w-8 rounded bg-indigo-100 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{office.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {formatCNPJ(office.cnpj)}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default AccountingOfficeSelector;
