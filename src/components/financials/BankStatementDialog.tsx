import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileText, ArrowUpCircle, ArrowDownCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OFXTransaction {
  id: string;
  date: Date;
  amount: number;
  description: string;
  type: "credit" | "debit";
  fitid: string;
}

interface BankStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  register: {
    id: string;
    name: string;
    bank_name?: string;
    agency?: string;
    account_number?: string;
  } | null;
}

function parseOFX(content: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = [];
  
  // Regex para encontrar blocos de transação
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  
  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const block = match[1];
    
    const extractField = (fieldName: string): string | null => {
      const regex = new RegExp(`<${fieldName}>([^<\\n\\r]+)`, "i");
      const fieldMatch = block.match(regex);
      return fieldMatch ? fieldMatch[1].trim() : null;
    };
    
    const trnType = extractField("TRNTYPE");
    const dtPosted = extractField("DTPOSTED");
    const trnAmt = extractField("TRNAMT");
    const fitid = extractField("FITID");
    const memo = extractField("MEMO") || extractField("NAME") || "";
    
    if (dtPosted && trnAmt) {
      const amount = parseFloat(trnAmt.replace(",", "."));
      
      // Parse da data no formato YYYYMMDD ou YYYYMMDDHHMMSS
      let dateStr = dtPosted.substring(0, 8);
      let date: Date;
      try {
        date = parse(dateStr, "yyyyMMdd", new Date());
      } catch {
        date = new Date();
      }
      
      transactions.push({
        id: fitid || `${dtPosted}-${Math.random()}`,
        date,
        amount: Math.abs(amount),
        description: memo,
        type: amount >= 0 ? "credit" : "debit",
        fitid: fitid || "",
      });
    }
  }
  
  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function BankStatementDialog({
  open,
  onOpenChange,
  register,
}: BankStatementDialogProps) {
  const [transactions, setTransactions] = useState<OFXTransaction[]>([]);
  const [fileName, setFileName] = useState<string>("");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".ofx")) {
      toast.error("Por favor, selecione um arquivo OFX");
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseOFX(content);
      
      if (parsed.length === 0) {
        toast.error("Nenhuma transação encontrada no arquivo OFX");
        return;
      }
      
      setTransactions(parsed);
      toast.success(`${parsed.length} transações importadas`);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleClear = () => {
    setTransactions([]);
    setFileName("");
  };

  const handleClose = () => {
    setTransactions([]);
    setFileName("");
    onOpenChange(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const totalCredits = transactions
    .filter((t) => t.type === "credit")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebits = transactions
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Extrato Bancário - {register?.name}
          </DialogTitle>
          {register?.bank_name && (
            <p className="text-sm text-muted-foreground">
              {register.bank_name} | Ag: {register.agency} | CC: {register.account_number}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Upload Section */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                type="file"
                accept=".ofx"
                onChange={handleFileUpload}
                className="hidden"
                id="ofx-upload"
              />
              <label htmlFor="ofx-upload">
                <Button variant="outline" className="cursor-pointer" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar Arquivo OFX
                  </span>
                </Button>
              </label>
            </div>
            
            {fileName && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{fileName}</Badge>
                <Button variant="ghost" size="icon" onClick={handleClear}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Summary */}
          {transactions.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
                <p className="text-sm text-muted-foreground">Entradas</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(totalCredits)}
                </p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
                <p className="text-sm text-muted-foreground">Saídas</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(totalDebits)}
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="text-sm text-muted-foreground">Saldo do Período</p>
                <p className={`text-lg font-bold ${totalCredits - totalDebits >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(totalCredits - totalDebits)}
                </p>
              </div>
            </div>
          )}

          {/* Transactions Table */}
          {transactions.length > 0 ? (
            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[100px] text-center">Tipo</TableHead>
                    <TableHead className="text-right w-[150px]">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        {format(transaction.date, "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {transaction.description || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {transaction.type === "credit" ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <ArrowUpCircle className="h-3 w-3 mr-1" />
                            Entrada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            <ArrowDownCircle className="h-3 w-3 mr-1" />
                            Saída
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        transaction.type === "credit" ? "text-green-600" : "text-red-600"
                      }`}>
                        {transaction.type === "credit" ? "+" : "-"} {formatCurrency(transaction.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex items-center justify-center border rounded-lg bg-muted/20">
              <div className="text-center text-muted-foreground p-8">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum extrato importado</p>
                <p className="text-sm">Clique em "Importar Arquivo OFX" para visualizar o extrato</p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
