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
        .select("name, cnpj, logo_url, address, phone, email")
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

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Não foi possível abrir a janela de impressão");
      return;
    }

    const logoHtml = clinic?.logo_url 
      ? `<img src="${clinic.logo_url}" alt="Logo" style="max-height: 70px; max-width: 200px; object-fit: contain;" />`
      : `<div style="width: 70px; height: 70px; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
           <span style="color: white; font-size: 28px; font-weight: bold;">${(clinic?.name || "E").charAt(0)}</span>
         </div>`;

    // Count paid and pending
    const paidCount = expenses.filter(e => e.status === "paid").length;
    const pendingCount = expenses.filter(e => e.status !== "paid" && e.status !== "cancelled").length;
    const paidAmount = expenses.filter(e => e.status === "paid").reduce((sum, e) => sum + Number(e.net_value || e.amount), 0);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cópia de Cheque - ${searchedCheckNumber}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { margin: 8mm 10mm; size: A4; }
            }
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              background: #f8fafc;
              color: #1e293b;
              line-height: 1.3;
              font-size: 11px;
            }
            
            .document {
              max-width: 100%;
              margin: 0 auto;
              background: white;
            }
            
            /* Header compacto */
            .header {
              background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #1e3a5f 100%);
              color: white;
              padding: 12px 16px;
              display: flex;
              align-items: center;
              gap: 12px;
            }
            
            .header-logo {
              flex-shrink: 0;
            }
            
            .header-logo img {
              max-height: 40px !important;
              max-width: 100px !important;
            }
            
            .header-info {
              flex: 1;
            }
            
            .header-info h1 {
              font-size: 14px;
              font-weight: 700;
              margin-bottom: 2px;
              letter-spacing: -0.02em;
            }
            
            .header-info p {
              font-size: 10px;
              opacity: 0.85;
              margin: 0;
              line-height: 1.3;
            }
            
            .header-badge {
              background: rgba(255, 255, 255, 0.15);
              border: 1px solid rgba(255, 255, 255, 0.2);
              padding: 6px 12px;
              border-radius: 6px;
              text-align: center;
            }
            
            .header-badge span {
              display: block;
              font-size: 9px;
              opacity: 0.8;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            
            .header-badge strong {
              font-size: 16px;
              font-weight: 700;
            }
            
            /* Content area compacto */
            .content {
              padding: 12px 16px;
            }
            
            /* Summary cards compactos */
            .cards-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 12px;
            }
            
            .card {
              border-radius: 6px;
              padding: 8px 10px;
              position: relative;
              overflow: hidden;
            }
            
            .card::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 3px;
            }
            
            .card-slate {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
            }
            .card-slate::before { background: #64748b; }
            .card-slate .card-value { color: #334155; }
            
            .card-emerald {
              background: #ecfdf5;
              border: 1px solid #a7f3d0;
            }
            .card-emerald::before { background: #10b981; }
            .card-emerald .card-value { color: #047857; }
            
            .card-amber {
              background: #fffbeb;
              border: 1px solid #fde68a;
            }
            .card-amber::before { background: #f59e0b; }
            .card-amber .card-value { color: #b45309; }
            
            .card-blue {
              background: #eff6ff;
              border: 1px solid #bfdbfe;
            }
            .card-blue::before { background: #3b82f6; }
            .card-blue .card-value { color: #1d4ed8; }
            
            .card-label {
              font-size: 8px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #64748b;
              margin-bottom: 2px;
            }
            
            .card-value {
              font-size: 14px;
              font-weight: 700;
            }
            
            .card-sub {
              font-size: 9px;
              color: #94a3b8;
              margin-top: 1px;
            }
            
            /* Table compacta */
            .table-container {
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              overflow: hidden;
              margin-bottom: 12px;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
            }
            
            th {
              background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
              color: white;
              font-size: 9px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.03em;
              padding: 6px 8px;
              text-align: left;
            }
            
            th:last-child {
              text-align: center;
            }
            
            td {
              padding: 5px 8px;
              border-bottom: 1px solid #f1f5f9;
              font-size: 10px;
              line-height: 1.25;
            }
            
            tr:last-child td {
              border-bottom: none;
            }
            
            tr:nth-child(even) {
              background: #fafbfc;
            }
            
            .text-right {
              text-align: right;
            }
            
            .text-center {
              text-align: center;
            }
            
            .font-medium {
              font-weight: 500;
            }
            
            .font-semibold {
              font-weight: 600;
            }
            
            .truncate {
              max-width: 180px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            
            .truncate-sm {
              max-width: 120px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            
            /* Status badges compactos */
            .status {
              display: inline-flex;
              align-items: center;
              padding: 2px 6px;
              border-radius: 10px;
              font-size: 8px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.02em;
            }
            
            .status-paid {
              background: #d1fae5;
              color: #047857;
            }
            
            .status-pending {
              background: #fef3c7;
              color: #b45309;
            }
            
            .status-overdue {
              background: #fee2e2;
              color: #b91c1c;
            }
            
            .status-cancelled {
              background: #f1f5f9;
              color: #64748b;
            }
            
            .status-reversed {
              background: #ede9fe;
              color: #7c3aed;
            }
            
            /* Total row */
            .total-row {
              background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important;
            }
            
            .total-row td {
              padding: 8px;
              border-top: 2px solid #3b82f6;
              border-bottom: none !important;
            }
            
            .total-label {
              font-size: 10px;
              font-weight: 700;
              color: #1e3a5f;
              text-transform: uppercase;
              letter-spacing: 0.02em;
            }
            
            .total-value {
              font-size: 13px;
              font-weight: 700;
              color: #1e3a5f;
            }
            
            /* Signature area compacta */
            .signature-section {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
              margin: 20px 0;
              padding: 0 20px;
            }
            
            .signature-box {
              text-align: center;
            }
            
            .signature-line {
              border-top: 1px solid #cbd5e1;
              padding-top: 6px;
              margin-top: 30px;
            }
            
            .signature-label {
              font-size: 9px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            
            /* Footer compacto */
            .footer {
              background: #f8fafc;
              border-top: 1px solid #e2e8f0;
              padding: 8px 16px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .footer-left {
              display: flex;
              align-items: center;
              gap: 6px;
            }
            
            .footer-icon {
              width: 20px;
              height: 20px;
              background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
              border-radius: 4px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .footer-icon span {
              color: white;
              font-size: 10px;
              font-weight: 700;
            }
            
            .footer-text {
              font-size: 9px;
              color: #64748b;
            }
            
            .footer-text strong {
              display: block;
              color: #334155;
              font-size: 10px;
            }
            
            .footer-right {
              text-align: right;
              font-size: 9px;
              color: #94a3b8;
            }
          </style>
        </head>
        <body>
          <div class="document">
            <!-- Header -->
            <div class="header">
              <div class="header-logo">
                ${logoHtml.replace('max-height: 70px', 'max-height: 40px').replace('max-width: 200px', 'max-width: 100px').replace('width: 70px; height: 70px', 'width: 40px; height: 40px').replace('font-size: 28px', 'font-size: 18px')}
              </div>
              <div class="header-info">
                <h1>${clinic?.name || "Entidade Sindical"}</h1>
                ${clinic?.cnpj ? `<p>CNPJ: ${clinic.cnpj}${clinic?.address ? ` • ${clinic.address}` : ""}</p>` : ""}
              </div>
              <div class="header-badge">
                <span>Cheque Nº</span>
                <strong>${searchedCheckNumber}</strong>
              </div>
            </div>
            
            <!-- Content -->
            <div class="content">
              <!-- Summary Cards -->
              <div class="cards-grid">
                <div class="card card-slate">
                  <div class="card-label">Portador</div>
                  <div class="card-value" style="font-size: 11px;">${expenses[0]?.cash_register?.name || "-"}</div>
                </div>
                <div class="card card-blue">
                  <div class="card-label">Despesas</div>
                  <div class="card-value">${expenses.length}</div>
                  <div class="card-sub">lançamento(s)</div>
                </div>
                <div class="card card-emerald">
                  <div class="card-label">Pagos</div>
                  <div class="card-value">${paidCount}</div>
                  <div class="card-sub">${formatCurrency(paidAmount)}</div>
                </div>
                <div class="card card-amber">
                  <div class="card-label">Pendentes</div>
                  <div class="card-value">${pendingCount}</div>
                  <div class="card-sub">a liquidar</div>
                </div>
              </div>
              
              <!-- Table -->
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style="width: 35%;">Descrição</th>
                      <th style="width: 25%;">Fornecedor</th>
                      <th style="width: 15%;">Vencimento</th>
                      <th style="width: 15%; text-align: right;">Valor</th>
                      <th style="width: 10%;">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${expenses.map((e) => `
                      <tr>
                        <td class="font-medium truncate" title="${e.description}">${e.description}</td>
                        <td class="truncate-sm" title="${e.supplier?.name || "-"}">${e.supplier?.name || "-"}</td>
                        <td>${e.due_date ? format(parseISO(e.due_date), "dd/MM/yyyy") : "-"}</td>
                        <td class="text-right font-semibold">${formatCurrency(Number(e.net_value || e.amount))}</td>
                        <td class="text-center">
                          <span class="status status-${e.status}">
                            ${e.status === "paid" ? "Pago" : 
                              e.status === "pending" ? "Pend" : 
                              e.status === "overdue" ? "Venc" : 
                              e.status === "cancelled" ? "Canc" : 
                              e.status === "reversed" ? "Est" : e.status}
                          </span>
                        </td>
                      </tr>
                    `).join("")}
                    <tr class="total-row">
                      <td colspan="3">
                        <span class="total-label">Total do Cheque</span>
                      </td>
                      <td class="text-right">
                        <span class="total-value">${formatCurrency(totalAmount)}</span>
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <!-- Signature -->
              <div class="signature-section">
                <div class="signature-box">
                  <div class="signature-line">
                    <div class="signature-label">Emitente</div>
                  </div>
                </div>
                <div class="signature-box">
                  <div class="signature-line">
                    <div class="signature-label">Beneficiário</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Footer -->
            <div class="footer">
              <div class="footer-left">
                <div class="footer-icon">
                  <span>${(clinic?.name || "E").charAt(0)}</span>
                </div>
                <div class="footer-text">
                  <strong>${clinic?.name || "Entidade Sindical"}</strong>
                  ${clinic?.phone ? clinic.phone : ""} ${clinic?.email ? `• ${clinic.email}` : ""}
                </div>
              </div>
              <div class="footer-right">
                Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}<br/>
                <strong>Cópia de Cheque #${searchedCheckNumber}</strong>
              </div>
            </div>
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
