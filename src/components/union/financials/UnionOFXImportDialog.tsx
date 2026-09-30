import { useState, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Building2,
  Calendar,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { parseOFX, OFXTransaction } from "@/hooks/useUnionReconciliation";

interface UnionOFXImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashRegisters: { id: string; name: string }[];
  onImport: (params: {
    fileContent: string;
    fileName: string;
    cashRegisterId: string;
    userId: string;
  }) => Promise<{ importRecord: any; autoReconciled: number; total: number }>;
  isImporting: boolean;
  userId: string;
}

export function UnionOFXImportDialog({
  open,
  onOpenChange,
  cashRegisters,
  onImport,
  isImporting,
  userId,
}: UnionOFXImportDialogProps) {
  const isMobile = useIsMobile();
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [selectedCashRegister, setSelectedCashRegister] = useState("");
  const [parsedTransactions, setParsedTransactions] = useState<OFXTransaction[]>([]);
  const [bankInfo, setBankInfo] = useState<{
    bankCode: string | null;
    bankName: string | null;
    accountNumber: string | null;
    agency: string | null;
    startDate: Date | null;
    endDate: Date | null;
  } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);

    try {
      // OFX files from Brazilian banks are typically encoded in ISO-8859-1 (Latin-1)
      // Try Latin-1 first to preserve accented characters (e.g. CRÉD.TED-STR)
      let content: string;
      try {
        const buffer = await file.arrayBuffer();
        const decoder = new TextDecoder("iso-8859-1");
        content = decoder.decode(buffer);
      } catch (_e) {
        // Fallback to default UTF-8
        content = await file.text();
      }
      setFileContent(content);

      const { transactions, bankInfo: info } = parseOFX(content);

      if (transactions.length === 0) {
        setParseError("Nenhuma transação encontrada no arquivo OFX");
        return;
      }

      setParsedTransactions(transactions);
      setBankInfo(info);
    } catch (error: any) {
      console.error("Error parsing OFX:", error);
      setParseError(error.message || "Erro ao processar arquivo OFX");
      setParsedTransactions([]);
      setBankInfo(null);
    }
  };

  const handleImport = async () => {
    if (!selectedCashRegister) {
      toast.error("Selecione uma conta bancária");
      return;
    }

    if (!fileContent) {
      toast.error("Selecione um arquivo OFX");
      return;
    }

    try {
      await onImport({
        fileContent,
        fileName,
        cashRegisterId: selectedCashRegister,
        userId,
      });
      handleClose();
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleClose = () => {
    setFileName("");
    setFileContent("");
    setSelectedCashRegister("");
    setParsedTransactions([]);
    setBankInfo(null);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const totalCredits = parsedTransactions
    .filter((t) => t.type === "credit")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDebits = parsedTransactions
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`max-h-[90vh] flex flex-col ${isMobile ? 'w-[95vw] max-w-[95vw] p-4' : 'max-w-4xl'}`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
            Importar Extrato OFX
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Importe um arquivo OFX do seu banco para conciliar automaticamente as despesas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 min-h-0">
          {/* Cash Register Selection */}
          <div>
            <Label htmlFor="ofx-cash-register" className="text-xs sm:text-sm">Conta Bancária *</Label>
            <select
              id="ofx-cash-register"
              value={selectedCashRegister}
              onChange={(event) => setSelectedCashRegister(event.target.value)}
              disabled={isImporting}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
            >
              <option value="" disabled>Selecione a conta bancária</option>
              {cashRegisters.map((cr) => (
                <option key={cr.id} value={cr.id}>{cr.name}</option>
              ))}
            </select>
          </div>

          {/* File Upload */}
          <div className={`${isMobile ? 'flex flex-col gap-2' : 'flex items-center gap-4'}`}>
            <div className="flex-1">
              <Label htmlFor="ofx-file" className="text-xs sm:text-sm">Arquivo OFX *</Label>
              <Input
                ref={fileInputRef}
                id="ofx-file"
                type="file"
                accept=".ofx,.OFX"
                onChange={handleFileUpload}
                disabled={isImporting}
                className="mt-1 text-xs sm:text-sm"
              />
            </div>
            {fileName && (
              <div className={`flex items-center gap-2 text-xs sm:text-sm text-muted-foreground ${isMobile ? '' : 'pt-6'}`}>
                <FileText className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">{fileName}</span>
              </div>
            )}
          </div>

          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm">{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Bank Info */}
          {bankInfo && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 p-3 sm:p-4 bg-muted/30 rounded-lg">
              {bankInfo.bankName && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Banco</p>
                    <p className="text-xs sm:text-sm font-medium truncate">{bankInfo.bankName}</p>
                  </div>
                </div>
              )}
              {bankInfo.accountNumber && (
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Conta</p>
                  <p className="text-xs sm:text-sm font-medium truncate">
                    {bankInfo.agency && `${bankInfo.agency} / `}
                    {bankInfo.accountNumber}
                  </p>
                </div>
              )}
              {bankInfo.startDate && bankInfo.endDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Período</p>
                    <p className="text-xs sm:text-sm font-medium">
                      {format(bankInfo.startDate, "dd/MM/yy")} - {format(bankInfo.endDate, "dd/MM/yy")}
                    </p>
                  </div>
                </div>
              )}
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Transações</p>
                <p className="text-xs sm:text-sm font-medium">{parsedTransactions.length}</p>
              </div>
            </div>
          )}

          {/* Summary */}
          {parsedTransactions.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-emerald-700 dark:text-emerald-400">Créditos</p>
                  <p className="text-sm sm:text-lg font-bold text-emerald-600 truncate">
                    {formatCurrency(totalCredits)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-rose-700 dark:text-rose-400">Débitos</p>
                  <p className="text-sm sm:text-lg font-bold text-rose-600 truncate">
                    {formatCurrency(totalDebits)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Transactions Preview */}
          {parsedTransactions.length > 0 && (
            isMobile ? (
              <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-2">
                {parsedTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-2 bg-muted/20 rounded text-xs gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground whitespace-nowrap">
                          {format(tx.date, "dd/MM/yy", { locale: ptBR })}
                        </span>
                        {tx.checkNumber && (
                          <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
                            {tx.checkNumber}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium truncate mt-0.5">{tx.description || "—"}</p>
                    </div>
                    <span
                      className={`font-medium whitespace-nowrap ${
                        tx.type === "credit" ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {tx.type === "debit" ? "- " : "+ "}
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Descrição</TableHead>
                      <TableHead className="text-xs">Nº Cheque</TableHead>
                      <TableHead className="text-right text-xs">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs">
                          {format(tx.date, "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium max-w-[280px] truncate text-xs">
                          {tx.description || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {tx.checkNumber ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {tx.checkNumber}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium text-xs ${
                            tx.type === "credit" ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {tx.type === "debit" ? "- " : "+ "}
                          {formatCurrency(tx.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )
          )}
        </div>

        <DialogFooter className={`flex-shrink-0 ${isMobile ? 'flex-col gap-2' : ''}`}>
          <Button variant="outline" onClick={handleClose} disabled={isImporting} className={`text-xs sm:text-sm ${isMobile ? 'w-full' : ''}`}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || !selectedCashRegister || parsedTransactions.length === 0}
            className={`text-xs sm:text-sm ${isMobile ? 'w-full' : ''}`}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Importar e Conciliar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
