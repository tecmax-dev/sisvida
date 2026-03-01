import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BankStatementTransaction } from "@/hooks/useUnionReconciliation";
import { CheckCircle2, AlertCircle, XCircle, Link2 } from "lucide-react";

interface Props {
  transaction: BankStatementTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const statusLabels: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  auto_reconciled: { label: "Auto Conciliado", icon: <CheckCircle2 className="h-4 w-4" />, className: "bg-emerald-100 text-emerald-800" },
  manual_reconciled: { label: "Conciliado Manual", icon: <CheckCircle2 className="h-4 w-4" />, className: "bg-blue-100 text-blue-800" },
  pending_review: { label: "Pendente Revisão", icon: <AlertCircle className="h-4 w-4" />, className: "bg-amber-100 text-amber-800" },
  not_identified: { label: "Não Identificado", icon: <XCircle className="h-4 w-4" />, className: "bg-rose-100 text-rose-800" },
  ignored: { label: "Ignorado", icon: null, className: "" },
};

export function UnionTransactionDetailsDialog({ transaction: tx, open, onOpenChange }: Props) {
  if (!tx) return null;

  const status = statusLabels[tx.reconciliation_status] || { label: tx.reconciliation_status, icon: null, className: "" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes da Transação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge className={status.className}>
              {status.icon}
              <span className="ml-1">{status.label}</span>
            </Badge>
            <span className={`text-lg font-bold ${tx.transaction_type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
              {tx.transaction_type === "debit" ? "- " : "+ "}
              {formatCurrency(tx.amount)}
            </span>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Data</p>
              <p className="font-medium">{format(parseISO(tx.transaction_date), "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tipo</p>
              <p className="font-medium">{tx.transaction_type === "credit" ? "Crédito" : "Débito"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Descrição</p>
              <p className="font-medium">{tx.description || "—"}</p>
            </div>
            {tx.check_number && (
              <div>
                <p className="text-muted-foreground">Nº Cheque</p>
                <p className="font-mono font-medium">{tx.check_number}</p>
              </div>
            )}
            {tx.document_number && (
              <div>
                <p className="text-muted-foreground">Nº Documento</p>
                <p className="font-mono font-medium">{tx.document_number}</p>
              </div>
            )}
            {tx.fitid && (
              <div className="col-span-2">
                <p className="text-muted-foreground">FITID</p>
                <p className="font-mono text-xs">{tx.fitid}</p>
              </div>
            )}
          </div>

          {tx.matched_transaction && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                  <Link2 className="h-3 w-3" /> Vinculado a
                </p>
                <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                  <p className="font-medium">{tx.matched_transaction.description}</p>
                  <p>{formatCurrency(tx.matched_transaction.amount)}</p>
                  {tx.matched_transaction.check_number && (
                    <p className="text-muted-foreground">Cheque: {tx.matched_transaction.check_number}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {tx.reconciliation_notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Observações</p>
                <p className="text-sm">{tx.reconciliation_notes}</p>
              </div>
            </>
          )}

          {tx.reconciled_at && (
            <p className="text-xs text-muted-foreground">
              Conciliado em {format(parseISO(tx.reconciled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
