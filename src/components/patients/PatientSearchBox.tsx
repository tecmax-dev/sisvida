import { useState, useRef, useEffect } from "react";
import { Search, Loader2, User, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { QuickPatientRegistration } from "./QuickPatientRegistration";

interface PatientResult {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  record_code: number | null;
}

export function PatientSearchBox() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PatientResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const { currentClinic } = useAuth();
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const searchPatients = async () => {
      if (!search.trim() || !currentClinic) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const searchTerm = search.trim();
        const searchTermNumbers = searchTerm.replace(/\D/g, ""); // Remove formatação para CPF/telefone
        
        const { data, error } = await supabase
          .from("patients")
          .select("id, name, cpf, phone, record_code")
          .eq("clinic_id", currentClinic.id)
          .or(`name.ilike.%${searchTerm}%,cpf.ilike.%${searchTermNumbers}%,phone.ilike.%${searchTermNumbers}%`)
          .order("name")
          .limit(10);

        if (error) throw error;
        setResults(data || []);
      } catch (error) {
        console.error("Error searching patients:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchPatients, 300);
    return () => clearTimeout(debounce);
  }, [search, currentClinic]);

  const handleSelect = (patientId: string) => {
    setIsOpen(false);
    setSearch("");
    navigate(`/dashboard/patients/${patientId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex].id);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return "";
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  const handleQuickRegisterSuccess = (patientId: string) => {
    setSearch("");
    setIsOpen(false);
    navigate(`/dashboard/patients/${patientId}`);
  };

  // Extract CPF from search if it looks like a CPF
  const getInitialCpf = () => {
    const cleaned = search.replace(/\D/g, "");
    return cleaned.length >= 11 ? cleaned.slice(0, 11) : "";
  };

  return (
    <>
      <div ref={wrapperRef} className="relative w-full max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Buscar paciente..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
              setSelectedIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            className="pl-9 pr-8"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {isOpen && search.trim() && (
          <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-80 overflow-auto">
            {results.length === 0 && !loading ? (
              <div className="p-3 space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Nenhum paciente encontrado
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setIsOpen(false);
                    setShowQuickRegister(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Cadastrar novo paciente
                </Button>
              </div>
            ) : (
              <ul className="py-1">
                {results.map((patient, index) => (
                  <li
                    key={patient.id}
                    onClick={() => handleSelect(patient.id)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent",
                      selectedIndex === index && "bg-accent"
                    )}
                  >
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{patient.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {patient.record_code && `Cód. ${patient.record_code}`}
                        {patient.record_code && patient.cpf && " • "}
                        {patient.cpf && formatCPF(patient.cpf)}
                        {(patient.record_code || patient.cpf) && patient.phone && " • "}
                        {patient.phone && formatPhone(patient.phone)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <QuickPatientRegistration
        open={showQuickRegister}
        onOpenChange={setShowQuickRegister}
        onSuccess={handleQuickRegisterSuccess}
        initialCpf={getInitialCpf()}
      />
    </>
  );
}
