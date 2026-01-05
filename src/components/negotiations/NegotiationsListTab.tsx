import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Eye,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Ban,
  ChevronLeft,
  ChevronRight,
  Handshake,
  TrendingUp,
  DollarSign,
  Calendar,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import NegotiationDetailsDialog from "./NegotiationDetailsDialog";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name: string | null;
  lytex_client_id: string | null;
  registration_number?: string | null;
}

interface Negotiation {
  id: string;
  negotiation_code: string;
  status: string;
  employer_id: string;
  total_original_value: number;
  total_interest: number;
  total_monetary_correction: number;
  total_late_fee: number;
  total_negotiated_value: number;
  down_payment_value: number;
  down_payment_due_date: string | null;
  installments_count: number;
  installment_value: number;
  first_due_date: string;
  applied_interest_rate: number;
  applied_correction_rate: number;
  applied_late_fee_rate: number;
  approved_at: string | null;
  approved_by: string | null;
  approval_method: string | null;
  approval_notes: string | null;
  finalized_at: string | null;
  finalized_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  created_at: string;
  employers?: Employer;
}

interface NegotiationsListTabProps {
  negotiations: Negotiation[];
  onViewNegotiation: (negotiation: Negotiation) => void;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: React.ElementType }> = {
  simulation: {
    label: "Simulação",
    badgeClass: "bg-purple-500/15 text-purple-700 border-purple-300",
    icon: FileText,
  },
  pending_approval: {
    label: "Aguardando Aprovação",
    badgeClass: "bg-amber-500/15 text-amber-700 border-amber-300",
    icon: Clock,
  },
  approved: {
    label: "Aprovado",
    badgeClass: "bg-blue-500/15 text-blue-700 border-blue-300",
    icon: CheckCircle2,
  },
  active: {
    label: "Ativo",
    badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
    icon: CheckCircle2,
  },
  completed: {
    label: "Concluído",
    badgeClass: "bg-green-500/15 text-green-700 border-green-300",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelado",
    badgeClass: "bg-gray-500/15 text-gray-500 border-gray-300",
    icon: Ban,
  },
};

const ITEMS_PER_PAGE = 15;

export default function NegotiationsListTab({
  negotiations,
  onViewNegotiation,
  onRefresh,
}: NegotiationsListTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedNegotiation, setSelectedNegotiation] = useState<Negotiation | null>(null);

  // Statistics
  const stats = useMemo(() => {
    const active = negotiations.filter((n) => n.status === "active");
    const pending = negotiations.filter((n) => n.status === "pending_approval" || n.status === "simulation");
    const completed = negotiations.filter((n) => n.status === "completed");
    const cancelled = negotiations.filter((n) => n.status === "cancelled");

    const totalNegotiatedValue = active.reduce((sum, n) => sum + n.total_negotiated_value, 0);
    const totalOriginalValue = negotiations.reduce((sum, n) => sum + n.total_original_value, 0);

    return {
      total: negotiations.length,
      active: active.length,
      pending: pending.length,
      completed: completed.length,
      cancelled: cancelled.length,
      totalNegotiatedValue,
      totalOriginalValue,
    };
  }, [negotiations]);

  const filteredNegotiations = useMemo(() => {
    return negotiations.filter((neg) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        neg.negotiation_code.toLowerCase().includes(searchLower) ||
        neg.employers?.name.toLowerCase().includes(searchLower) ||
        neg.employers?.cnpj.includes(searchTerm.replace(/\D/g, "")) ||
        neg.employers?.registration_number?.includes(searchTerm);

      const matchesStatus = statusFilter === "all" || neg.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [negotiations, searchTerm, statusFilter]);

  const paginatedNegotiations = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredNegotiations.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredNegotiations, currentPage]);

  const totalPages = Math.ceil(filteredNegotiations.length / ITEMS_PER_PAGE);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const handleCardClick = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Total Negociações */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
            statusFilter === "all" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => handleCardClick("all")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/25">
                <Handshake className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground font-medium">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ativas */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
            statusFilter === "active" ? "ring-2 ring-emerald-500" : ""
          }`}
          onClick={() => handleCardClick("active")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
                <p className="text-xs text-muted-foreground font-medium">Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pendentes */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
            statusFilter === "pending_approval" ? "ring-2 ring-amber-500" : ""
          }`}
          onClick={() => handleCardClick("pending_approval")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/25">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                <p className="text-xs text-muted-foreground font-medium">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Concluídas */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
            statusFilter === "completed" ? "ring-2 ring-green-500" : ""
          }`}
          onClick={() => handleCardClick("completed")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/25">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                <p className="text-xs text-muted-foreground font-medium">Concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Valor Total Negociado */}
        <Card className="md:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(stats.totalNegotiatedValue)}</p>
                <p className="text-xs text-muted-foreground font-medium">Total Negociado (Ativas)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, empresa, CNPJ ou matrícula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="simulation">Simulação</SelectItem>
                <SelectItem value="pending_approval">Aguardando Aprovação</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Negociações
            <Badge variant="secondary" className="ml-2">{filteredNegotiations.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Código</TableHead>
                <TableHead className="font-semibold">Empresa</TableHead>
                <TableHead className="text-right font-semibold">Valor Original</TableHead>
                <TableHead className="text-right font-semibold">Valor Negociado</TableHead>
                <TableHead className="text-center font-semibold">Parcelas</TableHead>
                <TableHead className="font-semibold">1ª Parcela</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedNegotiations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-muted">
                        <Handshake className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Nenhuma negociação encontrada</p>
                        <p className="text-sm text-muted-foreground">
                          {searchTerm || statusFilter !== "all" 
                            ? "Tente ajustar os filtros de busca"
                            : "Crie uma nova negociação para começar"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedNegotiations.map((negotiation) => {
                  const statusConfig = STATUS_CONFIG[negotiation.status] || STATUS_CONFIG.simulation;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <TableRow key={negotiation.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono font-semibold text-primary">
                        {negotiation.negotiation_code}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-amber-500/10">
                            <Building2 className="h-4 w-4 text-amber-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{negotiation.employers?.name}</p>
                              {negotiation.employers?.registration_number && (
                                <Badge variant="outline" className="text-[10px] font-mono">
                                  {negotiation.employers.registration_number}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {negotiation.employers?.cnpj && formatCNPJ(negotiation.employers.cnpj)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(negotiation.total_original_value)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        {formatCurrency(negotiation.total_negotiated_value)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">
                          {negotiation.installments_count}x
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {format(new Date(`${negotiation.first_due_date.split("T")[0]}T12:00:00`), "dd/MM/yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusConfig.badgeClass}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-primary/10"
                                onClick={() => setSelectedNegotiation(negotiation)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver detalhes</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredNegotiations.length)} de{" "}
                {filteredNegotiations.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      {selectedNegotiation && (
        <NegotiationDetailsDialog
          negotiation={selectedNegotiation}
          open={!!selectedNegotiation}
          onOpenChange={(open) => !open && setSelectedNegotiation(null)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
