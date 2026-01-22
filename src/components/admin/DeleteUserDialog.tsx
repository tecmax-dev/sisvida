import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, AlertTriangle, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    user_id: string;
    name: string;
    email: string;
    clinicsCount: number;
  } | null;
  onSuccess: () => void;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: DeleteUserDialogProps) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setConfirmEmail("");
    setError(null);
    onOpenChange(false);
  };

  const isEmailMatch = confirmEmail.toLowerCase() === user?.email.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) return;

    if (!isEmailMatch) {
      setError("Digite o email corretamente para confirmar a exclusão");
      return;
    }

    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "delete-user",
        {
          body: {
            targetUserId: user.user_id,
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Usuário excluído com sucesso!", {
        description: `O usuário ${user.name} foi removido do sistema`,
      });

      handleClose();
      onSuccess();
    } catch (err: any) {
      console.error("Error deleting user:", err);
      setError(err.message || "Erro ao excluir usuário");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PopupBase open={open} onClose={handleClose} maxWidth="md">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          Excluir Usuário
        </PopupTitle>
        <PopupDescription>
          Você está prestes a excluir permanentemente o usuário{" "}
          <span className="font-medium text-foreground">{user?.name}</span>
        </PopupDescription>
      </PopupHeader>

      <div className="space-y-4 py-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção!</strong> Esta ação é <strong>irreversível</strong>. 
            Todos os dados associados a este usuário serão excluídos permanentemente.
          </AlertDescription>
        </Alert>

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Nome:</span>
            <span className="font-medium">{user?.name}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Email:</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Clínicas vinculadas:</span>
            <span className="font-medium flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {user?.clinicsCount || 0}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-email-delete">
              Digite <strong>{user?.email}</strong> para confirmar:
            </Label>
            <Input
              id="confirm-email-delete"
              type="email"
              placeholder="Digite o email do usuário"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
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

          <PopupFooter className="gap-2 sm:gap-0">
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
              disabled={loading || !isEmailMatch}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir Permanentemente
            </Button>
          </PopupFooter>
        </form>
      </div>
    </PopupBase>
  );
}
