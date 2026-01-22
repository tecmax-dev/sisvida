import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, Undo2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ReversalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: {
    id: string;
    description: string;
    amount: number;
    type: "income" | "expense";
    status: string;
  } | null;
}

export function ReversalDialog({ open, onOpenChange, transaction }: ReversalDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const reversalMutation = useMutation({
    mutationFn: async () => {
      if (!transaction) throw new Error("Transação não encontrada");
      if (!reason.trim()) throw new Error("Motivo do estorno é obrigatório");

      const { data, error } = await supabase.rpc("reverse_transaction", {
        p_transaction_id: transaction.id,
        p_reason: reason.trim(),
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; message?: string };
      if (!result.success) {
        throw new Error(result.error || "Erro ao estornar transação");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cash-flow"] });
      queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] });
      toast.success("Transação estornada com sucesso!");
      setReason("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erro ao estornar: " + error.message);
    },
  });

  const handleReverse = () => {
    if (!reason.trim()) {
      toast.error("Informe o motivo do estorno");
      return;
    }
    reversalMutation.mutate();
  };

  if (!transaction) return null;

  const canReverse = transaction.status === "paid";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-amber-500" />
            Estornar Transação
          </DialogTitle>
          <DialogDescription>
            Esta ação irá reverter a transação e atualizar o saldo do portador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Transaction Info */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Descrição</span>
              <span className="font-medium">{transaction.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Valor</span>
              <span className={`font-medium ${transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(transaction.amount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tipo</span>
              <span className="font-medium">
                {transaction.type === 'income' ? 'Receita' : 'Despesa'}
              </span>
            </div>
          </div>

          {/* Warning Alert */}
          <Alert variant="destructive" className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Atenção</AlertTitle>
            <AlertDescription className="text-amber-700">
              O estorno é irreversível. O saldo do portador bancário será ajustado automaticamente.
            </AlertDescription>
          </Alert>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo do Estorno *</Label>
            <Textarea
              id="reason"
              placeholder="Informe o motivo do estorno..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {!canReverse && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Não é possível estornar</AlertTitle>
              <AlertDescription>
                Apenas transações com status "Pago" podem ser estornadas.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleReverse}
            disabled={!canReverse || !reason.trim() || reversalMutation.isPending}
          >
            {reversalMutation.isPending ? "Estornando..." : "Confirmar Estorno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
