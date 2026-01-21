import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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

  if (!authorization) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revogar Autorização?</AlertDialogTitle>
          <AlertDialogDescription>
            A autorização <strong>{authorization.authorization_number}</strong> do associado{" "}
            <strong>{authorization.patient?.name}</strong> será revogada e não poderá mais ser utilizada.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reason">Motivo da revogação (opcional)</Label>
          <Textarea
            id="reason"
            placeholder="Informe o motivo..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Revogar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
