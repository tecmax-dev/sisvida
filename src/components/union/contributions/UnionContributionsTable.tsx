import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Eye,
  ExternalLink,
  Building2,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Link2,
  FileText,
} from "lucide-react";
import { formatCompetence } from "@/lib/competence-format";
import { parseDateOnlyToLocalNoon } from "@/lib/date";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name?: string | null;
  registration_number?: string | null;
}

interface Member {
  id: string;
  name: string;
  cpf?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
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
  lytex_invoice_url: string | null;
  paid_at?: string | null;
  paid_value?: number | null;
  member_id?: string | null;
  public_access_token?: string | null;
  employers?: Employer;
  patients?: Member;
  contribution_types?: ContributionType;
}

interface UnionContributionsTableProps {
  contributions: Contribution[];
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAllVisible: () => void;
  allVisibleSelected: boolean;
  eligibleOnPageCount: number;
  onViewContribution: (contribution: Contribution) => void;
  documentType: "pj" | "pf" | "awaiting";
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalCount: number;
  itemsPerPage: number;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  badgeClass: string;
  rowClass: string;
  icon: React.ElementType;
}> = {
  pending: {
    label: "Pendente",
    badgeClass: "bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-600",
    rowClass: "border-l-4 border-l-amber-400",
    icon: Clock,
  },
  processing: {
    label: "Processando",
    badgeClass: "bg-blue-500/15 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-600",
    rowClass: "border-l-4 border-l-blue-400",
    icon: RefreshCw,
  },
  paid: {
    label: "Pago",
    badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-600",
    rowClass: "border-l-4 border-l-emerald-500",
    icon: CheckCircle2,
  },
  overdue: {
    label: "Vencido",
    badgeClass: "bg-rose-500/15 text-rose-700 border-rose-300 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-600",
    rowClass: "border-l-4 border-l-rose-500",
    icon: AlertTriangle,
  },
  cancelled: {
    label: "Cancelado",
    badgeClass: "bg-gray-500/10 text-gray-500 border-gray-300 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-600 line-through",
    rowClass: "border-l-4 border-l-gray-300 opacity-60",
    icon: XCircle,
  },
  awaiting_value: {
    label: "Definir...",
    badgeClass: "bg-purple-500/15 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-600",
    rowClass: "border-l-4 border-l-purple-400",
    icon: Clock,
  },
};

export default function UnionContributionsTable({
  contributions,
  selectedIds,
  onToggleSelection,
  onSelectAllVisible,
  allVisibleSelected,
  eligibleOnPageCount,
  onViewContribution,
  documentType,
  currentPage,
  totalPages,
  onPageChange,
  totalCount,
  itemsPerPage,
}: UnionContributionsTableProps) {
  const navigate = useNavigate();

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return "";
    const digits = cnpj.replace(/\D/g, "");
    return digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    );
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return "";
    const digits = cpf.replace(/\D/g, "");
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  };

  const handleEmployerClick = (employerId: string) => {
    navigate(`/union/empresas/${employerId}`);
  };

  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalCount);

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[40px]">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={onSelectAllVisible}
                          disabled={eligibleOnPageCount === 0}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {allVisibleSelected ? "Desmarcar todos" : "Selecionar todos elegíveis"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead className="font-semibold w-[60px] text-center">#</TableHead>
              <TableHead className="font-semibold w-[80px]">Tipo</TableHead>
              <TableHead className="font-semibold min-w-[250px]">
                {documentType === "pj" ? "Empresa" : documentType === "pf" ? "Contribuinte" : "Empresa/Contribuinte"}
              </TableHead>
              <TableHead className="font-semibold w-[100px] text-center">Competência</TableHead>
              <TableHead className="font-semibold w-[100px] text-center">Vencimento</TableHead>
              <TableHead className="font-semibold w-[100px] text-center">Pagamento</TableHead>
              <TableHead className="font-semibold w-[100px] text-center">Status</TableHead>
              <TableHead className="font-semibold w-[110px] text-right">Valor</TableHead>
              <TableHead className="font-semibold w-[110px] text-right">Pago</TableHead>
              <TableHead className="font-semibold w-[80px] text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contributions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    {documentType === "pj" ? (
                      <Building2 className="h-8 w-8 text-muted-foreground" />
                    ) : documentType === "pf" ? (
                      <User className="h-8 w-8 text-muted-foreground" />
                    ) : (
                      <Clock className="h-8 w-8 text-purple-400" />
                    )}
                    <p className="text-muted-foreground">
                      Nenhuma contribuição encontrada
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              contributions.map((contribution, index) => {
                const statusConfig = getStatusConfig(contribution.status);
                const StatusIcon = statusConfig.icon;
                const isEligible =
                  (contribution.lytex_invoice_id || contribution.public_access_token) &&
                  contribution.status !== "paid" &&
                  contribution.status !== "cancelled";
                const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;

                return (
                  <TableRow
                    key={contribution.id}
                    className={`${statusConfig.rowClass} hover:bg-muted/30 transition-colors`}
                  >
                    {/* Checkbox */}
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={selectedIds.has(contribution.id)}
                          onCheckedChange={() => onToggleSelection(contribution.id)}
                          disabled={!isEligible}
                        />
                      </div>
                    </TableCell>

                    {/* Row Number */}
                    <TableCell className="text-center font-mono text-sm text-muted-foreground">
                      {rowNumber}
                    </TableCell>

                    {/* Type Badge */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-xs font-medium bg-blue-500/10 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-600"
                      >
                        {contribution.contribution_types?.name?.substring(0, 8) || "N/A"}
                      </Badge>
                    </TableCell>

                    {/* Company/Member Info */}
                    <TableCell>
                      <div className="space-y-1">
                        {/* Name - clickable for PJ */}
                        {documentType === "pj" || documentType === "awaiting" ? (
                          <>
                            <button
                              onClick={() => contribution.employers?.id && handleEmployerClick(contribution.employers.id)}
                              className="font-semibold text-foreground hover:text-primary hover:underline text-left"
                            >
                              {contribution.employers?.name || "—"}
                            </button>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground font-mono">
                                {formatCNPJ(contribution.employers?.cnpj || "")}
                              </span>
                              {contribution.lytex_invoice_id && (
                                <Badge variant="outline" className="h-4 px-1 text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-300">
                                  TL
                                </Badge>
                              )}
                              {contribution.public_access_token && !contribution.lytex_invoice_id && (
                                <Badge variant="outline" className="h-4 px-1 text-[10px] bg-purple-500/10 text-purple-600 border-purple-300">
                                  <Link2 className="h-2.5 w-2.5" />
                                </Badge>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-foreground">
                              {contribution.patients?.name || "—"}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground font-mono">
                                {formatCPF(contribution.patients?.cpf || "")}
                              </span>
                              {contribution.lytex_invoice_id && (
                                <Badge variant="outline" className="h-4 px-1 text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-300">
                                  TL
                                </Badge>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </TableCell>

                    {/* Competence */}
                    <TableCell className="text-center font-mono text-sm">
                      {formatCompetence(contribution.competence_month, contribution.competence_year)}
                    </TableCell>

                    {/* Due Date */}
                    <TableCell className="text-center text-sm">
                      {format(parseDateOnlyToLocalNoon(contribution.due_date), "dd/MM/yyyy")}
                    </TableCell>

                    {/* Payment Date */}
                    <TableCell className="text-center text-sm">
                      {contribution.paid_at ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {format(new Date(contribution.paid_at), "dd/MM/yyyy")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`gap-1 ${statusConfig.badgeClass}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>

                    {/* Value */}
                    <TableCell className="text-right font-medium">
                      {contribution.value > 0 ? formatCurrency(contribution.value) : (
                        <span className="text-purple-600 dark:text-purple-400 italic">Definir...</span>
                      )}
                    </TableCell>

                    {/* Paid Value */}
                    <TableCell className="text-right">
                      {contribution.paid_value ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(contribution.paid_value)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => onViewContribution(contribution)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver detalhes</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {contribution.lytex_invoice_url && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  asChild
                                >
                                  <a
                                    href={contribution.lytex_invoice_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Abrir boleto</TooltipContent>
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20">
          <div className="text-sm text-muted-foreground">
            Mostrando de <span className="font-medium">{startIndex}</span> até{" "}
            <span className="font-medium">{endIndex}</span> de{" "}
            <span className="font-medium">{totalCount}</span> registros
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => onPageChange(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
