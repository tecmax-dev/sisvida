import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Search, Loader2, User } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Patient {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
}

interface PatientSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PatientSelect({
  value,
  onValueChange,
  placeholder = "Selecione o paciente",
  disabled = false,
}: PatientSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const { currentClinic } = useAuth();

  // Fetch selected patient details when value changes
  useEffect(() => {
    const fetchSelectedPatient = async () => {
      if (!value || !currentClinic) {
        setSelectedPatient(null);
        return;
      }

      const { data } = await supabase
        .from("patients")
        .select("id, name, cpf, phone")
        .eq("id", value)
        .eq("clinic_id", currentClinic.id)
        .maybeSingle();

      if (data) {
        setSelectedPatient(data);
      }
    };

    fetchSelectedPatient();
  }, [value, currentClinic]);

  // Search patients
  useEffect(() => {
    const searchPatients = async () => {
      if (!currentClinic) return;

      setLoading(true);
      try {
        const searchTerm = search.trim();
        const searchTermNumbers = searchTerm.replace(/\D/g, "");

        let query = supabase
          .from("patients")
          .select("id, name, cpf, phone")
          .eq("clinic_id", currentClinic.id)
          .order("name")
          .limit(50);

        if (searchTerm) {
          query = query.or(
            `name.ilike.%${searchTerm}%,cpf.ilike.%${searchTermNumbers}%,phone.ilike.%${searchTermNumbers}%`
          );
        }

        const { data, error } = await query;

        if (error) throw error;
        setPatients(data || []);
      } catch (error) {
        console.error("Error searching patients:", error);
        setPatients([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchPatients, 200);
    return () => clearTimeout(debounce);
  }, [search, currentClinic, open]);

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return "";
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const handleSelect = (patientId: string) => {
    onValueChange(patientId);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {selectedPatient ? (
            <span className="truncate">{selectedPatient.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : patients.length === 0 ? (
              <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
            ) : (
              <CommandGroup>
                {patients.map((patient) => (
                  <CommandItem
                    key={patient.id}
                    value={patient.id}
                    onSelect={() => handleSelect(patient.id)}
                    className="flex items-center gap-3"
                  >
                    <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{patient.name}</p>
                      {patient.cpf && (
                        <p className="text-xs text-muted-foreground">
                          CPF: {formatCPF(patient.cpf)}
                        </p>
                      )}
                    </div>
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        value === patient.id ? "opacity-100" : "opacity-0"
                      )}
                    />
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
