import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import NegotiationDetailsDialog from "./NegotiationDetailsDialog";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name: string | null;
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
  cancelled_at: string | null;
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

  const filteredNegotiations = useMemo(() => {
    return negotiations.filter((neg) => {
      const matchesSearch =
        neg.negotiation_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        neg.employers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        neg.employers?.cnpj.includes(searchTerm);

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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, empresa ou CNPJ..."
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
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Valor Original</TableHead>
                <TableHead className="text-right">Valor Negociado</TableHead>
                <TableHead className="text-center">Parcelas</TableHead>
                <TableHead>1ª Parcela</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedNegotiations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma negociação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                paginatedNegotiations.map((negotiation) => {
                  const statusConfig = STATUS_CONFIG[negotiation.status] || STATUS_CONFIG.simulation;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <TableRow key={negotiation.id}>
                      <TableCell className="font-mono font-medium">
                        {negotiation.negotiation_code}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{negotiation.employers?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {negotiation.employers?.cnpj && formatCNPJ(negotiation.employers.cnpj)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(negotiation.total_original_value)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(negotiation.total_negotiated_value)}
                      </TableCell>
                      <TableCell className="text-center">
                        {negotiation.installments_count}x
                      </TableCell>
                      <TableCell>
                        {format(new Date(negotiation.first_due_date), "dd/MM/yyyy")}
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
                <span className="text-sm">
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
