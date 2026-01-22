import { useState, useRef } from "react";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      const content = await file.text();
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
    <PopupBase open={open} onClose={handleClose} maxWidth="4xl">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importar Extrato OFX
        </PopupTitle>
        <PopupDescription>
          Importe um arquivo OFX do seu banco para conciliar automaticamente as despesas.
        </PopupDescription>
      </PopupHeader>

      <div className="space-y-4">
        {/* Cash Register Selection */}
        <div>
          <Label>Conta Bancária *</Label>
          <Select value={selectedCashRegister} onValueChange={setSelectedCashRegister}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione a conta bancária" />
            </SelectTrigger>
            <SelectContent>
              {cashRegisters.map((cr) => (
                <SelectItem key={cr.id} value={cr.id}>
                  {cr.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File Upload */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label htmlFor="ofx-file">Arquivo OFX *</Label>
            <Input
              ref={fileInputRef}
              id="ofx-file"
              type="file"
              accept=".ofx,.OFX"
              onChange={handleFileUpload}
              disabled={isImporting}
              className="mt-1"
            />
          </div>
          {fileName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-6">
              <FileText className="h-4 w-4" />
              {fileName}
            </div>
          )}
        </div>

        {parseError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{parseError}</AlertDescription>
          </Alert>
        )}

        {/* Bank Info */}
        {bankInfo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
            {bankInfo.bankName && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Banco</p>
                  <p className="text-sm font-medium">{bankInfo.bankName}</p>
                </div>
              </div>
            )}
            {bankInfo.accountNumber && (
              <div>
                <p className="text-xs text-muted-foreground">Conta</p>
                <p className="text-sm font-medium">
                  {bankInfo.agency && `${bankInfo.agency} / `}
                  {bankInfo.accountNumber}
                </p>
              </div>
            )}
            {bankInfo.startDate && bankInfo.endDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Período</p>
                  <p className="text-sm font-medium">
                    {format(bankInfo.startDate, "dd/MM/yy")} - {format(bankInfo.endDate, "dd/MM/yy")}
                  </p>
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Transações</p>
              <p className="text-sm font-medium">{parsedTransactions.length}</p>
            </div>
          </div>
        )}

        {/* Summary */}
        {parsedTransactions.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">Créditos</p>
                <p className="text-lg font-bold text-emerald-600">
                  {formatCurrency(totalCredits)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
              <TrendingDown className="h-5 w-5 text-rose-600" />
              <div>
                <p className="text-xs text-rose-700 dark:text-rose-400">Débitos</p>
                <p className="text-lg font-bold text-rose-600">
                  {formatCurrency(totalDebits)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Transactions Preview */}
        {parsedTransactions.length > 0 && (
          <ScrollArea className="h-[300px] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Nº Cheque</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      {format(tx.date, "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium max-w-[280px] truncate">
                      {tx.description || "—"}
                    </TableCell>
                    <TableCell>
                      {tx.checkNumber ? (
                        <Badge variant="outline" className="font-mono">
                          {tx.checkNumber}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
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
        )}
      </div>

      <PopupFooter>
        <Button variant="outline" onClick={handleClose} disabled={isImporting}>
          Cancelar
        </Button>
        <Button
          onClick={handleImport}
          disabled={isImporting || !selectedCashRegister || parsedTransactions.length === 0}
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
      </PopupFooter>
    </PopupBase>
  );
}
