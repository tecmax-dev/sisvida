import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, AlertTriangle, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DeleteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    name: string;
    cpf: string | null;
    phone: string;
    dependentsCount?: number;
  } | null;
  clinicId: string;
  onSuccess: () => void;
}

export function DeleteMemberDialog({
  open,
  onOpenChange,
  member,
  clinicId,
  onSuccess,
}: DeleteMemberDialogProps) {
  const [confirmName, setConfirmName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setConfirmName("");
    setError(null);
    onOpenChange(false);
  };

  // Compare only first name for confirmation (easier for users)
  const memberFirstName = member?.name?.split(" ")[0]?.toLowerCase() || "";
  const isNameMatch = confirmName.toLowerCase() === memberFirstName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!member) return;

    if (!isNameMatch) {
      setError("Digite o primeiro nome corretamente para confirmar a exclusão");
      return;
    }

    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "delete-patient",
        {
          body: {
            patientId: member.id,
            clinicId: clinicId,
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Associado excluído com sucesso!", {
        description: `O associado ${member.name} foi removido do sistema`,
      });

      handleClose();
      onSuccess();
    } catch (err: any) {
      console.error("Error deleting member:", err);
      setError(err.message || "Erro ao excluir associado");
    } finally {
      setLoading(false);
    }
  };

  const formatCPF = (value: string | null): string => {
    if (!value) return "—";
    const cleaned = value.replace(/\D/g, "");
    return cleaned
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .substring(0, 14);
  };

  const formatPhone = (value: string | null): string => {
    if (!value) return "—";
    const cleaned = value.replace(/\D/g, "");
    return cleaned
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .substring(0, 15);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Excluir Associado
          </DialogTitle>
          <DialogDescription>
            Você está prestes a excluir permanentemente o associado{" "}
            <span className="font-medium text-foreground">{member?.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Atenção!</strong> Esta ação é <strong>irreversível</strong>. 
              Todos os dados associados serão excluídos permanentemente, incluindo:
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>Carteirinhas e histórico</li>
                <li>Dependentes</li>
                <li>Agendamentos</li>
                <li>Anexos e documentos</li>
                <li>Contribuições</li>
                <li>Fichas de anamnese</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Nome:</span>
              <span className="font-medium">{member?.name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">CPF:</span>
              <span className="font-medium">{formatCPF(member?.cpf || null)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Telefone:</span>
              <span className="font-medium">{formatPhone(member?.phone || null)}</span>
            </div>
            {(member?.dependentsCount || 0) > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Dependentes:</span>
                <span className="font-medium flex items-center gap-1 text-amber-600">
                  <Users className="h-3.5 w-3.5" />
                  {member?.dependentsCount} (serão excluídos)
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-name-delete">
                Digite <strong>{memberFirstName.toUpperCase()}</strong> para confirmar:
              </Label>
              <Input
                id="confirm-name-delete"
                type="text"
                placeholder="Digite o primeiro nome do associado"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                disabled={loading}
                autoComplete="off"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                variant="destructive"
                disabled={loading || !isNameMatch}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Excluir Permanentemente
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
