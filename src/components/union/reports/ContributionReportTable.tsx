import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  FileText,
  FileSpreadsheet,
  Download,
  ChevronDown,
  X,
  Printer,
  FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EmployerReportRow {
  employerId: string;
  employerName: string;
  cnpj: string;
  totalValue: number;
  paidValue: number;
  pendingValue: number;
  status: 'paid' | 'pending' | 'overdue' | 'mixed';
  lastUpdate: Date | null;
  count: number;
}

interface ContributionReportTableProps {
  data: EmployerReportRow[];
  isLoading?: boolean;
  onExportPDF: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onPrint: () => void;
  emptyMessage?: string;
}

type SortDirection = 'asc' | 'desc' | null;
type SortKey = keyof EmployerReportRow;

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const formatCNPJ = (cnpj: string) => {
  if (!cnpj) return "—";
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};

const getStatusBadge = (status: EmployerReportRow['status']) => {
  const config = {
    paid: { label: 'Pago', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    overdue: { label: 'Vencido', className: 'bg-rose-100 text-rose-700 border-rose-200' },
    mixed: { label: 'Misto', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  };
  const { label, className } = config[status];
  return (
    <Badge variant="outline" className={cn("font-medium", className)}>
      {label}
    </Badge>
  );
};

export function ContributionReportTable({
  data,
  isLoading,
  onExportPDF,
  onExportExcel,
  onExportCSV,
  onPrint,
  emptyMessage = "Nenhum resultado encontrado. Tente ajustar os filtros.",
}: ContributionReportTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const searchClean = search.replace(/\D/g, "");
      
      result = result.filter((row) => {
        const nameMatch = row.employerName.toLowerCase().includes(searchLower);
        const cnpjMatch = row.cnpj.replace(/\D/g, "").includes(searchClean);
        return nameMatch || cnpjMatch;
      });
    }

    // Sort
    if (sortKey && sortDirection) {
      result.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else if (aVal instanceof Date && bVal instanceof Date) {
          comparison = aVal.getTime() - bVal.getTime();
        } else {
          comparison = String(aVal).localeCompare(String(bVal), 'pt-BR');
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, search, sortKey, sortDirection]);

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5 ml-1" />;
    if (sortDirection === 'asc') return <ArrowUp className="h-3.5 w-3.5 ml-1 text-primary" />;
    if (sortDirection === 'desc') return <ArrowDown className="h-3.5 w-3.5 ml-1 text-primary" />;
    return <ArrowUpDown className="h-3.5 w-3.5 ml-1" />;
  };

  const SortableHeader = ({ children, sortKey: key }: { children: React.ReactNode; sortKey: SortKey }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 hover:bg-transparent font-medium"
      onClick={() => handleSort(key)}
    >
      {children}
      {getSortIcon(key)}
    </Button>
  );

  const hasData = data.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Resultados do Relatório
            </CardTitle>
            <CardDescription>
              {filteredAndSortedData.length} registro(s) encontrado(s)
              {search && ` (filtrado de ${data.length})`}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa ou CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-8"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-2"
                  onClick={() => setSearch("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Export Dropdown */}
            {hasData && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Exportar</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={onExportPDF} className="cursor-pointer">
                    <FileText className="h-4 w-4 mr-2 text-rose-600" />
                    Exportar PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onExportExcel} className="cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
                    Exportar Excel (XLSX)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onExportCSV} className="cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-blue-600" />
                    Exportar CSV
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onPrint} className="cursor-pointer">
                    <Printer className="h-4 w-4 mr-2 text-slate-600" />
                    Imprimir Relatório
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="min-w-[200px]">
                  <SortableHeader sortKey="employerName">Empresa</SortableHeader>
                </TableHead>
                <TableHead className="min-w-[150px]">
                  <SortableHeader sortKey="cnpj">CNPJ</SortableHeader>
                </TableHead>
                <TableHead className="text-right min-w-[120px]">
                  <SortableHeader sortKey="totalValue">Valor Devido</SortableHeader>
                </TableHead>
                <TableHead className="text-right min-w-[120px]">
                  <SortableHeader sortKey="paidValue">Valor Pago</SortableHeader>
                </TableHead>
                <TableHead className="text-right min-w-[120px]">
                  <SortableHeader sortKey="pendingValue">Saldo Pendente</SortableHeader>
                </TableHead>
                <TableHead className="text-center min-w-[100px]">Situação</TableHead>
                <TableHead className="min-w-[130px]">
                  <SortableHeader sortKey="lastUpdate">Última Atualização</SortableHeader>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((_, j) => (
                      <TableCell key={j}>
                        <div className="animate-pulse h-4 bg-gray-200 rounded w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileSearch className="h-12 w-12 opacity-50" />
                      <p className="font-medium">{emptyMessage}</p>
                      <p className="text-sm">
                        {search ? "Tente uma busca diferente" : "Ajuste os filtros acima para encontrar resultados"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((row) => (
                  <TableRow key={row.employerId} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-medium">{row.employerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.count} contribuição(ões)
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
                        {formatCNPJ(row.cnpj)}
                      </code>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.totalValue)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">
                      {formatCurrency(row.paidValue)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-amber-600">
                      {formatCurrency(row.pendingValue)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(row.status)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.lastUpdate 
                        ? format(row.lastUpdate, "dd/MM/yyyy", { locale: ptBR })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Footer with record count */}
        <div className="px-4 py-3 border-t bg-muted/30 text-sm text-muted-foreground flex items-center justify-between">
          <span>
            {filteredAndSortedData.length} de {data.length} registro(s)
          </span>
          {hasData && (
            <span className="text-xs">
              Total: {formatCurrency(filteredAndSortedData.reduce((acc, r) => acc + r.totalValue, 0))}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
