import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Loader2,
  FileText,
  FileSpreadsheet,
  Search,
  Filter,
  Users,
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Building2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUnionEntity } from "@/hooks/useUnionEntity";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

interface AssociadoRow {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  data_nascimento: string;
  sexo: string | null;
  cidade: string | null;
  uf: string | null;
  empresa: string | null;
  cargo: string | null;
  status: string;
  created_at: string;
  aprovado_at: string | null;
  rejeitado_at: string | null;
  motivo_rejeicao: string | null;
  empresa_razao_social: string | null;
  empresa_cnpj: string | null;
  matricula: string | null;
}

const statusOptions = [
  { value: "todos", label: "Todos os Status" },
  { value: "ativo", label: "Ativos" },
  { value: "pendente", label: "Pendentes" },
  { value: "rejeitado", label: "Rejeitados" },
  { value: "inativo", label: "Inativos" },
];

const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  ativo: { label: "Ativo", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  pendente: { label: "Pendente", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
  rejeitado: { label: "Rejeitado", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
  inativo: { label: "Inativo", className: "bg-muted text-muted-foreground", icon: UserX },
};

const formatCPF = (cpf: string) => {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const formatPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone;
};

export default function UnionMembersReportPage() {
  const { currentClinic } = useAuth();
  const { entity: unionEntity, loading: entityLoading } = useUnionEntity();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AssociadoRow[]>([]);
  const [generated, setGenerated] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateField, setDateField] = useState("created_at");
  const [searchText, setSearchText] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const fetchReport = useCallback(async () => {
    if (!unionEntity?.id) return;
    setLoading(true);
    setGenerated(false);

    try {
      let query = supabase
        .from("sindical_associados")
        .select("id, nome, cpf, email, telefone, data_nascimento, sexo, cidade, uf, empresa, cargo, status, created_at, aprovado_at, rejeitado_at, motivo_rejeicao, empresa_razao_social, empresa_cnpj, matricula")
        .eq("sindicato_id", unionEntity.id)
        .order("nome");

      if (statusFilter !== "todos") {
        query = query.eq("status", statusFilter);
      }

      if (dateFrom) {
        query = query.gte(dateField, dateFrom);
      }
      if (dateTo) {
        query = query.lte(dateField, dateTo + "T23:59:59");
      }

      const { data: result, error } = await query;
      if (error) throw error;

      setData(result || []);
      setGenerated(true);
      setCurrentPage(1);
    } catch (err: any) {
      console.error("Erro ao gerar relatório:", err);
      toast.error("Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  }, [unionEntity?.id, statusFilter, dateFrom, dateTo, dateField]);

  const filteredData = useMemo(() => {
    let result = [...data];

    if (searchText) {
      const s = searchText.toLowerCase();
      result = result.filter(
        (r) =>
          r.nome?.toLowerCase().includes(s) ||
          r.cpf?.includes(s) ||
          r.email?.toLowerCase().includes(s) ||
          r.telefone?.includes(s) ||
          r.empresa?.toLowerCase().includes(s) ||
          r.empresa_razao_social?.toLowerCase().includes(s)
      );
    }

    if (empresaFilter) {
      const e = empresaFilter.toLowerCase();
      result = result.filter(
        (r) =>
          r.empresa?.toLowerCase().includes(e) ||
          r.empresa_razao_social?.toLowerCase().includes(e) ||
          r.empresa_cnpj?.includes(e)
      );
    }

    return result;
  }, [data, searchText, empresaFilter]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  // Summary counts
  const summary = useMemo(() => {
    const counts = { ativo: 0, pendente: 0, rejeitado: 0, inativo: 0, total: 0 };
    filteredData.forEach((r) => {
      counts.total++;
      if (r.status in counts) counts[r.status as keyof typeof counts]++;
    });
    return counts;
  }, [filteredData]);

  const handleClearFilters = () => {
    setStatusFilter("todos");
    setDateFrom("");
    setDateTo("");
    setDateField("created_at");
    setSearchText("");
    setEmpresaFilter("");
  };

  const getFilterDescription = () => {
    const parts: string[] = [];
    if (statusFilter !== "todos") {
      parts.push(`Status: ${statusOptions.find((s) => s.value === statusFilter)?.label}`);
    }
    if (dateFrom || dateTo) {
      const fieldLabel = dateField === "created_at" ? "Cadastro" : dateField === "aprovado_at" ? "Aprovação" : "Rejeição";
      if (dateFrom && dateTo) parts.push(`${fieldLabel}: ${format(parseISO(dateFrom), "dd/MM/yyyy")} a ${format(parseISO(dateTo), "dd/MM/yyyy")}`);
      else if (dateFrom) parts.push(`${fieldLabel} a partir de: ${format(parseISO(dateFrom), "dd/MM/yyyy")}`);
      else parts.push(`${fieldLabel} até: ${format(parseISO(dateTo!), "dd/MM/yyyy")}`);
    }
    if (empresaFilter) parts.push(`Empresa: ${empresaFilter}`);
    return parts.length > 0 ? parts.join(" | ") : "Sem filtros aplicados";
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(16);
    doc.text("Relatório de Associados", pageWidth / 2, 15, { align: "center" });
    doc.setFontSize(10);
    doc.text(currentClinic?.name || "", pageWidth / 2, 22, { align: "center" });
    doc.setFontSize(8);
    doc.text(getFilterDescription(), pageWidth / 2, 28, { align: "center" });
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, 33, { align: "center" });

    // Summary
    doc.setFontSize(9);
    doc.text(`Total: ${summary.total} | Ativos: ${summary.ativo} | Pendentes: ${summary.pendente} | Rejeitados: ${summary.rejeitado} | Inativos: ${summary.inativo}`, 14, 40);

    const tableData = filteredData.map((r) => [
      r.matricula || "—",
      r.nome,
      formatCPF(r.cpf),
      r.telefone ? formatPhone(r.telefone) : "—",
      r.empresa_razao_social || r.empresa || "—",
      r.cidade && r.uf ? `${r.cidade}/${r.uf}` : r.cidade || r.uf || "—",
      statusConfig[r.status]?.label || r.status,
      r.created_at ? format(parseISO(r.created_at), "dd/MM/yyyy") : "—",
      r.aprovado_at ? format(parseISO(r.aprovado_at), "dd/MM/yyyy") : "—",
    ]);

    autoTable(doc, {
      startY: 45,
      head: [["Matrícula", "Nome", "CPF", "Telefone", "Empresa", "Cidade/UF", "Status", "Cadastro", "Aprovação"]],
      body: tableData,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save(`relatorio-associados-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF gerado com sucesso!");
  };

  const exportExcel = () => {
    const rows = filteredData.map((r) => ({
      Matrícula: r.matricula || "",
      Nome: r.nome,
      CPF: formatCPF(r.cpf),
      Email: r.email || "",
      Telefone: r.telefone ? formatPhone(r.telefone) : "",
      "Data Nascimento": r.data_nascimento ? format(parseISO(r.data_nascimento), "dd/MM/yyyy") : "",
      Sexo: r.sexo || "",
      Empresa: r.empresa_razao_social || r.empresa || "",
      CNPJ: r.empresa_cnpj || "",
      Cargo: r.cargo || "",
      Cidade: r.cidade || "",
      UF: r.uf || "",
      Status: statusConfig[r.status]?.label || r.status,
      "Data Cadastro": r.created_at ? format(parseISO(r.created_at), "dd/MM/yyyy HH:mm") : "",
      "Data Aprovação": r.aprovado_at ? format(parseISO(r.aprovado_at), "dd/MM/yyyy HH:mm") : "",
      "Data Rejeição": r.rejeitado_at ? format(parseISO(r.rejeitado_at), "dd/MM/yyyy HH:mm") : "",
      "Motivo Rejeição": r.motivo_rejeicao || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Associados");
    XLSX.writeFile(wb, `relatorio-associados-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Excel gerado com sucesso!");
  };

  if (entityLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Relatório de Associados
        </h1>
        <p className="text-muted-foreground">
          Relatório detalhado dos associados com filtros por status, período e empresa
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Campo de Data</Label>
              <Select value={dateField} onValueChange={setDateField}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Data de Cadastro</SelectItem>
                  <SelectItem value="aprovado_at">Data de Aprovação</SelectItem>
                  <SelectItem value="rejeitado_at">Data de Rejeição</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Data Início</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Data Fim</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Empresa</Label>
              <div className="relative">
                <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por empresa (razão social ou CNPJ)..."
                  value={empresaFilter}
                  onChange={(e) => setEmpresaFilter(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Button onClick={fetchReport} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Gerar Relatório
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {generated && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Total", value: summary.total, icon: Users, color: "text-foreground" },
              { label: "Ativos", value: summary.ativo, icon: CheckCircle2, color: "text-emerald-600" },
              { label: "Pendentes", value: summary.pendente, icon: Clock, color: "text-amber-600" },
              { label: "Rejeitados", value: summary.rejeitado, icon: XCircle, color: "text-red-600" },
              { label: "Inativos", value: summary.inativo, icon: UserX, color: "text-muted-foreground" },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-3 flex items-center gap-3">
                  <item.icon className={cn("h-5 w-5", item.color)} />
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className={cn("text-xl font-bold", item.color)}>{item.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Toolbar */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, CPF, empresa..."
                      value={searchText}
                      onChange={(e) => {
                        setSearchText(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={exportPDF} disabled={filteredData.length === 0}>
                    <FileText className="h-4 w-4 mr-1.5 text-rose-500" />
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportExcel} disabled={filteredData.length === 0}>
                    <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-500" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-auto" style={{ maxHeight: "500px" }}>
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead>Aprovação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Nenhum registro encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedData.map((row) => {
                        const sc = statusConfig[row.status];
                        const StatusIcon = sc?.icon || Users;
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono text-xs">{row.matricula || "—"}</TableCell>
                            <TableCell className="font-medium max-w-[200px] truncate">{row.nome}</TableCell>
                            <TableCell className="font-mono text-xs">{formatCPF(row.cpf)}</TableCell>
                            <TableCell className="text-xs">{row.telefone ? formatPhone(row.telefone) : "—"}</TableCell>
                            <TableCell className="max-w-[180px] truncate text-xs">
                              {row.empresa_razao_social || row.empresa || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.cidade && row.uf ? `${row.cidade}/${row.uf}` : row.cidade || row.uf || "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={cn("text-xs gap-1", sc?.className)}>
                                <StatusIcon className="h-3 w-3" />
                                {sc?.label || row.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.created_at ? format(parseISO(row.created_at), "dd/MM/yy") : "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.aprovado_at ? format(parseISO(row.aprovado_at), "dd/MM/yy") : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {filteredData.length} registro(s)
                  {searchText && ` (filtrado de ${data.length})`}
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      Anterior
                    </Button>
                    <span>
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Próximo
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
