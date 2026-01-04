import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Eye,
  Send,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { format } from "date-fns";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
}

interface ContributionType {
  id: string;
  name: string;
  is_active: boolean;
}

interface Contribution {
  id: string;
  employer_id: string;
  contribution_type_id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  due_date: string;
  status: string;
  lytex_invoice_id: string | null;
  employers?: Employer;
  contribution_types?: ContributionType;
}

interface ContributionsListTabProps {
  contributions: Contribution[];
  onViewContribution: (contribution: Contribution) => void;
  onGenerateInvoice: (contribution: Contribution) => void;
  onOpenCreate: () => void;
  generatingInvoice: boolean;
  yearFilter: number;
  onYearFilterChange: (year: number) => void;
}

const ITEMS_PER_PAGE = 15;

const STATUS_CONFIG = {
  pending: { label: "Pendente", color: "bg-amber-100 text-amber-700", icon: Clock },
  processing: { label: "Processando", color: "bg-blue-100 text-blue-700", icon: RefreshCw },
  paid: { label: "Pago", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  overdue: { label: "Vencido", color: "bg-rose-100 text-rose-700", icon: AlertTriangle },
  cancelled: { label: "Cancelado", color: "bg-gray-100 text-gray-700", icon: XCircle },
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function ContributionsListTab({
  contributions,
  onViewContribution,
  onGenerateInvoice,
  onOpenCreate,
  generatingInvoice,
  yearFilter,
  onYearFilterChange,
}: ContributionsListTabProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const filteredContributions = useMemo(() => {
    return contributions.filter((c) => {
      const matchesSearch = 
        c.employers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.employers?.cnpj.includes(searchTerm.replace(/\D/g, "")) ||
        c.contribution_types?.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesYear = c.competence_year === yearFilter;
      const matchesMonth = monthFilter === "all" || c.competence_month === parseInt(monthFilter);

      return matchesSearch && matchesStatus && matchesYear && matchesMonth;
    });
  }, [contributions, searchTerm, statusFilter, yearFilter, monthFilter]);

  const totalPages = Math.ceil(filteredContributions.length / ITEMS_PER_PAGE);
  const paginatedContributions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredContributions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredContributions, currentPage]);

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleMonthChange = (value: string) => {
    setMonthFilter(value);
    setCurrentPage(1);
  };

  const handleYearChange = (value: string) => {
    onYearFilterChange(parseInt(value));
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa, CNPJ ou tipo..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px] h-9">
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
            <Select value={monthFilter} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {MONTHS.map((month, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(yearFilter)} onValueChange={handleYearChange}>
              <SelectTrigger className="w-[100px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">
              {filteredContributions.length} resultado{filteredContributions.length !== 1 ? "s" : ""}
            </Badge>
            <Button onClick={onOpenCreate} className="ml-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nova Contribuição
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Empresa</TableHead>
                <TableHead className="font-semibold">Tipo</TableHead>
                <TableHead className="font-semibold">Competência</TableHead>
                <TableHead className="font-semibold">Vencimento</TableHead>
                <TableHead className="font-semibold text-right">Valor</TableHead>
                <TableHead className="font-semibold text-center">Status</TableHead>
                <TableHead className="font-semibold text-center">Boleto</TableHead>
                <TableHead className="font-semibold text-right w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedContributions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhuma contribuição encontrada</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedContributions.map((contrib) => {
                  const statusConfig = STATUS_CONFIG[contrib.status as keyof typeof STATUS_CONFIG];
                  const StatusIcon = statusConfig?.icon || Clock;

                  return (
                    <TableRow key={contrib.id} className="h-12 hover:bg-muted/30">
                      <TableCell className="py-2">
                        <div>
                          <button
                            onClick={() => navigate(`/dashboard/empresas/${contrib.employer_id}`)}
                            className="font-medium text-sm text-primary hover:underline text-left"
                          >
                            {contrib.employers?.name}
                          </button>
                          <p className="text-xs text-muted-foreground">
                            {contrib.employers?.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-sm">{contrib.contribution_types?.name}</span>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-sm font-medium">
                          {MONTHS[contrib.competence_month - 1]?.slice(0, 3)}/{contrib.competence_year}
                        </span>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-sm">
                          {format(new Date(contrib.due_date + "T12:00:00"), "dd/MM/yyyy")}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <span className="font-medium">{formatCurrency(contrib.value)}</span>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        <Badge className={`${statusConfig?.color} text-xs gap-1`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        {contrib.lytex_invoice_id ? (
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
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => onViewContribution(contrib)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver detalhes</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {!contrib.lytex_invoice_id && contrib.status !== "cancelled" && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-primary"
                                    onClick={() => onGenerateInvoice(contrib)}
                                    disabled={generatingInvoice}
                                  >
                                    {generatingInvoice ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Send className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Gerar boleto</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
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
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
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
