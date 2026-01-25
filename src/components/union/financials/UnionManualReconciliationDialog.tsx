import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Link2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  Hash,
  Calendar,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnlyToLocalNoon } from "@/lib/date";

interface BankTransaction {
  id: string;
  transaction_date: string;
  description: string | null;
  amount: number;
  type: string;
  check_number: string | null;
  reconciliation_status: string;
  ofx_fitid: string;
}

interface UnionTransaction {
  id: string;
  description: string;
  gross_value: number;
  check_number: string | null;
  due_date: string;
  payment_date: string | null;
  status: string;
  cash_register_id: string;
}

interface UnionManualReconciliationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankTransaction: BankTransaction | null;
  unionTransactions: UnionTransaction[];
  onReconcile: (bankTransactionId: string, unionTransactionId: string) => Promise<void>;
  isReconciling: boolean;
}

export function UnionManualReconciliationDialog({
  open,
  onOpenChange,
  bankTransaction,
  unionTransactions,
  onReconcile,
  isReconciling,
}: UnionManualReconciliationDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Math.abs(value));

  // Filter and sort transactions - prioritize exact value matches
  const filteredTransactions = useMemo(() => {
    if (!bankTransaction) return [];

    let filtered = unionTransactions.filter((tx) => {
      // Only show unpaid transactions
      if (tx.status === "paid" || tx.status === "reversed") return false;

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesDescription = tx.description?.toLowerCase().includes(query);
        const matchesCheckNumber = tx.check_number?.includes(query);
        return matchesDescription || matchesCheckNumber;
      }

      return true;
    });

    // Sort by relevance (exact value match first, then check number match)
    const bankAmount = Math.abs(bankTransaction.amount);
    const bankCheckNumber = bankTransaction.check_number;

    return filtered.sort((a, b) => {
      const aValue = Math.abs(a.gross_value);
      const bValue = Math.abs(b.gross_value);
      const aExactValue = Math.abs(aValue - bankAmount) < 0.01;
      const bExactValue = Math.abs(bValue - bankAmount) < 0.01;
      const aCheckMatch = bankCheckNumber && a.check_number === bankCheckNumber;
      const bCheckMatch = bankCheckNumber && b.check_number === bankCheckNumber;

      // Perfect match (value + check) first
      if (aExactValue && aCheckMatch && !(bExactValue && bCheckMatch)) return -1;
      if (bExactValue && bCheckMatch && !(aExactValue && aCheckMatch)) return 1;

      // Value match second
      if (aExactValue && !bExactValue) return -1;
      if (bExactValue && !aExactValue) return 1;

      // Check number match third
      if (aCheckMatch && !bCheckMatch) return -1;
      if (bCheckMatch && !aCheckMatch) return 1;

      // Then by closest value
      return Math.abs(aValue - bankAmount) - Math.abs(bValue - bankAmount);
    });
  }, [unionTransactions, bankTransaction, searchQuery]);

  const handleReconcile = async () => {
    if (!bankTransaction || !selectedTransactionId) return;
    await onReconcile(bankTransaction.id, selectedTransactionId);
    handleClose();
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedTransactionId(null);
    onOpenChange(false);
  };

  if (!bankTransaction) return null;

  const isValueMatch = (txValue: number) =>
    Math.abs(Math.abs(txValue) - Math.abs(bankTransaction.amount)) < 0.01;

  const isCheckMatch = (checkNumber: string | null) =>
    bankTransaction.check_number &&
    checkNumber &&
    checkNumber === bankTransaction.check_number;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Conciliação Manual
          </DialogTitle>
          <DialogDescription>
            Vincule a transação do extrato a uma despesa existente no sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bank Transaction Info */}
          <div className="p-4 bg-muted/30 rounded-lg border">
            <h4 className="font-medium text-sm mb-3 text-muted-foreground">
              Transação do Extrato
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {format(parseISO(bankTransaction.transaction_date), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Descrição</p>
                <p className="font-medium truncate max-w-[150px]">
                  {bankTransaction.description || "—"}
                </p>
              </div>
              {bankTransaction.check_number && (
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Cheque</p>
                    <Badge variant="outline" className="font-mono">
                      {bankTransaction.check_number}
                    </Badge>
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Valor</p>
                <p
                  className={`text-lg font-bold ${
                    bankTransaction.type === "credit" ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {formatCurrency(bankTransaction.amount)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição ou número do cheque..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Matching Alert */}
          {filteredTransactions.length > 0 &&
            filteredTransactions.some(
              (tx) => isValueMatch(tx.gross_value) || isCheckMatch(tx.check_number)
            ) && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Encontramos despesas que coincidem com o valor ou número do cheque!
                </span>
              </div>
            )}

          {/* Transactions List */}
          <ScrollArea className="h-[300px] border rounded-md">
            <RadioGroup
              value={selectedTransactionId || ""}
              onValueChange={setSelectedTransactionId}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Cheque</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Correspondência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma despesa pendente encontrada</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const valueMatch = isValueMatch(tx.gross_value);
                      const checkMatch = isCheckMatch(tx.check_number);
                      const perfectMatch = valueMatch && checkMatch;

                      return (
                        <TableRow
                          key={tx.id}
                          className={`cursor-pointer ${
                            selectedTransactionId === tx.id
                              ? "bg-primary/10"
                              : perfectMatch
                              ? "bg-emerald-50 dark:bg-emerald-900/20"
                              : ""
                          }`}
                          onClick={() => setSelectedTransactionId(tx.id)}
                        >
                          <TableCell>
                            <RadioGroupItem value={tx.id} />
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {tx.description}
                          </TableCell>
                          <TableCell>
                            {format(parseDateOnlyToLocalNoon(tx.due_date), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {tx.check_number ? (
                              <Badge
                                variant={checkMatch ? "default" : "outline"}
                                className={`font-mono ${
                                  checkMatch
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : ""
                                }`}
                              >
                                {tx.check_number}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              valueMatch ? "text-emerald-600" : ""
                            }`}
                          >
                            {formatCurrency(tx.gross_value)}
                          </TableCell>
                          <TableCell>
                            {perfectMatch ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-700">
                                Perfeita
                              </Badge>
                            ) : valueMatch ? (
                              <Badge variant="secondary">Valor</Badge>
                            ) : checkMatch ? (
                              <Badge variant="secondary">Cheque</Badge>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </RadioGroup>
          </ScrollArea>

          {/* Warning for non-matching selection */}
          {selectedTransactionId && (
            <div className="text-sm">
              {(() => {
                const selected = filteredTransactions.find(
                  (tx) => tx.id === selectedTransactionId
                );
                if (!selected) return null;

                const valueMatch = isValueMatch(selected.gross_value);
                const checkMatch = isCheckMatch(selected.check_number);

                if (!valueMatch && !checkMatch) {
                  return (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                      <AlertCircle className="h-4 w-4" />
                      <span>
                        Atenção: O valor e o número do cheque não correspondem. Confirme
                        que esta é a despesa correta.
                      </span>
                    </div>
                  );
                }

                if (!valueMatch) {
                  return (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                      <AlertCircle className="h-4 w-4" />
                      <span>
                        Atenção: O valor da despesa ({formatCurrency(selected.gross_value)})
                        difere do extrato ({formatCurrency(bankTransaction.amount)}).
                      </span>
                    </div>
                  );
                }

                return null;
              })()}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isReconciling}>
            Cancelar
          </Button>
          <Button
            onClick={handleReconcile}
            disabled={isReconciling || !selectedTransactionId}
          >
            {isReconciling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Conciliando...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                Conciliar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
