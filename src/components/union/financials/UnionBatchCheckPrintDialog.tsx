import { useState, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDateBR } from "@/lib/date";
import {
  Printer,
  Search,
  FileCheck,
  Loader2,
  Filter,
} from "lucide-react";

interface UnionBatchCheckPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

export function UnionBatchCheckPrintDialog({
  open,
  onOpenChange,
  clinicId,
}: UnionBatchCheckPrintDialogProps) {
  // Filters
  const [checkFrom, setCheckFrom] = useState("");
  const [checkTo, setCheckTo] = useState("");
  const [dueDateFrom, setDueDateFrom] = useState("");
  const [dueDateTo, setDueDateTo] = useState("");
  const [paidDateFrom, setPaidDateFrom] = useState("");
  const [paidDateTo, setPaidDateTo] = useState("");
  const [searched, setSearched] = useState(false);
  const [selectedChecks, setSelectedChecks] = useState<string[]>([]);

  // Fetch all check expenses
  const { data: allExpenses, isLoading } = useQuery({
    queryKey: ["union-batch-check-expenses", clinicId, searched],
    queryFn: async () => {
      let query = supabase
        .from("union_financial_transactions")
        .select(`
          *,
          category:union_financial_categories(id, name),
          supplier:union_suppliers(id, name),
          cash_register:union_cash_registers(id, name)
        `)
        .eq("clinic_id", clinicId)
        .eq("type", "expense")
        .not("check_number", "is", null)
        .neq("check_number", "")
        .order("paid_date", { ascending: false, nullsFirst: false });

      if (dueDateFrom) query = query.gte("due_date", dueDateFrom);
      if (dueDateTo) query = query.lte("due_date", dueDateTo);
      if (paidDateFrom) query = query.gte("paid_date", paidDateFrom);
      if (paidDateTo) query = query.lte("paid_date", paidDateTo);

      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clinicId && searched,
  });

  // Apply check number range filter client-side (numeric comparison)
  // OFX: datas de compensação vindas do extrato bancário importado
  const { data: ofxRows } = useQuery({
    queryKey: ["union-batch-check-ofx", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_bank_statement_transactions")
        .select(
          "transaction_date, check_number, matched_transaction_id, generated_transaction_id"
        )
        .eq("clinic_id", clinicId)
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clinicId,
  });

  const normCheck = (v?: string | null) => {
    const digits = String(v ?? "").replace(/\D/g, "");
    return digits ? String(parseInt(digits, 10)) : "";
  };

  const ofxMaps = useMemo(() => {
    const byTx = new Map<string, string>();
    const byCheck = new Map<string, string>();
    for (const row of ofxRows || []) {
      const date = (row.transaction_date || "").slice(0, 10);
      if (!date) continue;
      for (const id of [row.matched_transaction_id, row.generated_transaction_id]) {
        if (id && !byTx.has(id)) byTx.set(id, date);
      }
      const key = normCheck(row.check_number);
      // mantém a compensação mais recente por cheque
      if (key && (!byCheck.has(key) || date > byCheck.get(key)!)) byCheck.set(key, date);
    }
    return { byTx, byCheck };
  }, [ofxRows]);

  /** Data de compensação conciliada: OFX > pagamento > vencimento */
  const compensationDate = (e: any): { date: string; source: "ofx" | "paid" | "due" | "" } => {
    const ofx =
      ofxMaps.byTx.get(e.id) || ofxMaps.byCheck.get(normCheck(e.check_number));
    if (ofx) return { date: ofx, source: "ofx" };
    if (e.paid_date) return { date: String(e.paid_date).slice(0, 10), source: "paid" };
    if (e.due_date) return { date: String(e.due_date).slice(0, 10), source: "due" };
    return { date: "", source: "" };
  };

  const filteredExpenses = useMemo(() => {
    if (!allExpenses) return [];
    let result = allExpenses;

    if (checkFrom) {
      const from = parseInt(checkFrom, 10);
      if (!isNaN(from)) {
        result = result.filter((e) => {
          const num = parseInt(e.check_number || "", 10);
          return !isNaN(num) && num >= from;
        });
      }
    }
    if (checkTo) {
      const to = parseInt(checkTo, 10);
      if (!isNaN(to)) {
        result = result.filter((e) => {
          const num = parseInt(e.check_number || "", 10);
          return !isNaN(num) && num <= to;
        });
      }
    }

    return result;
  }, [allExpenses, checkFrom, checkTo]);

  // Group by check number
  const groupedByCheck = useMemo(() => {
    const map = new Map<string, typeof filteredExpenses>();
    for (const e of filteredExpenses) {
      const key = e.check_number || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    // Ordena pelos cheques com data de compensação (pagamento) mais recente primeiro
    const compDate = (items: typeof filteredExpenses) =>
      items.reduce((max, e) => {
        const d = compensationDate(e).date;
        return d > max ? d : max;
      }, "");

    return Array.from(map.entries()).sort((a, b) => {
      const da = compDate(a[1]);
      const db = compDate(b[1]);
      if (da !== db) {
        if (!da) return 1;
        if (!db) return -1;
        return db.localeCompare(da); // decrescente
      }
      const na = parseInt(a[0], 10);
      const nb = parseInt(b[0], 10);
      if (isNaN(na) && isNaN(nb)) return b[0].localeCompare(a[0]);
      if (isNaN(na)) return 1;
      if (isNaN(nb)) return -1;
      return nb - na;
    });
  }, [filteredExpenses, ofxMaps]);

  const toggleCheck = (checkNum: string) => {
    setSelectedChecks((prev) =>
      prev.includes(checkNum)
        ? prev.filter((c) => c !== checkNum)
        : [...prev, checkNum]
    );
  };

  const toggleAll = () => {
    if (selectedChecks.length === groupedByCheck.length) {
      setSelectedChecks([]);
    } else {
      setSelectedChecks(groupedByCheck.map(([key]) => key));
    }
  };

  const handleSearch = () => {
    setSearched(false);
    setSelectedChecks([]);
    // Trigger refetch
    setTimeout(() => setSearched(true), 0);
  };

  const handleClose = () => {
    setCheckFrom("");
    setCheckTo("");
    setDueDateFrom("");
    setDueDateTo("");
    setPaidDateFrom("");
    setPaidDateTo("");
    setSearched(false);
    setSelectedChecks([]);
    onOpenChange(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const escapeHtml = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // Fetch clinic data for print
  const { data: clinic } = useQuery({
    queryKey: ["clinic-for-batch-print", clinicId],
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

  const handleBatchPrint = () => {
    if (selectedChecks.length === 0) {
      toast.error("Selecione ao menos um cheque para imprimir");
      return;
    }

    const selectedGroups = groupedByCheck.filter(([key]) =>
      selectedChecks.includes(key)
    );

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Não foi possível abrir a janela de impressão");
      return;
    }

    const logoHtml = clinic?.logo_url
      ? `<img src="${clinic.logo_url}" alt="Logo" style="max-height: 40px; max-width: 100px; object-fit: contain;" />`
      : `<div style="width: 40px; height: 40px; background: #1e3a5f; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
           <span style="color: white; font-size: 18px; font-weight: bold;">${(clinic?.name || "E").charAt(0)}</span>
         </div>`;

    const checksHtml = selectedGroups
      .map(([checkNum, expenses]) => {
        const total = expenses.reduce(
          (sum, e) => sum + Number(e.net_value || e.amount),
          0
        );
        const paidCount = expenses.filter((e) => e.status === "paid").length;
        const pendingCount = expenses.filter(
          (e) => e.status !== "paid" && e.status !== "cancelled"
        ).length;
        const paidAmount = expenses
          .filter((e) => e.status === "paid")
          .reduce((sum, e) => sum + Number(e.net_value || e.amount), 0);

        // Ordena pela data de compensação conciliada com o OFX (decrescente)
        const sorted = [...expenses].sort((a, b) => {
          const da = compensationDate(a).date;
          const db = compensationDate(b).date;
          if (!da) return 1;
          if (!db) return -1;
          return db.localeCompare(da);
        });

        return `
          <div class="check-page">
            <div class="header">
              <div class="header-logo">${logoHtml}</div>
              <div class="header-info">
                <h1>${clinic?.name || "Entidade Sindical"}</h1>
                ${clinic?.cnpj ? `<p>CNPJ: ${clinic.cnpj}${clinic?.address ? ` • ${clinic.address}` : ""}</p>` : ""}
              </div>
              <div class="header-badge">
                <span>Cheque Nº</span>
                <strong>${checkNum}</strong>
              </div>
            </div>
            
            <div class="content">
              <div class="cards-grid">
                <div class="card card-slate">
                  <div class="card-label">Portador</div>
                  <div class="card-value" style="font-size: 11px;">${sorted[0]?.cash_register?.name || "-"}</div>
                </div>
                <div class="card card-blue">
                  <div class="card-label">Despesas</div>
                  <div class="card-value">${sorted.length}</div>
                </div>
                <div class="card card-emerald">
                  <div class="card-label">Pagos</div>
                  <div class="card-value">${paidCount}</div>
                  <div class="card-sub">${formatCurrency(paidAmount)}</div>
                </div>
                <div class="card card-amber">
                  <div class="card-label">Pendentes</div>
                  <div class="card-value">${pendingCount}</div>
                </div>
              </div>
              
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style="width: 30%;">Descrição</th>
                      <th style="width: 20%;">Fornecedor</th>
                      <th style="width: 12%;">Vencimento</th>
                      <th style="width: 12%;">Compensação</th>
                      <th style="width: 14%; text-align: right;">Valor</th>
                      <th style="width: 12%;">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sorted
                      .map(
                        (e) => `
                      <tr>
                        <td class="font-medium">${escapeHtml(e.description)}</td>
                        <td>${escapeHtml(e.supplier?.name || "-")}</td>
                        <td>${formatDateBR(e.due_date) || "-"}</td>
                        <td>${(() => {
                          const c = compensationDate(e);
                          if (!c.date) return "-";
                          return `${formatDateBR(c.date)}${c.source === "ofx" ? " <span style=\"font-size:8px;color:#0f766e;\">OFX</span>" : ""}`;
                        })()}</td>
                        <td class="text-right font-semibold">${formatCurrency(Number(e.net_value || e.amount))}</td>
                        <td class="text-center">
                          <span class="status status-${e.status}">
                            ${e.status === "paid" ? "Pago" : e.status === "pending" ? "Pend" : e.status === "overdue" ? "Venc" : e.status === "cancelled" ? "Canc" : e.status === "reversed" ? "Est" : e.status}
                          </span>
                        </td>
                      </tr>
                    `
                      )
                      .join("")}
                    <tr class="total-row">
                      <td colspan="4"><span class="total-label">Total do Cheque</span></td>
                      <td class="text-right"><span class="total-value">${formatCurrency(total)}</span></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div class="signature-section">
                <div class="signature-box">
                  <div class="signature-line"><div class="signature-label">Emitente</div></div>
                </div>
                <div class="signature-box">
                  <div class="signature-line"><div class="signature-label">Beneficiário</div></div>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-left">
                <div class="footer-icon"><span>${(clinic?.name || "E").charAt(0)}</span></div>
                <div class="footer-text">
                  <strong>${clinic?.name || "Entidade Sindical"}</strong>
                  ${clinic?.phone ? clinic.phone : ""} ${clinic?.email ? `• ${clinic.email}` : ""}
                </div>
              </div>
              <div class="footer-right">
                Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}<br/>
                <strong>Cópia de Cheque #${checkNum}</strong>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impressão em Lote - Cheques</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { margin: 8mm 10mm; size: A4; }
              .check-page { page-break-after: always; }
              .check-page:last-child { page-break-after: auto; }
            }
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              background: #f8fafc;
              color: #1e293b;
              line-height: 1.3;
              font-size: 11px;
            }
            
            .check-page {
              max-width: 100%;
              background: white;
              margin-bottom: 20px;
            }
            
            .header {
              background: #1e3a5f;
              color: white;
              padding: 12px 16px;
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .header-logo { flex-shrink: 0; }
            .header-logo img { max-height: 40px !important; max-width: 100px !important; }
            .header-info { flex: 1; }
            .header-info h1 { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
            .header-info p { font-size: 10px; opacity: 0.85; }
            .header-badge {
              background: rgba(255,255,255,0.15);
              border: 1px solid rgba(255,255,255,0.2);
              padding: 6px 12px;
              border-radius: 6px;
              text-align: center;
            }
            .header-badge span { display: block; font-size: 9px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.05em; }
            .header-badge strong { font-size: 16px; font-weight: 700; }
            
            .content { padding: 12px 16px; }
            
            .cards-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
            .card { border-radius: 6px; padding: 8px 10px; position: relative; overflow: hidden; }
            .card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
            .card-slate { background: #f8fafc; border: 1px solid #e2e8f0; }
            .card-slate::before { background: #64748b; }
            .card-slate .card-value { color: #334155; }
            .card-emerald { background: #ecfdf5; border: 1px solid #a7f3d0; }
            .card-emerald::before { background: #10b981; }
            .card-emerald .card-value { color: #047857; }
            .card-amber { background: #fffbeb; border: 1px solid #fde68a; }
            .card-amber::before { background: #f59e0b; }
            .card-amber .card-value { color: #b45309; }
            .card-blue { background: #eff6ff; border: 1px solid #bfdbfe; }
            .card-blue::before { background: #3b82f6; }
            .card-blue .card-value { color: #1d4ed8; }
            .card-label { font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 2px; }
            .card-value { font-size: 14px; font-weight: 700; }
            .card-sub { font-size: 9px; color: #94a3b8; margin-top: 1px; }
            
            .table-container { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th {
              background: #1e3a5f;
              color: white;
              font-size: 9px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.03em;
              padding: 6px 8px;
              text-align: left;
            }
            th:last-child { text-align: center; }
            td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-size: 10px; line-height: 1.25; white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background: #fafbfc; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-medium { font-weight: 500; }
            .font-semibold { font-weight: 600; }
            
            .status { display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 10px; font-size: 8px; font-weight: 600; text-transform: uppercase; }
            .status-paid { background: #d1fae5; color: #047857; }
            .status-pending { background: #fef3c7; color: #b45309; }
            .status-overdue { background: #fee2e2; color: #b91c1c; }
            .status-cancelled { background: #f1f5f9; color: #64748b; }
            .status-reversed { background: #ede9fe; color: #7c3aed; }
            
            .total-row { background: #eff6ff !important; }
            .total-row td { padding: 8px; border-top: 2px solid #3b82f6; border-bottom: none !important; }
            .total-label { font-size: 10px; font-weight: 700; color: #1e3a5f; text-transform: uppercase; }
            .total-value { font-size: 13px; font-weight: 700; color: #1e3a5f; }
            
            .signature-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 20px 0; padding: 0 20px; }
            .signature-box { text-align: center; }
            .signature-line { border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 30px; }
            .signature-label { font-size: 9px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
            
            .footer {
              background: #f8fafc;
              border-top: 1px solid #e2e8f0;
              padding: 8px 16px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .footer-left { display: flex; align-items: center; gap: 6px; }
            .footer-icon {
              width: 20px; height: 20px;
              background: #1e3a5f;
              border-radius: 4px;
              display: flex; align-items: center; justify-content: center;
            }
            .footer-icon span { color: white; font-size: 10px; font-weight: 700; }
            .footer-text { font-size: 9px; color: #64748b; }
            .footer-text strong { display: block; color: #334155; font-size: 10px; }
            .footer-right { text-align: right; font-size: 9px; color: #94a3b8; }
          </style>
        </head>
        <body>
          ${checksHtml}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Impressão em Lote de Cheques
          </DialogTitle>
          <DialogDescription>
            Filtre os cheques por número, data de vencimento ou data de pagamento e imprima as cópias em lote.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable middle area */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
          {/* Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Filtros de Pesquisa
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cheque De</Label>
                <Input
                  placeholder="Ex: 1200"
                  value={checkFrom}
                  onChange={(e) => setCheckFrom(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cheque Até</Label>
                <Input
                  placeholder="Ex: 1300"
                  value={checkTo}
                  onChange={(e) => setCheckTo(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento De</Label>
                <Input
                  type="date"
                  value={dueDateFrom}
                  onChange={(e) => setDueDateFrom(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento Até</Label>
                <Input
                  type="date"
                  value={dueDateTo}
                  onChange={(e) => setDueDateTo(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pagamento De</Label>
                <Input
                  type="date"
                  value={paidDateFrom}
                  onChange={(e) => setPaidDateFrom(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pagamento Até</Label>
                <Input
                  type="date"
                  value={paidDateTo}
                  onChange={(e) => setPaidDateTo(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <Button onClick={handleSearch} size="sm" className="w-full sm:w-auto">
              <Search className="h-4 w-4 mr-1.5" />
              Buscar Cheques
            </Button>
          </div>

          <Separator />

          {/* Results */}
          {searched && (
            <>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : groupedByCheck.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>Nenhum cheque encontrado com os filtros informados</p>
                </div>
              ) : (
                <>
                  {/* Select all + count */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={
                          groupedByCheck.length > 0 &&
                          selectedChecks.length === groupedByCheck.length
                        }
                        onCheckedChange={toggleAll}
                      />
                      <span className="text-muted-foreground">Selecionar todos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {groupedByCheck.length} cheque(s)
                      </Badge>
                      <Badge variant="outline">
                        {selectedChecks.length} selecionado(s)
                      </Badge>
                    </div>
                  </div>

                  {/* Check list */}
                  <div className="border rounded-md">
                    <div className="divide-y">
                      {groupedByCheck.map(([checkNum, expenses]) => {
                        const total = expenses.reduce(
                          (sum, e) => sum + Number(e.net_value || e.amount),
                          0
                        );
                        const paidCount = expenses.filter(
                          (e) => e.status === "paid"
                        ).length;
                        const comps = expenses
                          .map((e) => compensationDate(e))
                          .filter((c) => c.date && c.source !== "due")
                          .sort((a, b) => b.date.localeCompare(a.date));
                        const compDateInfo = comps[0];
                        const lastDueDate = expenses
                          .sort((a, b) => (b.due_date || "").localeCompare(a.due_date || ""))[0]
                          ?.due_date;

                        return (
                          <label
                            key={checkNum}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={selectedChecks.includes(checkNum)}
                              onCheckedChange={() => toggleCheck(checkNum)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">
                                  Cheque #{checkNum}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4"
                                >
                                  {expenses.length} desp.
                                </Badge>
                                {paidCount === expenses.length ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0 h-4 border-0">
                                    Liquidado
                                  </Badge>
                                ) : paidCount > 0 ? (
                                  <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0 h-4 border-0">
                                    Parcial
                                  </Badge>
                                ) : (
                                  <Badge className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0 h-4 border-0">
                                    Pendente
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                {expenses[0]?.cash_register?.name && (
                                  <span>{expenses[0].cash_register.name}</span>
                                )}
                                {lastDueDate && (
                                  <>
                                    <span>•</span>
                                    <span>Venc: {formatDateBR(lastDueDate)}</span>
                                  </>
                                )}
                                {compDateInfo && (
                                  <>
                                    <span>•</span>
                                    <span className="text-emerald-600">
                                      Compensação: {formatDateBR(compDateInfo.date)}
                                      {compDateInfo.source === "ofx" ? " (OFX)" : ""}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-foreground">
                                {formatCurrency(total)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {paidCount}/{expenses.length} pago(s)
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {!searched && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                Preencha os filtros e clique em "Buscar Cheques"
              </p>
            </div>
          )}
        </div>

        {/* Fixed footer with print button - always visible */}
        {searched && groupedByCheck.length > 0 && (
          <div className="flex-shrink-0 flex justify-between items-center pt-3 border-t mt-2">
            <p className="text-xs text-muted-foreground">
              {filteredExpenses.length} despesa(s) em{" "}
              {groupedByCheck.length} cheque(s)
            </p>
            <Button
              onClick={handleBatchPrint}
              disabled={selectedChecks.length === 0}
            >
              <Printer className="h-4 w-4 mr-1.5" />
              Imprimir {selectedChecks.length} Cheque(s)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
