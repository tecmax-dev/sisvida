import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnionEntity } from "@/hooks/useUnionEntity";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Upload,
  FileDown,
  History,
  Loader2,
  FileSpreadsheet,
  DollarSign,
  Calendar,
  CreditCard,
  Building,
  Trash2,
  AlertTriangle,
  Filter,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface PaymentHistoryItem {
  id: string;
  entity_id: string;
  supplier_id: string | null;
  supplier_name: string;
  description: string | null;
  chart_of_accounts: string | null;
  operational_unit: string | null;
  bank_account: string | null;
  due_date: string | null;
  status: string | null;
  gross_value: number;
  net_value: number;
  paid_at: string | null;
  check_number: string | null;
  imported_at: string | null;
  created_at: string | null;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  
  // Try DD/MM/YYYY format first
  const brFormat = parse(dateStr, "dd/MM/yyyy", new Date());
  if (isValid(brFormat)) return brFormat;
  
  // Try ISO format
  try {
    const isoDate = parseISO(dateStr);
    if (isValid(isoDate)) return isoDate;
  } catch {
    // ignore
  }
  
  return null;
};

const parseCurrency = (value: string): number => {
  if (!value) return 0;
  const cleanValue = value
    .replace(/R\$\s?/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  const parsed = parseFloat(cleanValue);
  return isNaN(parsed) ? 0 : parsed;
};

export default function UnionPaymentHistoryPage() {
  const { currentClinic } = useAuth();
  const { entity, loading: entityLoading } = useUnionEntity();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // States
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [checkFilter, setCheckFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const entityId = entity?.id;

  // Fetch payment history
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["union-payment-history", entityId],
    queryFn: async () => {
      if (!entityId) return [];

      const { data, error } = await supabase
        .from("union_payment_history")
        .select("*")
        .eq("entity_id", entityId)
        .order("paid_at", { ascending: false });

      if (error) throw error;
      return data as PaymentHistoryItem[];
    },
    enabled: !!entityId,
  });

  // Get unique suppliers for filter
  const suppliers = useMemo(() => {
    const unique = new Set(payments.map(p => p.supplier_name).filter(Boolean));
    return Array.from(unique).sort();
  }, [payments]);

  // Filter payments
  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      // Text search
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch = 
          payment.supplier_name?.toLowerCase().includes(searchLower) ||
          payment.description?.toLowerCase().includes(searchLower) ||
          payment.check_number?.toLowerCase().includes(searchLower) ||
          payment.chart_of_accounts?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Supplier filter
      if (supplierFilter && supplierFilter !== "all" && payment.supplier_name !== supplierFilter) {
        return false;
      }

      // Check filter
      if (checkFilter && !payment.check_number?.includes(checkFilter)) {
        return false;
      }

      // Date filter
      if (startDate || endDate) {
        const paymentDate = payment.paid_at ? parseISO(payment.paid_at) : null;
        if (!paymentDate) return false;
        
        const start = startDate ? startOfDay(parseISO(startDate)) : new Date(0);
        const end = endDate ? endOfDay(parseISO(endDate)) : new Date();
        
        if (!isWithinInterval(paymentDate, { start, end })) return false;
      }

      // Value filter
      const value = payment.gross_value || 0;
      if (minValue && value < parseFloat(minValue)) return false;
      if (maxValue && value > parseFloat(maxValue)) return false;

      return true;
    });
  }, [payments, search, supplierFilter, checkFilter, startDate, endDate, minValue, maxValue]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredPayments.reduce(
      (acc, p) => ({
        gross: acc.gross + (p.gross_value || 0),
        net: acc.net + (p.net_value || 0),
        count: acc.count + 1,
      }),
      { gross: 0, net: 0, count: 0 }
    );
  }, [filteredPayments]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("union_payment_history")
        .delete()
        .in("id", ids);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-payment-history"] });
      setSelectedIds([]);
      setDeleteDialogOpen(false);
      toast({
        title: "Registros excluídos",
        description: `${selectedIds.length} registro(s) excluído(s) com sucesso.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle file import
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !entityId) return;

    const clinicId = currentClinic?.id;

    setImporting(true);
    setImportProgress(0);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, { 
        header: 1,
        raw: false,
      });

      // Find header row (skip title rows)
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i];
        if (row && Array.isArray(row) && row.some(cell => 
          String(cell || "").toLowerCase()?.includes("fornecedor") || 
          String(cell || "").toLowerCase()?.includes("descrição")
        )) {
          headerRowIndex = i;
          break;
        }
      }

      const headers = rows[headerRowIndex] || [];
      const dataRows = rows.slice(headerRowIndex + 1).filter(row => 
        row && Array.isArray(row) && row.length > 3 && row.some(cell => String(cell || "").trim())
      );

      // Map column indices
      const colMap: Record<string, number> = {};
      headers.forEach((h, i) => {
        const header = String(h || "").toLowerCase().trim();
        if (header.includes("fornecedor")) colMap.supplier_name = i;
        if (header.includes("descrição") || header.includes("descricao")) colMap.description = i;
        if (header.includes("plano de contas")) colMap.chart_of_accounts = i;
        if (header.includes("unidade")) colMap.operational_unit = i;
        if (header.includes("portador")) colMap.bank_account = i;
        if (header.includes("vencimento")) colMap.due_date = i;
        if (header.includes("situação") || header.includes("situacao")) colMap.status = i;
        if (header.includes("valor bruto")) colMap.gross_value = i;
        if (header.includes("valor líquido") || header.includes("valor liquido")) colMap.net_value = i;
        if (header.includes("pago em")) colMap.paid_at = i;
        if (header.includes("cheque")) colMap.check_number = i;
      });

      // Get existing suppliers from union_suppliers
      const { data: existingSuppliers } = clinicId ? await supabase
        .from("union_suppliers")
        .select("id, name")
        .eq("clinic_id", clinicId) : { data: [] };

      const supplierMap = new Map<string, string>(existingSuppliers?.map(s => [s.name.toLowerCase(), s.id] as [string, string]) || []);
      const newSuppliers = new Set<string>();
      const toInsert: Array<{
        entity_id: string;
        supplier_id: string | null;
        supplier_name: string;
        description: string | null;
        chart_of_accounts: string | null;
        operational_unit: string | null;
        bank_account: string | null;
        due_date: string | null;
        status: string;
        gross_value: number;
        net_value: number;
        paid_at: string | null;
        check_number: string | null;
      }> = [];

      // Process rows
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const supplierName = String(row[colMap.supplier_name] || "").trim();
        
        if (!supplierName) continue;

        // Track new suppliers
        if (!supplierMap.has(supplierName.toLowerCase())) {
          newSuppliers.add(supplierName);
        }

        const dueDateStr = String(row[colMap.due_date] || "");
        const paidAtStr = String(row[colMap.paid_at] || "");
        
        const dueDate = dueDateStr ? parseDate(dueDateStr) : null;
        const paidAt = paidAtStr ? parseDate(paidAtStr) : null;

        toInsert.push({
          entity_id: entityId,
          supplier_id: supplierMap.get(supplierName.toLowerCase()) ?? null,
          supplier_name: supplierName,
          description: String(row[colMap.description] || "").trim() || null,
          chart_of_accounts: String(row[colMap.chart_of_accounts] || "").trim() || null,
          operational_unit: String(row[colMap.operational_unit] || "").trim() || null,
          bank_account: String(row[colMap.bank_account] || "").trim() || null,
          due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
          status: String(row[colMap.status] || "paid").trim().toLowerCase(),
          gross_value: parseCurrency(String(row[colMap.gross_value] || "")),
          net_value: parseCurrency(String(row[colMap.net_value] || "")),
          paid_at: paidAt ? format(paidAt, "yyyy-MM-dd") : null,
          check_number: String(row[colMap.check_number] || "").trim() || null,
        });

        setImportProgress(Math.round((i / dataRows.length) * 50));
      }

      // Create new suppliers (only if we have a clinic_id)
      if (newSuppliers.size > 0 && clinicId) {
        const supplierInserts = Array.from(newSuppliers).map(name => ({
          clinic_id: clinicId,
          name,
          is_active: true,
        }));

        const { data: createdSuppliers, error: supplierError } = await supabase
          .from("union_suppliers")
          .insert(supplierInserts)
          .select("id, name");

        if (supplierError) {
          console.error("Error creating suppliers:", supplierError);
        } else if (createdSuppliers) {
          createdSuppliers.forEach(s => {
            supplierMap.set(s.name.toLowerCase(), s.id);
          });
          
          // Update supplier_id in toInsert
          toInsert.forEach(item => {
            if (!item.supplier_id) {
              item.supplier_id = supplierMap.get(item.supplier_name.toLowerCase()) ?? null;
            }
          });
        }
      }

      // Insert in batches
      const batchSize = 100;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const { error } = await supabase
          .from("union_payment_history")
          .insert(batch);

        if (error) {
          console.error("Batch insert error:", error);
        }

        setImportProgress(50 + Math.round(((i + batch.length) / toInsert.length) * 50));
      }

      await queryClient.invalidateQueries({ queryKey: ["union-payment-history"] });
      await queryClient.invalidateQueries({ queryKey: ["union-suppliers"] });

      toast({
        title: "Importação concluída",
        description: `${toInsert.length} registros importados. ${newSuppliers.size} fornecedores criados.`,
      });

      setImportDialogOpen(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast({
        title: "Erro na importação",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      setImportProgress(0);
      e.target.value = "";
    }
  };

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    
    // Header
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, 297, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("Histórico de Pagamentos a Fornecedores", 14, 18);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 220, 18);

    // Summary cards
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 36, 85, 18, "F");
    doc.rect(106, 36, 85, 18, "F");
    doc.rect(198, 36, 85, 18, "F");
    
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    doc.text("Total de Registros", 18, 44);
    doc.text("Valor Bruto Total", 110, 44);
    doc.text("Valor Líquido Total", 202, 44);
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(String(filteredPayments.length), 18, 51);
    doc.text(formatCurrency(totals.gross), 110, 51);
    doc.text(formatCurrency(totals.net), 202, 51);

    // Table
    autoTable(doc, {
      startY: 60,
      head: [[
        "Fornecedor",
        "Descrição",
        "Plano de Contas",
        "Portador",
        "Vencimento",
        "Pago em",
        "Cheque",
        "Valor Bruto",
        "Valor Líquido",
      ]],
      body: filteredPayments.map(p => [
        p.supplier_name?.substring(0, 25) || "-",
        p.description?.substring(0, 20) || "-",
        p.chart_of_accounts?.substring(0, 15) || "-",
        p.bank_account?.substring(0, 12) || "-",
        p.due_date ? format(parseISO(p.due_date), "dd/MM/yy") : "-",
        p.paid_at ? format(parseISO(p.paid_at), "dd/MM/yy") : "-",
        p.check_number || "-",
        formatCurrency(p.gross_value),
        formatCurrency(p.net_value),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138] },
    });

    doc.save(`historico-pagamentos-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredPayments.map(p => ({
      "Fornecedor": p.supplier_name,
      "Descrição": p.description,
      "Plano de Contas": p.chart_of_accounts,
      "Unidade Operacional": p.operational_unit,
      "Portador": p.bank_account,
      "Vencimento": p.due_date ? format(parseISO(p.due_date), "dd/MM/yyyy") : "",
      "Situação": p.status,
      "Valor Bruto": p.gross_value,
      "Valor Líquido": p.net_value,
      "Pago em": p.paid_at ? format(parseISO(p.paid_at), "dd/MM/yyyy") : "",
      "Cheque": p.check_number,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Histórico");
    XLSX.writeFile(wb, `historico-pagamentos-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  // Clear filters
  const clearFilters = () => {
    setSearch("");
    setSupplierFilter("");
    setCheckFilter("");
    setStartDate("");
    setEndDate("");
    setMinValue("");
    setMaxValue("");
  };

  const hasActiveFilters = search || supplierFilter || checkFilter || startDate || endDate || minValue || maxValue;

  if (entityLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!entityId) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <History className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-medium">Entidade não encontrada</h3>
        <p className="text-sm text-muted-foreground">
          Não foi possível identificar a entidade sindical.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Histórico de Pagamentos
          </h1>
          <p className="text-muted-foreground text-sm">
            Consulta de pagamentos retroativos e importados
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar Histórico de Pagamentos</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Selecione um arquivo Excel (.xlsx) com os dados de pagamentos.
                  O sistema irá importar os dados e criar automaticamente os fornecedores
                  que não existirem na base.
                </p>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  {importing ? (
                    <div className="space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="text-sm">Importando... {importProgress}%</p>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${importProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <Label
                        htmlFor="file-upload"
                        className="cursor-pointer text-primary hover:underline"
                      >
                        Clique para selecionar arquivo
                      </Label>
                      <Input
                        id="file-upload"
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleFileImport}
                        disabled={importing}
                      />
                    </>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleExportExcel}>
            <FileDown className="h-4 w-4 mr-2" />
            Excel
          </Button>

          <Button onClick={handleExportPDF}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <History className="h-4 w-4" />
              Registros
            </div>
            <p className="text-xl font-bold">{filteredPayments.length}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              Total Bruto
            </div>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.gross)}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              Total Líquido
            </div>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(totals.net)}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Building className="h-4 w-4" />
              Fornecedores
            </div>
            <p className="text-xl font-bold">{suppliers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger>
                <Building className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nº Cheque"
                value={checkFilter}
                onChange={e => setCheckFilter(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  placeholder="De"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  placeholder="Até"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="Valor mínimo"
                value={minValue}
                onChange={e => setMinValue(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="Valor máximo"
                value={maxValue}
                onChange={e => setMaxValue(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.length} selecionado(s)
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Excluir
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds([])}
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <History className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium">Nenhum registro encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {hasActiveFilters
                  ? "Tente ajustar os filtros"
                  : "Importe dados para começar"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filteredPayments.length && filteredPayments.length > 0}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedIds(filteredPayments.map(p => p.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Portador</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead>Cheque</TableHead>
                    <TableHead className="text-right">Valor Bruto</TableHead>
                    <TableHead className="text-right">Valor Líquido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map(payment => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(payment.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedIds([...selectedIds, payment.id]);
                            } else {
                              setSelectedIds(selectedIds.filter(id => id !== payment.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {payment.supplier_name}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground">
                        {payment.description || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {payment.bank_account || "-"}
                      </TableCell>
                      <TableCell>
                        {payment.due_date 
                          ? format(parseISO(payment.due_date), "dd/MM/yy")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {payment.paid_at 
                          ? format(parseISO(payment.paid_at), "dd/MM/yy")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {payment.check_number ? (
                          <Badge variant="outline">{payment.check_number}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(payment.gross_value)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(payment.net_value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar exclusão
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir {selectedIds.length} registro(s)?
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(selectedIds)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
