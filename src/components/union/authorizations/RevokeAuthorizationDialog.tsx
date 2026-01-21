import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { AlertPopup } from "@/components/ui/alert-popup";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Authorization {
  id: string;
  authorization_number: string;
  patient: {
    name: string;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorization: Authorization | null;
}

export function RevokeAuthorizationDialog({ open, onOpenChange, authorization }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!authorization || !user?.id) throw new Error("Dados inválidos");

      const { error } = await supabase
        .from("union_authorizations")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
          revocation_reason: reason || null,
        })
        .eq("id", authorization.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-authorizations"] });
      queryClient.invalidateQueries({ queryKey: ["member-authorizations"] });
      toast({ title: "Autorização revogada com sucesso" });
      onOpenChange(false);
      setReason("");
    },
    onError: (error: any) => {
      toast({ title: "Erro ao revogar", description: error.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setReason("");
    onOpenChange(false);
  };

  if (!authorization) return null;

  return (
    <AlertPopup
      open={open}
      onClose={handleClose}
      onConfirm={() => mutation.mutate()}
      title="Revogar Autorização?"
      description={
        <>
          A autorização <strong>{authorization.authorization_number}</strong> do associado{" "}
          <strong>{authorization.patient?.name}</strong> será revogada e não poderá mais ser utilizada.
        </>
      }
      confirmText={mutation.isPending ? "Revogando..." : "Revogar"}
      cancelText="Cancelar"
      confirmVariant="destructive"
      isLoading={mutation.isPending}
    >
      <div className="space-y-2 my-4">
        <Label htmlFor="reason">Motivo da revogação (opcional)</Label>
        <Textarea
          id="reason"
          placeholder="Informe o motivo..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>
    </AlertPopup>
  );
}
