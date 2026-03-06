import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorization: {
    id: string;
    authorization_number: string;
    status: string;
    patient?: { name: string } | null;
  } | null;
}

export function DeleteAuthorizationDialog({ open, onOpenChange, authorization }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!authorization) throw new Error("Autorização não encontrada");

      const { error } = await supabase
        .from("union_authorizations")
        .delete()
        .eq("id", authorization.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-authorizations"] });
      queryClient.invalidateQueries({ queryKey: ["member-authorizations"] });
      toast({ title: "Autorização excluída com sucesso" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir autorização",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Autorização</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir a autorização{" "}
            <strong>{authorization?.authorization_number}</strong>
            {authorization?.patient?.name && (
              <> do associado <strong>{authorization.patient.name}</strong></>
            )}
            ? Esta ação não poderá ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
