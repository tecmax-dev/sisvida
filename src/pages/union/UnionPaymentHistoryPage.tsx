import { useState, useMemo } from "react";
import { RefreshDataButton } from "@/components/common/RefreshDataButton";
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
import { format, isWithinInterval, startOfDay, endOfDay, parse, isValid } from "date-fns";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
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
  ArrowUpDown,
  TrendingUp,
  Wallet,
  CalendarRange,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
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
  source?: "imported" | "transaction";
}

const safeFormatDate = (value?: string | null, pattern = "dd/MM/yy"): string => {
  if (!value) return "-";
  try {
    const d = parseDateOnlyToLocalNoon(value);
    if (!isValid(d)) return typeof value === "string" ? value : "-";
    return format(d, pattern, { locale: ptBR });
  } catch {
    return "-";
  }
};

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
    const isoDate = parseDateOnlyToLocalNoon(dateStr);
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
  const { currentClinic, userRoles } = useAuth();

  const resolvedClinic = useMemo(
    () =>
      (userRoles || []).find((role) => role?.clinic_id === SINDICATO_CLINIC_ID)?.clinic ||
      currentClinic,
    [currentClinic, userRoles]
  );
  const { entity, loading: entityLoading } = useUnionEntity();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // States
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [checkFilter, setCheckFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dueStartDate, setDueStartDate] = useState("");
  const [dueEndDate, setDueEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("paid");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [paidSort, setPaidSort] = useState<"desc" | "asc">("desc");
  const [sortKey, setSortKey] = useState<"paid_at" | "due_date" | "supplier_name" | "gross_value">("paid_at");

  const entityId = entity?.id;
  const clinicId = resolvedClinic?.id;

  // Fetch payment history
  const { data: payments = [], isLoading, error: queryError } = useQuery({
    queryKey: ["union-payment-history", entityId, clinicId],
    queryFn: async () => {
      if (!entityId) return [];

      // As duas fontes podem ultrapassar o limite de 1.000 linhas da API.
      // Paginar com ordenação estável evita históricos parciais e resultados variáveis.
      const pageSize = 1000;
      const fetchImported = async () => {
        const rows: any[] = [];
        for (let from = 0; ; from += pageSize) {
          const result = await supabase
            .from("union_payment_history")
            .select("*")
            .eq("entity_id", entityId)
            .order("paid_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: true })
            .range(from, from + pageSize - 1);
          if (result.error) return { data: rows, error: result.error };
          const page = result.data || [];
          rows.push(...page);
          if (page.length < pageSize) return { data: rows, error: null };
        }
      };

      const fetchTransactions = async () => {
        if (!clinicId) return { data: [] as any[], error: null };
        const rows: any[] = [];
        for (let from = 0; ; from += pageSize) {
          const result = await supabase
            .from("union_financial_transactions")
            .select(
              "id, supplier_id, description, due_date, paid_date, gross_value, net_value, amount, status, check_number, notes, category_id, cash_register_id, payment_method"
            )
            .eq("clinic_id", clinicId)
            .eq("type", "expense")
            .in("status", ["paid", "pending", "overdue", "partial"])
            .not("supplier_id", "is", null)
            .order("paid_date", { ascending: false, nullsFirst: false })
            .order("id", { ascending: true })
            .range(from, from + pageSize - 1);
          if (result.error) return { data: rows, error: result.error };
          const page = result.data || [];
          rows.push(...page);
          if (page.length < pageSize) return { data: rows, error: null };
        }
      };

      const [importedRes, txRes] = await Promise.all([fetchImported(), fetchTransactions()]);

      if (importedRes.error) throw importedRes.error;

      // eslint-disable-next-line no-console
      console.log("[UnionPaymentHistory] fetch", {
        entityId,
        clinicId,
        importedCount: importedRes.data?.length ?? 0,
        txCount: Array.isArray(txRes.data) ? txRes.data.length : 0,
        txError: txRes.error?.message || null,
      });

      const imported: PaymentHistoryItem[] = (importedRes.data || []).map((p: any) => ({
        ...p,
        source: "imported" as const,
      }));

      let transactions: PaymentHistoryItem[] = [];
      if (!txRes.error && Array.isArray(txRes.data)) {
        // Buscar nomes de fornecedores, categorias e caixas em lote
        const supplierIds = Array.from(
          new Set((txRes.data as any[]).map((t) => t.supplier_id).filter(Boolean))
        );
        const categoryIds = Array.from(
          new Set((txRes.data as any[]).map((t) => t.category_id).filter(Boolean))
        );
        const cashIds = Array.from(
          new Set((txRes.data as any[]).map((t) => t.cash_register_id).filter(Boolean))
        );
        const supplierNames = new Map<string, string>();
        const categoryNames = new Map<string, string>();
        const cashNames = new Map<string, string>();
        if (supplierIds.length > 0) {
          const { data: sups } = await supabase
            .from("union_suppliers")
            .select("id, name")
            .in("id", supplierIds);
          (sups || []).forEach((s: any) => supplierNames.set(s.id, s.name));
        }
        if (categoryIds.length > 0) {
          const { data: cats } = await supabase
            .from("union_financial_categories")
            .select("id, name")
            .in("id", categoryIds);
          (cats || []).forEach((c: any) => categoryNames.set(c.id, c.name));
        }
        if (cashIds.length > 0) {
          const { data: cxs } = await supabase
            .from("union_cash_registers")
            .select("id, name")
            .in("id", cashIds);
          (cxs || []).forEach((c: any) => cashNames.set(c.id, c.name));
        }

        transactions = (txRes.data as any[]).map((t) => {
          const amount = Number(t.amount ?? 0);
          const grossRaw = Number(t.gross_value ?? 0);
          const netRaw = Number(t.net_value ?? 0);
          const gross = grossRaw > 0 ? grossRaw : amount;
          const net = netRaw > 0 ? netRaw : gross;
          return {
            id: `tx:${t.id}`,
            entity_id: entityId,
            supplier_id: t.supplier_id,
            supplier_name: supplierNames.get(t.supplier_id) || "-",
            description: t.description || t.notes || null,
            chart_of_accounts: categoryNames.get(t.category_id) || null,
            operational_unit: null,
            bank_account:
              cashNames.get(t.cash_register_id) ||
              (typeof t.notes === "string"
                ? t.notes.match(/(?:Portador|Banco|Conta)\s*[:\-]\s*([^|\n]+)/i)?.[1]?.trim() || null
                : null) ||
              (typeof t.payment_method === "string" && t.payment_method.trim()
                ? t.payment_method.trim()
                : null),
            due_date: t.due_date || null,
            status: t.status === "paid" ? "pago" : t.status === "overdue" ? "vencido" : "a pagar",
            gross_value: gross,
            net_value: net,
            paid_at: t.status === "paid" ? t.paid_date || null : null,
            check_number: t.check_number || null,
            imported_at: null,
            created_at: null,
            source: "transaction" as const,
          };
        });
      } else if (txRes.error) {
        console.warn("[UnionPaymentHistory] Falha ao carregar transações:", txRes.error);
      }

      // Merge + ordenar por data de pagamento desc
      const merged = [...imported, ...transactions].sort((a, b) => {
        const da = a.paid_at ? new Date(a.paid_at).getTime() : 0;
        const db = b.paid_at ? new Date(b.paid_at).getTime() : 0;
        return db - da;
      });

      return merged;
    },
    enabled: !!entityId,
  });

  // Get unique suppliers for filter
  const suppliers = useMemo(() => {
    const unique = new Set(payments.map(p => p.supplier_name).filter(Boolean));
    return Array.from(unique).sort();
  }, [payments]);

  // Filter payments
  const filteredBase = useMemo(() => {
    return payments.filter(payment => {
      // Situação (pago / a pagar)
      const isPaid = !!payment.paid_at || (payment.status || "").toLowerCase().startsWith("pag");
      if (statusFilter === "paid" && !isPaid) return false;
      if (statusFilter === "unpaid" && isPaid) return false;

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

      // Período de pagamento (individual)
      if (startDate || endDate) {
        const paymentDate = payment.paid_at ? parseDateOnlyToLocalNoon(payment.paid_at) : null;
        if (!paymentDate || isNaN(paymentDate.getTime())) return false;
        
        const startParsed = startDate ? parseDateOnlyToLocalNoon(startDate) : null;
        const endParsed = endDate ? parseDateOnlyToLocalNoon(endDate) : null;
        const start = startParsed && isValid(startParsed) ? startOfDay(startParsed) : new Date(0);
        const end = endParsed && isValid(endParsed) ? endOfDay(endParsed) : new Date();

        if (!isWithinInterval(paymentDate, { start, end })) return false;
      }

      // Período de vencimento (individual)
      if (dueStartDate || dueEndDate) {
        const dueDate = payment.due_date ? parseDateOnlyToLocalNoon(payment.due_date) : null;
        if (!dueDate || isNaN(dueDate.getTime())) return false;

        const s = dueStartDate ? parseDateOnlyToLocalNoon(dueStartDate) : null;
        const e = dueEndDate ? parseDateOnlyToLocalNoon(dueEndDate) : null;
        const start = s && isValid(s) ? startOfDay(s) : new Date(0);
        const end = e && isValid(e) ? endOfDay(e) : endOfDay(new Date(2999, 11, 31));

        if (!isWithinInterval(dueDate, { start, end })) return false;
      }

      // Value filter
      const value = payment.gross_value || 0;
      if (minValue && value < parseFloat(minValue)) return false;
      if (maxValue && value > parseFloat(maxValue)) return false;

      return true;
    });
  }, [payments, search, supplierFilter, checkFilter, startDate, endDate, dueStartDate, dueEndDate, minValue, maxValue, statusFilter]);

  // Ordenação (aplica-se à tela, PDF e Excel)
  const filteredPayments = useMemo(() => {
    const withDate = (v: string | null | undefined) => {
      if (!v) return null;
      const d = parseDateOnlyToLocalNoon(v);
      return d && isValid(d) ? d.getTime() : null;
    };
    const dir = paidSort === "asc" ? 1 : -1;
    return [...filteredBase].sort((a, b) => {
      if (sortKey === "supplier_name") {
        return dir * (a.supplier_name || "").localeCompare(b.supplier_name || "", "pt-BR");
      }
      if (sortKey === "gross_value") {
        return dir * ((a.gross_value || 0) - (b.gross_value || 0));
      }
      const ta = withDate(sortKey === "due_date" ? a.due_date : a.paid_at);
      const tb = withDate(sortKey === "due_date" ? b.due_date : b.paid_at);
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return dir * (ta - tb);
    });
  }, [filteredBase, paidSort, sortKey]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setPaidSort(paidSort === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setPaidSort(key === "supplier_name" ? "asc" : "desc");
    }
  };

  // Atalhos de período
  const applyPeriod = (period: "this_month" | "last_month" | "last_90" | "this_year" | "all") => {
    const iso = (d: Date) => format(d, "yyyy-MM-dd");
    const now = new Date();
    if (period === "all") {
      setStartDate("");
      setEndDate("");
      return;
    }
    if (period === "this_month") {
      setStartDate(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
      setEndDate(iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
      return;
    }
    if (period === "last_month") {
      setStartDate(iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setEndDate(iso(new Date(now.getFullYear(), now.getMonth(), 0)));
      return;
    }
    if (period === "last_90") {
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      setStartDate(iso(start));
      setEndDate(iso(now));
      return;
    }
    setStartDate(iso(new Date(now.getFullYear(), 0, 1)));
    setEndDate(iso(new Date(now.getFullYear(), 11, 31)));
  };

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

  // Indicadores extras
  const insights = useMemo(() => {
    const count = filteredPayments.length;
    const avg = count > 0 ? totals.gross / count : 0;
    const biggest = filteredPayments.reduce<PaymentHistoryItem | null>(
      (acc, p) => (!acc || (p.gross_value || 0) > (acc.gross_value || 0) ? p : acc),
      null
    );
    const bySupplier = new Map<string, { total: number; count: number }>();
    filteredPayments.forEach((p) => {
      const key = p.supplier_name || "-";
      const cur = bySupplier.get(key) || { total: 0, count: 0 };
      cur.total += p.gross_value || 0;
      cur.count += 1;
      bySupplier.set(key, cur);
    });
    const topSuppliers = Array.from(bySupplier.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    return { avg, biggest, topSuppliers };
  }, [filteredPayments, totals.gross]);

  const selectedTotal = useMemo(
    () =>
      filteredPayments
        .filter((p) => selectedIds.includes(p.id))
        .reduce((sum, p) => sum + (p.gross_value || 0), 0),
    [filteredPayments, selectedIds]
  );

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Só é permitido excluir registros importados (não os do financeiro real).
      const deletableIds = ids.filter((id) => !id.startsWith("tx:"));
      if (deletableIds.length === 0) return;
      const { error } = await supabase
        .from("union_payment_history")
        .delete()
        .in("id", deletableIds);
      
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

    const clinicId = resolvedClinic?.id;

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
    doc.setFontSize(9);
    doc.text(
      `Ordenado por data de pagamento (${paidSort === "asc" ? "crescente" : "decrescente"})`,
      14,
      26
    );

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
        safeFormatDate(p.due_date),
        safeFormatDate(p.paid_at),
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
      "Vencimento": safeFormatDate(p.due_date, "dd/MM/yyyy"),
      "Situação": p.status,
      "Valor Bruto": p.gross_value,
      "Valor Líquido": p.net_value,
      "Pago em": safeFormatDate(p.paid_at, "dd/MM/yyyy"),
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

  const hasActiveFilters =
    search || supplierFilter || checkFilter || startDate || endDate || dueStartDate || dueEndDate || minValue || maxValue || statusFilter !== "paid";

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
          <RefreshDataButton queryKeys={[["union-payment-history"], ["union-suppliers"]]} variant="outline" size="default" />
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
          {/* Atalhos de período */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarRange className="h-3.5 w-3.5" /> Período:
            </span>
            {([
              ["this_month", "Este mês"],
              ["last_month", "Mês passado"],
              ["last_90", "Últimos 90 dias"],
              ["this_year", "Este ano"],
              ["all", "Tudo"],
            ] as const).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => applyPeriod(key)}
              >
                {label}
              </Button>
            ))}
          </div>

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

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "paid" | "unpaid")}>
              <SelectTrigger>
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Somente pagos</SelectItem>
                <SelectItem value="unpaid">Somente a pagar</SelectItem>
                <SelectItem value="all">Pagos e a pagar</SelectItem>
              </SelectContent>
            </Select>

            <Select value={paidSort} onValueChange={(v) => setPaidSort(v as "asc" | "desc")}>
              <SelectTrigger>
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Ordenar por pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Pagamento: mais recente primeiro</SelectItem>
                <SelectItem value="asc">Pagamento: mais antigo primeiro</SelectItem>
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

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  title="Vencimento de"
                  value={dueStartDate}
                  onChange={e => setDueStartDate(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  title="Vencimento até"
                  value={dueEndDate}
                  onChange={e => setDueEndDate(e.target.value)}
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

          {/* Filtros ativos */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 mt-3">
              {search && (
                <Badge variant="secondary" className="gap-1">
                  Busca: {search}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSearch("")} />
                </Badge>
              )}
              {supplierFilter && supplierFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Fornecedor: {supplierFilter}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setSupplierFilter("all")} />
                </Badge>
              )}
              {checkFilter && (
                <Badge variant="secondary" className="gap-1">
                  Cheque: {checkFilter}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setCheckFilter("")} />
                </Badge>
              )}
              {(startDate || endDate) && (
                <Badge variant="secondary" className="gap-1">
                  {startDate ? safeFormatDate(startDate, "dd/MM/yyyy") : "início"} até{" "}
                  {endDate ? safeFormatDate(endDate, "dd/MM/yyyy") : "hoje"}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                  />
                </Badge>
              )}
              {(minValue || maxValue) && (
                <Badge variant="secondary" className="gap-1">
                  Valor: {minValue || "0"} - {maxValue || "∞"}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => {
                      setMinValue("");
                      setMaxValue("");
                    }}
                  />
                </Badge>
              )}
              {(dueStartDate || dueEndDate) && (
                <Badge variant="secondary" className="gap-1">
                  Vencimento: {dueStartDate ? safeFormatDate(dueStartDate, "dd/MM/yyyy") : "início"} até{" "}
                  {dueEndDate ? safeFormatDate(dueEndDate, "dd/MM/yyyy") : "fim"}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => {
                      setDueStartDate("");
                      setDueEndDate("");
                    }}
                  />
                </Badge>
              )}
              {statusFilter !== "paid" && (
                <Badge variant="secondary" className="gap-1">
                  Situação: {statusFilter === "unpaid" ? "A pagar" : "Pagos e a pagar"}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setStatusFilter("paid")} />
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      {filteredPayments.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Wallet className="h-4 w-4" /> Ticket médio
              </div>
              <p className="text-lg font-bold">{formatCurrency(insights.avg)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <TrendingUp className="h-4 w-4" /> Maior pagamento
              </div>
              <p className="text-lg font-bold">
                {formatCurrency(insights.biggest?.gross_value || 0)}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {insights.biggest?.supplier_name || "-"} ·{" "}
                {safeFormatDate(insights.biggest?.paid_at)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <Building className="h-4 w-4" /> Top fornecedores
              </div>
              <div className="space-y-1">
                {insights.topSuppliers.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setSupplierFilter(s.name)}
                    className="w-full flex items-center justify-between text-xs hover:bg-muted rounded px-1 py-0.5"
                  >
                    <span className="truncate max-w-[60%] text-left">{s.name}</span>
                    <span className="font-medium">{formatCurrency(s.total)}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Selected actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.length} selecionado(s)
          </span>
          <Badge variant="secondary">{formatCurrency(selectedTotal)}</Badge>
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
          ) : queryError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="font-medium">Não foi possível carregar o histórico</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {(queryError as Error)?.message || "Erro desconhecido"}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["union-payment-history"] })
                }
              >
                Tentar novamente
              </Button>
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
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("supplier_name")}
                      >
                        Fornecedor <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Portador</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("due_date")}
                      >
                        Vencimento <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("paid_at")}
                      >
                        Pago em <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Cheque</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="flex items-center gap-1 ml-auto hover:text-foreground"
                        onClick={() => toggleSort("gross_value")}
                      >
                        Valor Bruto <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Valor Líquido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map(payment => (
                    <TableRow key={payment.id} className="hover:bg-muted/50">
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
                        {safeFormatDate(payment.due_date)}
                      </TableCell>
                      <TableCell>
                        {safeFormatDate(payment.paid_at)}
                      </TableCell>
                      <TableCell>
                        {payment.check_number ? (
                          <Badge variant="outline">{payment.check_number}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {payment.paid_at || (payment.status || "").toLowerCase().startsWith("pag") ? (
                          <Badge variant="secondary">Pago</Badge>
                        ) : (payment.status || "").toLowerCase() === "vencido" ? (
                          <Badge variant="destructive">Vencido</Badge>
                        ) : (
                          <Badge variant="outline">A pagar</Badge>
                        )}
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
        {filteredPayments.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-sm">
            <span className="text-muted-foreground">
              {filteredPayments.length} registro(s)
            </span>
            <div className="flex gap-4">
              <span>
                Bruto: <strong>{formatCurrency(totals.gross)}</strong>
              </span>
              <span className="text-muted-foreground">
                Líquido: <strong>{formatCurrency(totals.net)}</strong>
              </span>
            </div>
          </div>
        )}
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
