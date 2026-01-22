import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUnionLegalCases } from "@/hooks/useUnionLegal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Link } from "react-router-dom";
import { Plus, Search, FileText, Filter, Eye, Edit, Loader2 } from "lucide-react";
import {
  caseTypeLabels,
  caseStatusLabels,
  caseStatusColors,
  riskLevelLabels,
  riskLevelColors,
  LegalCaseStatus,
  LegalCaseType,
  LegalRiskLevel,
} from "@/types/unionLegal";

export default function UnionLegalCasesPage() {
  const { currentClinic } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const { cases, isLoading } = useUnionLegalCases(currentClinic?.id);

  const filteredCases = (cases || []).filter((c) => {
    const matchesSearch =
      c.case_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.plaintiff.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.defendant.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesType = typeFilter === "all" || c.case_type === typeFilter;
    const matchesRisk = riskFilter === "all" || c.risk_level === riskFilter;

    return matchesSearch && matchesStatus && matchesType && matchesRisk;
  });

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-7 w-7 text-blue-500" />
            Processos Judiciais
          </h1>
          <p className="text-muted-foreground">
            Gerenciamento de processos e ações judiciais
          </p>
        </div>
        <Button asChild>
          <Link to="/union/juridico/casos/novo">
            <Plus className="h-4 w-4 mr-2" />
            Novo Processo
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número, assunto, partes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {Object.entries(caseStatusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {Object.entries(caseTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Riscos</SelectItem>
                {Object.entries(riskLevelLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum processo encontrado</p>
              <Button asChild className="mt-4">
                <Link to="/union/juridico/casos/novo">
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Primeiro Processo
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Autor</TableHead>
                    <TableHead>Réu</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead>Valor da Causa</TableHead>
                    <TableHead>Distribuição</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCases.map((legalCase) => (
                    <TableRow key={legalCase.id}>
                      <TableCell className="font-mono text-sm">
                        {legalCase.case_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {caseTypeLabels[legalCase.case_type as LegalCaseType]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {legalCase.subject}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {legalCase.plaintiff}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate">
                        {legalCase.defendant}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={caseStatusColors[legalCase.status as LegalCaseStatus]}
                        >
                          {caseStatusLabels[legalCase.status as LegalCaseStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={riskLevelColors[legalCase.risk_level as LegalRiskLevel]}
                        >
                          {riskLevelLabels[legalCase.risk_level as LegalRiskLevel]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(legalCase.cause_value)}</TableCell>
                      <TableCell>{formatDate(legalCase.filing_date)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/union/juridico/casos/${legalCase.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/union/juridico/casos/${legalCase.id}/editar`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
