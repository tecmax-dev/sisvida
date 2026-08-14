import { useState, useEffect } from "react";
import { Search, User, Check, Loader2, X, MoveHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface TransferDependentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dependent: {
    id: string;
    name: string;
    patient_id: string;
  };
  clinicId: string;
  onSuccess: () => void;
}

export function TransferDependentDialog({
  isOpen,
  onClose,
  dependent,
  clinicId,
  onSuccess,
}: TransferDependentDialogProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTitular, setSelectedTitular] = useState<any | null>(null);
  const [transferring, setTransferring] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (search.length >= 3) {
      const timer = setTimeout(handleSearch, 500);
      return () => clearTimeout(timer);
    } else {
      setResults([]);
    }
  }, [search]);

  const handleSearch = async () => {
    setSearching(true);
    try {
      const cleanSearch = search.replace(/\D/g, "");
      let query = supabase
        .from("patients")
        .select("id, name, cpf, phone")
        .eq("clinic_id", clinicId)
        .eq("is_union_member", true)
        .neq("id", dependent.patient_id) // Can't transfer to the same titular
        .limit(5);

      if (cleanSearch.length > 0) {
        query = query.or(`cpf.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%`);
      } else {
        query = query.ilike("name", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error("Error searching titular:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedTitular) return;

    setTransferring(true);
    try {
      const { error } = await supabase
        .from("patient_dependents")
        .update({ patient_id: selectedTitular.id })
        .eq("id", dependent.id);

      if (error) throw error;

      toast({
        title: "Vínculo transferido",
        description: `${dependent.name} agora é dependente de ${selectedTitular.name}.`,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error transferring dependent:", error);
      toast({
        title: "Erro na transferência",
        description: "Não foi possível transferir o vínculo.",
        variant: "destructive",
      });
    } finally {
      setTransferring(false);
    }
  };

  const formatCPF = (value: string): string => {
    const cleaned = value.replace(/\D/g, "");
    return cleaned
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .substring(0, 14);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MoveHorizontal className="h-5 w-5 text-teal-600" />
            Transferir Vínculo
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Dependente</p>
            <p className="text-sm font-semibold text-slate-900">{dependent.name}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Novo Associado Titular</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
            {searching ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              </div>
            ) : results.length > 0 ? (
              results.map((titular) => (
                <div
                  key={titular.id}
                  onClick={() => setSelectedTitular(titular)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors flex items-center justify-between ${
                    selectedTitular?.id === titular.id
                      ? "border-teal-500 bg-teal-50"
                      : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{titular.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {titular.cpf ? formatCPF(titular.cpf) : "Sem CPF"}
                    </p>
                  </div>
                  {selectedTitular?.id === titular.id && (
                    <Check className="h-4 w-4 text-teal-600" />
                  )}
                </div>
              ))
            ) : search.length >= 3 ? (
              <p className="text-center py-4 text-sm text-muted-foreground">
                Nenhum associado encontrado.
              </p>
            ) : (
              <p className="text-center py-4 text-sm text-muted-foreground">
                Digite pelo menos 3 caracteres para buscar.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={transferring}>
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedTitular || transferring}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {transferring ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Confirmar Transferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
