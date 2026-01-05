import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Handshake,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface NegotiationInstallment {
  id: string;
  negotiation_id: string;
  installment_number: number;
  value: number;
  due_date: string;
  status: string;
  lytex_invoice_id: string | null;
  lytex_invoice_url: string | null;
  paid_at: string | null;
  paid_value: number | null;
  negotiation?: {
    negotiation_code: string;
    employer_id: string;
    employers?: {
      id: string;
      name: string;
      cnpj: string;
    };
  };
}

interface NegotiationInstallmentsTabProps {
  clinicId: string;
  employerId?: string; // If provided, filter by employer
  yearFilter?: number;
}

const ITEMS_PER_PAGE = 15;

function parseDateOnly(value: string): Date {
  const dateOnly = value?.slice(0, 10);
  const d = parseISO(dateOnly);
  d.setHours(12, 0, 0, 0);
  return d;
}

const STATUS_CONFIG = {
  pending: { 
    label: "Pendente", 
    badgeClass: "bg-amber-500/15 text-amber-700 border-amber-300",
    icon: Clock 
  },
  paid: { 
    label: "Pago", 
    badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
    icon: CheckCircle2 
  },
  overdue: { 
    label: "Vencido", 
    badgeClass: "bg-rose-500/15 text-rose-700 border-rose-300",
    icon: AlertTriangle 
  },
  cancelled: { 
    label: "Cancelado", 
    badgeClass: "bg-gray-500/10 text-gray-500 border-gray-300 line-through",
    icon: XCircle 
  },
};

export default function NegotiationInstallmentsTab({
  clinicId,
  employerId,
  yearFilter = new Date().getFullYear(),
}: NegotiationInstallmentsTabProps) {
  const [installments, setInstallments] = useState<NegotiationInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [internalYearFilter, setInternalYearFilter] = useState(yearFilter);

  useEffect(() => {
    if (clinicId) {
      fetchInstallments();
    }
  }, [clinicId, employerId]);

  const fetchInstallments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("negotiation_installments")
        .select(`
          *,
          negotiation:debt_negotiations!inner (
            negotiation_code,
            employer_id,
            clinic_id,
            employers (
              id,
              name,
              cnpj
            )
          )
        `)
        .eq("negotiation.clinic_id", clinicId)
        .order("due_date", { ascending: false });

      if (employerId) {
        query = query.eq("negotiation.employer_id", employerId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInstallments(data || []);
    } catch (error) {
      console.error("Error fetching negotiation installments:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const filteredInstallments = useMemo(() => {
    return installments.filter((inst) => {
      const dueYear = new Date(inst.due_date).getFullYear();
      const matchesYear = dueYear === internalYearFilter;
      
      const matchesSearch = 
        inst.negotiation?.employers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inst.negotiation?.employers?.cnpj.includes(searchTerm.replace(/\D/g, "")) ||
        inst.negotiation?.negotiation_code.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || inst.status === statusFilter;

      return matchesYear && matchesSearch && matchesStatus;
    });
  }, [installments, searchTerm, statusFilter, internalYearFilter]);

  const totalPages = Math.ceil(filteredInstallments.length / ITEMS_PER_PAGE);
  const paginatedInstallments = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInstallments.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredInstallments, currentPage]);

  // Stats
  const stats = useMemo(() => {
    const yearData = filteredInstallments;
    return {
      total: yearData.length,
      pending: yearData.filter(i => i.status === "pending").length,
      paid: yearData.filter(i => i.status === "paid").length,
      overdue: yearData.filter(i => i.status === "overdue").length,
      totalValue: yearData.reduce((acc, i) => acc + Number(i.value), 0),
      paidValue: yearData.filter(i => i.status === "paid").reduce((acc, i) => acc + Number(i.paid_value || i.value), 0),
    };
  }, [filteredInstallments]);

  const years = useMemo(() => {
    const uniqueYears = new Set(installments.map(i => new Date(i.due_date).getFullYear()));
    return Array.from(uniqueYears).sort((a, b) => b - a);
  }, [installments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total {internalYearFilter}</p>
            <p className="text-xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalValue)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Pagos</p>
            <p className="text-xl font-bold text-emerald-600">{stats.paid}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats.paidValue)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-xl font-bold text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Vencidos</p>
            <p className="text-xl font-bold text-rose-600">{stats.overdue}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa ou código..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="overdue">Vencidos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(internalYearFilter)} onValueChange={(v) => { setInternalYearFilter(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.length > 0 ? years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                )) : (
                  <SelectItem value={String(new Date().getFullYear())}>{new Date().getFullYear()}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {!employerId && <TableHead>Empresa</TableHead>}
                <TableHead>Acordo</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Boleto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInstallments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={employerId ? 6 : 7} className="h-32 text-center">
                    <Handshake className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">Nenhuma parcela de negociação encontrada</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedInstallments.map((inst) => {
                  const statusConfig = STATUS_CONFIG[inst.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;
                  const totalInstallments = installments.filter(i => i.negotiation_id === inst.negotiation_id).length;

                  return (
                    <TableRow key={inst.id} className="hover:bg-muted/30">
                      {!employerId && (
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[200px]">
                              {inst.negotiation?.employers?.name || "-"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {inst.negotiation?.employers?.cnpj ? formatCNPJ(inst.negotiation.employers.cnpj) : "-"}
                            </p>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {inst.negotiation?.negotiation_code || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {inst.installment_number}/{totalInstallments}
                      </TableCell>
                      <TableCell>
                        {format(parseDateOnly(inst.due_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(inst.value))}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${statusConfig.badgeClass} text-xs gap-1`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {inst.lytex_invoice_url && inst.status !== "paid" && inst.status !== "cancelled" ? (
                          <a
                            href={inst.lytex_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver Boleto
                          </a>
                        ) : inst.lytex_invoice_id ? (
                          <Badge variant="outline" className="text-xs text-emerald-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Gerado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Não gerado
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              {filteredInstallments.length} parcela(s) encontrada(s)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
