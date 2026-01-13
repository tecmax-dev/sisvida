import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Printer, FileCheck } from "lucide-react";

interface UnionCheckPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  initialCheckNumber?: string;
}

export function UnionCheckPrintDialog({
  open,
  onOpenChange,
  clinicId,
  initialCheckNumber,
}: UnionCheckPrintDialogProps) {
  const [checkNumber, setCheckNumber] = useState(initialCheckNumber || "");
  const [searchedCheckNumber, setSearchedCheckNumber] = useState(initialCheckNumber || "");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["union-check-expenses", clinicId, searchedCheckNumber],
    queryFn: async () => {
      if (!searchedCheckNumber) return [];
      const { data, error } = await supabase
        .from("union_financial_transactions")
        .select(`
          *,
          category:union_financial_categories(id, name),
          supplier:union_suppliers(id, name),
          cash_register:union_cash_registers(id, name)
        `)
        .eq("clinic_id", clinicId)
        .eq("type", "expense")
        .eq("check_number", searchedCheckNumber)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clinicId && !!searchedCheckNumber,
  });

  const { data: clinic } = useQuery({
    queryKey: ["clinic-for-print", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinics")
        .select("name, cnpj")
        .eq("id", clinicId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  const totalAmount = useMemo(() => {
    if (!expenses) return 0;
    return expenses.reduce((sum, e) => sum + Number(e.net_value || e.amount), 0);
  }, [expenses]);

  const handleSearch = () => {
    if (!checkNumber.trim()) {
      toast.error("Digite um número de cheque");
      return;
    }
    setSearchedCheckNumber(checkNumber.trim());
  };

  const handleClose = () => {
    setCheckNumber("");
    setSearchedCheckNumber("");
    onOpenChange(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-100 text-emerald-800 print:bg-emerald-100">Pago</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-800 print:bg-amber-100">Pendente</Badge>;
      case "overdue":
        return <Badge className="bg-rose-100 text-rose-800 print:bg-rose-100">Vencido</Badge>;
      case "cancelled":
        return <Badge className="bg-slate-100 text-slate-800 print:bg-slate-100">Cancelado</Badge>;
      case "reversed":
        return <Badge className="bg-purple-100 text-purple-800 print:bg-purple-100">Estornado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handlePrint = () => {
    if (!expenses || expenses.length === 0) {
      toast.error("Nenhuma despesa para imprimir");
      return;
    }

    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Não foi possível abrir a janela de impressão");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cópia de Cheque - ${searchedCheckNumber}</title>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #1e3a5f;
              padding-bottom: 15px;
              margin-bottom: 20px;
            }
            .header h1 {
              color: #1e3a5f;
              margin: 0;
              font-size: 24px;
            }
            .header p {
              color: #666;
              margin: 5px 0 0;
            }
            .check-info {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .check-number {
              font-size: 28px;
              font-weight: bold;
              color: #1e3a5f;
            }
            .bank-info {
              text-align: right;
              color: #666;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: left;
            }
            th {
              background: #1e3a5f;
              color: white;
            }
            tr:nth-child(even) {
              background: #f9f9f9;
            }
            .status-paid {
              background: #d1fae5;
              color: #065f46;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 12px;
            }
            .status-pending {
              background: #fef3c7;
              color: #92400e;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 12px;
            }
            .status-overdue {
              background: #fee2e2;
              color: #991b1b;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 12px;
            }
            .status-cancelled {
              background: #e2e8f0;
              color: #475569;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 12px;
            }
            .status-reversed {
              background: #ede9fe;
              color: #5b21b6;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 12px;
            }
            .total-row {
              background: #f0f9ff !important;
              font-weight: bold;
            }
            .total-row td {
              border-top: 2px solid #1e3a5f;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #666;
              font-size: 12px;
              border-top: 1px solid #ddd;
              padding-top: 15px;
            }
            .signature-area {
              margin-top: 50px;
              display: flex;
              justify-content: space-between;
            }
            .signature-line {
              width: 200px;
              border-top: 1px solid #333;
              text-align: center;
              padding-top: 5px;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${clinic?.name || "Entidade Sindical"}</h1>
            ${clinic?.cnpj ? `<p>CNPJ: ${clinic.cnpj}</p>` : ""}
          </div>
          
          <div class="check-info">
            <div>
              <span style="color: #666;">Cheque Nº</span>
              <div class="check-number">${searchedCheckNumber}</div>
            </div>
            <div class="bank-info">
              <div><strong>Portador:</strong> ${expenses[0]?.cash_register?.name || "-"}</div>
              <div><strong>Despesas:</strong> ${expenses.length}</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Fornecedor</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${expenses.map((e) => `
                <tr>
                  <td>${e.description}</td>
                  <td>${e.supplier?.name || "-"}</td>
                  <td>${e.due_date ? format(parseISO(e.due_date), "dd/MM/yyyy") : "-"}</td>
                  <td style="text-align: right;">${formatCurrency(Number(e.net_value || e.amount))}</td>
                  <td>
                    <span class="status-${e.status}">
                      ${e.status === "paid" ? "Pago" : 
                        e.status === "pending" ? "Pendente" : 
                        e.status === "overdue" ? "Vencido" : 
                        e.status === "cancelled" ? "Cancelado" : 
                        e.status === "reversed" ? "Estornado" : e.status}
                    </span>
                  </td>
                </tr>
              `).join("")}
              <tr class="total-row">
                <td colspan="3"><strong>TOTAL DO CHEQUE</strong></td>
                <td style="text-align: right;"><strong>${formatCurrency(totalAmount)}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
          
          <div class="signature-area">
            <div class="signature-line">Emitente</div>
            <div class="signature-line">Beneficiário</div>
          </div>
          
          <div class="footer">
            Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Cópia de Cheque
          </DialogTitle>
          <DialogDescription>
            Busque um cheque pelo número e imprima o comprovante com as despesas lançadas
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="check-search">Número do Cheque</Label>
            <Input
              id="check-search"
              placeholder="Digite o número do cheque..."
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="mt-1"
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading}>
            <Search className="h-4 w-4 mr-2" />
            Buscar
          </Button>
        </div>

        <Separator className="my-4" />

        {searchedCheckNumber && (
          <div ref={printRef} className="flex-1 overflow-hidden flex flex-col">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Buscando despesas...
              </div>
            ) : expenses && expenses.length > 0 ? (
              <>
                <Card className="mb-4">
                  <CardHeader className="py-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Cheque Nº {searchedCheckNumber}</span>
                      <div className="text-sm font-normal text-muted-foreground">
                        {expenses[0]?.cash_register?.name || "Portador não definido"}
                      </div>
                    </CardTitle>
                  </CardHeader>
                </Card>

                <ScrollArea className="flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell className="font-medium">
                            {expense.description}
                          </TableCell>
                          <TableCell>{expense.supplier?.name || "-"}</TableCell>
                          <TableCell>
                            {expense.due_date
                              ? format(parseISO(expense.due_date), "dd/MM/yyyy", {
                                  locale: ptBR,
                                })
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(Number(expense.net_value || expense.amount))}
                          </TableCell>
                          <TableCell>{getStatusBadge(expense.status)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={3}>TOTAL DO CHEQUE</TableCell>
                        <TableCell className="text-right text-lg">
                          {formatCurrency(totalAmount)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </ScrollArea>

                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    {expenses.length} despesa(s) encontrada(s)
                  </div>
                  <Button onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Cópia
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma despesa encontrada para o cheque "{searchedCheckNumber}"</p>
              </div>
            )}
          </div>
        )}

        {!searchedCheckNumber && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Digite o número do cheque e clique em "Buscar"</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
