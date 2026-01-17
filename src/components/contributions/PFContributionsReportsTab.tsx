import { useState, useMemo, useEffect } from "react";
import { getStaticYearRange } from "@/hooks/useAvailableYears";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Download,
  FileSpreadsheet,
  FileText,
  User,
  Users,
  Calendar,
  TrendingUp,
  Filter,
  ChevronDown,
  AlertTriangle,
  BarChart3,
  List,
  FileSearch,
  Search,
  X,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generatePFContributionsReport, PFReportType } from "@/lib/contributions-pf-report-pdf";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCompetence } from "@/lib/competence-format";

interface Member {
  id: string;
  name: string;
  cpf: string;
  email?: string | null;
  phone?: string | null;
  registration_number?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
}

interface PFContribution {
  id: string;
  member_id: string;
  contribution_type_id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_value: number | null;
  payment_method?: string | null;
  origin?: string;
  patients?: Member;
  contribution_types?: ContributionType;
}

interface PFContributionsReportsTabProps {
  contributions: PFContribution[];
  contributionTypes: ContributionType[];
  clinicName?: string;
  clinicLogo?: string;
  yearFilter: number;
  onYearFilterChange: (year: number) => void;
}

const REPORT_TYPES: { value: PFReportType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'general', label: 'Relatório Geral', icon: <BarChart3 className="h-4 w-4" />, description: 'Visão consolidada de todos os sócios' },
  { value: 'by-member', label: 'Por Sócio', icon: <User className="h-4 w-4" />, description: 'Extrato detalhado do sócio selecionado' },
  { value: 'synthetic', label: 'Sintético', icon: <TrendingUp className="h-4 w-4" />, description: 'Apenas totais consolidados' },
  { value: 'analytical', label: 'Analítico', icon: <List className="h-4 w-4" />, description: 'Listagem completa para auditoria' },
  { value: 'defaulting', label: 'Inadimplência', icon: <AlertTriangle className="h-4 w-4" />, description: 'Apenas pendentes e vencidos' },
];

export default function PFContributionsReportsTab({
  contributions,
  contributionTypes,
  clinicName,
  clinicLogo,
  yearFilter,
  onYearFilterChange,
}: PFContributionsReportsTabProps) {
  const { session } = useAuth();
  const [reportType, setReportType] = useState<PFReportType>("general");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("hide_cancelled");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [contributionTypeFilter, setContributionTypeFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [dateFilterType, setDateFilterType] = useState<"competence" | "due_date" | "paid_at">("competence");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState("");

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatCPF = (cpf: string) => {
    if (!cpf) return "-";
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  // Extract unique members from contributions
  const members = useMemo(() => {
    const memberMap = new Map<string, Member>();
    contributions.forEach(c => {
      if (c.patients && !memberMap.has(c.member_id)) {
        memberMap.set(c.member_id, c.patients);
      }
    });
    return Array.from(memberMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [contributions]);

  // Filter members for search
  const filteredMembers = useMemo(() => {
    if (!memberSearchTerm) return members;
    const searchLower = memberSearchTerm.toLowerCase();
    const searchClean = memberSearchTerm.replace(/\D/g, "");
    return members.filter(m => 
      m.name.toLowerCase().includes(searchLower) ||
      m.cpf.includes(searchClean)
    );
  }, [members, memberSearchTerm]);

  const filteredContributions = useMemo(() => {
    return contributions.filter((c) => {
      // Filtro por período baseado no tipo selecionado
      let matchesPeriod = false;
      if (dateFilterType === "competence") {
        matchesPeriod = c.competence_year === yearFilter && 
          (monthFilter === "all" || c.competence_month === parseInt(monthFilter));
      } else if (dateFilterType === "due_date") {
        const dueDate = new Date(c.due_date + "T12:00:00");
        matchesPeriod = dueDate.getFullYear() === yearFilter && 
          (monthFilter === "all" || (dueDate.getMonth() + 1) === parseInt(monthFilter));
      } else if (dateFilterType === "paid_at") {
        if (!c.paid_at) return false;
        const paidDate = new Date(c.paid_at);
        matchesPeriod = paidDate.getFullYear() === yearFilter && 
          (monthFilter === "all" || (paidDate.getMonth() + 1) === parseInt(monthFilter));
      }
      
      const matchesStatus = statusFilter === "all" || (statusFilter === "hide_cancelled" ? c.status !== "cancelled" : c.status === statusFilter);
      const matchesMember = !selectedMember || c.member_id === selectedMember.id;
      const matchesType = contributionTypeFilter === "all" || c.contribution_type_id === contributionTypeFilter;
      const matchesOrigin = originFilter === "all" || c.origin === originFilter;
      return matchesPeriod && matchesStatus && matchesMember && matchesType && matchesOrigin;
    });
  }, [contributions, yearFilter, monthFilter, statusFilter, selectedMember, contributionTypeFilter, originFilter, dateFilterType]);

  // Report by member
  const byMemberReport = useMemo(() => {
    const data = new Map<string, {
      member: Member;
      total: number;
      paid: number;
      pending: number;
      overdue: number;
      count: number;
    }>();

    filteredContributions.forEach((c) => {
      if (!c.patients) return;
      
      const existing = data.get(c.member_id) || {
        member: c.patients,
        total: 0,
        paid: 0,
        pending: 0,
        overdue: 0,
        count: 0,
      };

      existing.total += c.value;
      existing.count += 1;
      
      if (c.status === "paid") {
        existing.paid += c.paid_value || c.value;
      } else if (c.status === "pending") {
        existing.pending += c.value;
      } else if (c.status === "overdue") {
        existing.overdue += c.value;
      }

      data.set(c.member_id, existing);
    });

    return Array.from(data.values()).sort((a, b) => b.total - a.total);
  }, [filteredContributions]);

  // Summary totals
  const summary = useMemo(() => {
    const total = filteredContributions.reduce((acc, c) => acc + c.value, 0);
    const paid = filteredContributions
      .filter((c) => c.status === "paid")
      .reduce((acc, c) => acc + (c.paid_value || c.value), 0);
    const pending = filteredContributions
      .filter((c) => c.status === "pending")
      .reduce((acc, c) => acc + c.value, 0);
    const overdue = filteredContributions
      .filter((c) => c.status === "overdue")
      .reduce((acc, c) => acc + c.value, 0);

    return { total, paid, pending, overdue, count: filteredContributions.length };
  }, [filteredContributions]);

  const periodLabel = useMemo(() => {
    const monthLabel = monthFilter === "all" ? "Todos os meses" : String(parseInt(monthFilter)).padStart(2, "0");
    return `${monthLabel}/${yearFilter}`;
  }, [yearFilter, monthFilter]);

  const handleExportCSV = () => {
    let csvContent = "Sócio,CPF,Qtd,Total,Pago,Pendente,Vencido\n";
    byMemberReport.forEach((row) => {
      csvContent += `"${row.member.name}","${row.member.cpf}",${row.count},${row.total / 100},${row.paid / 100},${row.pending / 100},${row.overdue / 100}\n`;
    });
    const filename = `contribuicoes-pf-${yearFilter}${monthFilter !== "all" ? `-${monthFilter.padStart(2, "0")}` : ""}.csv`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    toast.success("CSV exportado com sucesso!");
  };

  const handleExportPDF = async () => {
    if (filteredContributions.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const reportData = {
      contributions: filteredContributions,
      summary,
      byMemberReport,
    };

    const selectedTypeName = contributionTypeFilter !== "all" 
      ? contributionTypes.find(t => t.id === contributionTypeFilter)?.name 
      : undefined;

    const config = {
      clinicName: clinicName || "Sistema de Contribuições",
      clinicLogo: clinicLogo,
      userName: session?.user?.email || "Usuário",
      period: periodLabel,
      selectedMember: selectedMember,
      contributionTypeName: selectedTypeName,
    };

    try {
      await generatePFContributionsReport(reportType, reportData, config);
      toast.success("PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF");
    }
  };

  const currentReportType = REPORT_TYPES.find(r => r.value === reportType);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "outline" | "secondary" | "destructive" }> = {
      paid: { label: "Pago", variant: "default" },
      pending: { label: "Pendente", variant: "secondary" },
      overdue: { label: "Vencido", variant: "destructive" },
      cancelled: { label: "Cancelado", variant: "outline" },
    };
    const { label, variant } = variants[status] || { label: status, variant: "outline" };
    return <Badge variant={variant} className="text-xs">{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header with PF badge */}
      <div className="flex items-center gap-3">
        <Badge className="bg-purple-600 hover:bg-purple-700 gap-1 px-3 py-1">
          <Users className="h-3.5 w-3.5" />
          Relatórios PF
        </Badge>
        <span className="text-sm text-muted-foreground">
          Contribuições de Pessoa Física (Sócios)
        </span>
      </div>

      {/* Search and Filters Card */}
      <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50/50 to-background">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-purple-600" />
            Filtros do Relatório PF
          </CardTitle>
          <CardDescription>
            Selecione os filtros para gerar o relatório de contribuições PF
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Member Search - Prominent */}
          <div className="flex items-center gap-2">
            <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={memberSearchOpen}
                  className="flex-1 justify-between h-10"
                >
                  {selectedMember ? (
                    <span className="flex items-center gap-2 truncate">
                      <User className="h-4 w-4 text-purple-600" />
                      {selectedMember.name}
                      <span className="text-muted-foreground text-xs">
                        ({formatCPF(selectedMember.cpf)})
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Search className="h-4 w-4" />
                      Buscar sócio (Nome ou CPF)...
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder="Digite o nome ou CPF..." 
                    value={memberSearchTerm}
                    onValueChange={setMemberSearchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum sócio encontrado.</CommandEmpty>
                    <CommandGroup>
                      <ScrollArea className="h-[200px]">
                        {filteredMembers.map((member) => (
                          <CommandItem
                            key={member.id}
                            value={`${member.name} ${member.cpf}`}
                            onSelect={() => {
                              setSelectedMember(member);
                              setMemberSearchOpen(false);
                              setMemberSearchTerm("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedMember?.id === member.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{member.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatCPF(member.cpf)}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </ScrollArea>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedMember && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedMember(null)}
                className="h-10 w-10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Report Type Selector */}
            <Select value={reportType} onValueChange={(v) => setReportType(v as PFReportType)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {currentReportType?.icon}
                    <span>{currentReportType?.label}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      {type.icon}
                      <div className="flex flex-col">
                        <span className="font-medium">{type.label}</span>
                        <span className="text-xs text-muted-foreground">{type.description}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Filter Type */}
            <Select value={dateFilterType} onValueChange={(v) => setDateFilterType(v as "competence" | "due_date" | "paid_at")}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="competence">Por Competência</SelectItem>
                <SelectItem value="due_date">Por Vencimento</SelectItem>
                <SelectItem value="paid_at">Por Pagamento</SelectItem>
              </SelectContent>
            </Select>

            <Select value={String(yearFilter)} onValueChange={(v) => onYearFilterChange(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getStaticYearRange().map((year) => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {String(i + 1).padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hide_cancelled">Ocultar cancelados</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="overdue">Vencidos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>

            {/* Contribution Type Filter */}
            <Select value={contributionTypeFilter} onValueChange={setContributionTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo de Contribuição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {contributionTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Origin Filter */}
            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                <SelectItem value="lytex">Lytex</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="import">Importação</SelectItem>
              </SelectContent>
            </Select>

            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" className="ml-auto gap-2 bg-purple-600 hover:bg-purple-700">
                  <Download className="h-4 w-4" />
                  Exportar
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2 text-rose-600" />
                  Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
                  Exportar CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Selected Member Badge */}
          {selectedMember && (
            <div className="flex items-center gap-2 p-2 bg-purple-100 rounded-lg">
              <User className="h-4 w-4 text-purple-700" />
              <span className="text-sm font-medium text-purple-800">
                Filtrando por: {selectedMember.name}
              </span>
              <Badge variant="outline" className="font-mono text-xs bg-white">
                {formatCPF(selectedMember.cpf)}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-purple-600">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Bruto</p>
            <p className="text-lg font-bold text-purple-700">{formatCurrency(summary.total)}</p>
            <p className="text-xs text-muted-foreground">{summary.count} contribuições</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Recebido</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.paid)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-lg font-bold text-amber-600">{formatCurrency(summary.pending)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Vencido</p>
            <p className="text-lg font-bold text-rose-600">{formatCurrency(summary.overdue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              Contribuições por Sócio
            </CardTitle>
            <Badge variant="outline">{byMemberReport.length} sócios</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {byMemberReport.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Nenhuma contribuição PF encontrada para os filtros selecionados</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sócio</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">Pendente</TableHead>
                    <TableHead className="text-right">Vencido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byMemberReport.map((row) => (
                    <TableRow 
                      key={row.member.id}
                      className="cursor-pointer hover:bg-purple-50/50"
                      onClick={() => {
                        setSelectedMember(row.member);
                        setReportType("by-member");
                      }}
                    >
                      <TableCell className="font-medium">{row.member.name}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCPF(row.member.cpf)}</TableCell>
                      <TableCell className="text-center">{row.count}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(row.total)}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatCurrency(row.paid)}</TableCell>
                      <TableCell className="text-right text-amber-600">{formatCurrency(row.pending)}</TableCell>
                      <TableCell className="text-right text-rose-600">{formatCurrency(row.overdue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detailed Table when member selected */}
      {selectedMember && (
        <Card className="border-purple-200">
          <CardHeader className="pb-3 bg-purple-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-purple-600" />
                <div>
                  <CardTitle className="text-base">{selectedMember.name}</CardTitle>
                  <CardDescription>CPF: {formatCPF(selectedMember.cpf)}</CardDescription>
                </div>
              </div>
              <Badge variant="outline">{filteredContributions.length} contribuições</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Pago em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContributions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono">
                        {formatCompetence(c.competence_month, c.competence_year)}
                      </TableCell>
                      <TableCell>{c.contribution_types?.name || "-"}</TableCell>
                      <TableCell>
                        {format(new Date(c.due_date + "T12:00:00"), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(c.value)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(c.status)}
                      </TableCell>
                      <TableCell>
                        {c.paid_at ? format(new Date(c.paid_at), "dd/MM/yyyy") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
