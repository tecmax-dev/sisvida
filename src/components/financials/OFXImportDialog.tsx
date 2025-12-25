import { useState, useRef } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface OFXTransaction {
  id: string;
  date: Date;
  amount: number;
  description: string;
  type: "credit" | "debit";
  fitid: string;
  selected: boolean;
  matched?: boolean;
}

interface OFXImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: any[];
  onMatchTransactions: (matches: { ofxTransaction: OFXTransaction; systemTransactionId: string }[]) => void;
}

// Simple OFX parser
function parseOFX(content: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = [];
  
  // Remove SGML header and get just the XML-like content
  const ofxStart = content.indexOf("<OFX>");
  if (ofxStart === -1) {
    throw new Error("Arquivo OFX inválido: tag <OFX> não encontrada");
  }
  
  const ofxContent = content.substring(ofxStart);
  
  // Find all STMTTRN blocks (statement transactions)
  const stmttrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  
  while ((match = stmttrnRegex.exec(ofxContent)) !== null) {
    const block = match[1];
    
    // Extract fields
    const trntype = extractField(block, "TRNTYPE");
    const dtposted = extractField(block, "DTPOSTED");
    const trnamt = extractField(block, "TRNAMT");
    const fitid = extractField(block, "FITID");
    const memo = extractField(block, "MEMO") || extractField(block, "NAME") || "";
    
    if (dtposted && trnamt) {
      // Parse date (format: YYYYMMDDHHMMSS or YYYYMMDD)
      const dateStr = dtposted.substring(0, 8);
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      const date = new Date(year, month, day);
      
      // Parse amount
      const amount = parseFloat(trnamt.replace(",", "."));
      
      transactions.push({
        id: fitid || `${dateStr}-${Math.random().toString(36).substr(2, 9)}`,
        date,
        amount: Math.abs(amount),
        description: memo.trim(),
        type: amount >= 0 ? "credit" : "debit",
        fitid: fitid || "",
        selected: false,
      });
    }
  }
  
  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function extractField(block: string, fieldName: string): string | null {
  // Handle both formats: <FIELD>value</FIELD> and <FIELD>value
  const regex = new RegExp(`<${fieldName}>([^<\\n\\r]+)`, "i");
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

export function OFXImportDialog({
  open,
  onOpenChange,
  transactions,
  onMatchTransactions,
}: OFXImportDialogProps) {
  const [ofxTransactions, setOfxTransactions] = useState<OFXTransaction[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchResults, setMatchResults] = useState<Map<string, string>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    try {
      const content = await file.text();
      const parsed = parseOFX(content);
      
      if (parsed.length === 0) {
        toast.error("Nenhuma transação encontrada no arquivo OFX");
        return;
      }

      // Auto-match transactions
      const matches = new Map<string, string>();
      const matchedOfx = parsed.map((ofxTx) => {
        // Try to find a matching system transaction
        const matchedTx = transactions.find((sysTx) => {
          const sysDate = sysTx.paid_date ? new Date(sysTx.paid_date) : null;
          if (!sysDate) return false;
          
          // Match by date and amount (with small tolerance for floating point)
          const sameDate = 
            sysDate.getFullYear() === ofxTx.date.getFullYear() &&
            sysDate.getMonth() === ofxTx.date.getMonth() &&
            sysDate.getDate() === ofxTx.date.getDate();
          
          const sameAmount = Math.abs(Number(sysTx.amount) - ofxTx.amount) < 0.01;
          const sameType = 
            (ofxTx.type === "credit" && sysTx.type === "income") ||
            (ofxTx.type === "debit" && sysTx.type === "expense");
          
          return sameDate && sameAmount && sameType && !sysTx.is_reconciled;
        });

        if (matchedTx) {
          matches.set(ofxTx.id, matchedTx.id);
          return { ...ofxTx, matched: true, selected: true };
        }
        return ofxTx;
      });

      setOfxTransactions(matchedOfx);
      setMatchResults(matches);
      
      toast.success(`${parsed.length} transações importadas, ${matches.size} correspondências encontradas`);
    } catch (error) {
      console.error("Error parsing OFX:", error);
      toast.error("Erro ao processar arquivo OFX");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setOfxTransactions((prev) =>
      prev.map((tx) =>
        tx.id === id ? { ...tx, selected: !tx.selected } : tx
      )
    );
  };

  const handleConfirm = () => {
    const selectedMatches = ofxTransactions
      .filter((tx) => tx.selected && matchResults.has(tx.id))
      .map((tx) => ({
        ofxTransaction: tx,
        systemTransactionId: matchResults.get(tx.id)!,
      }));

    if (selectedMatches.length === 0) {
      toast.error("Nenhuma transação correspondente selecionada");
      return;
    }

    onMatchTransactions(selectedMatches);
    handleClose();
  };

  const handleClose = () => {
    setOfxTransactions([]);
    setFileName("");
    setMatchResults(new Map());
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

  const selectedCount = ofxTransactions.filter((tx) => tx.selected && tx.matched).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Extrato OFX
          </DialogTitle>
          <DialogDescription>
            Selecione um arquivo OFX do seu banco para conciliar automaticamente com as transações do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="ofx-file">Arquivo OFX</Label>
              <Input
                ref={fileInputRef}
                id="ofx-file"
                type="file"
                accept=".ofx,.OFX"
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
            </div>
            {fileName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {fileName}
              </div>
            )}
          </div>

          {/* Transactions Table */}
          {ofxTransactions.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {ofxTransactions.length} transações no extrato
                </span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {matchResults.size} correspondências
                  </span>
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    {ofxTransactions.length - matchResults.size} sem correspondência
                  </span>
                </div>
              </div>

              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ofxTransactions.map((tx) => (
                      <TableRow
                        key={tx.id}
                        className={tx.matched ? "bg-emerald-50 dark:bg-emerald-900/10" : ""}
                      >
                        <TableCell>
                          {tx.matched && (
                            <Checkbox
                              checked={tx.selected}
                              onCheckedChange={() => toggleSelect(tx.id)}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {format(tx.date, "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium max-w-[300px] truncate">
                          {tx.description}
                        </TableCell>
                        <TableCell>
                          {tx.matched ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                              Correspondência encontrada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Sem correspondência
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            tx.type === "credit" ? "text-emerald-600" : "text-red-600"
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
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
          >
            Conciliar {selectedCount} transação(ões)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
