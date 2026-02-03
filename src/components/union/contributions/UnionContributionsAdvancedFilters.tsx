import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Filter, RotateCcw, Search } from "lucide-react";
import { getStaticYearRange } from "@/hooks/useAvailableYears";

interface FilterState {
  search: string;
  status: string;
  competence: string;
  contributionType: string;
  dueDateStart: string;
  dueDateEnd: string;
  paymentDateStart: string;
  paymentDateEnd: string;
}

interface ContributionType {
  id: string;
  name: string;
}

interface UnionContributionsAdvancedFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  contributionTypes: ContributionType[];
  onSearch: () => void;
  resultCount: number;
}

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "hide_cancelled", label: "Ocultar Cancelados" },
  { value: "paid", label: "Pago" },
  { value: "pending", label: "Pendente" },
  { value: "overdue", label: "Vencido" },
  { value: "cancelled", label: "Cancelado" },
  { value: "awaiting_value", label: "Aguardando Valor" },
];

export default function UnionContributionsAdvancedFilters({
  filters,
  onFiltersChange,
  contributionTypes,
  onSearch,
  resultCount,
}: UnionContributionsAdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleClear = () => {
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    
    onFiltersChange({
      search: "",
      status: "hide_cancelled",
      competence: `${String(prevMonth).padStart(2, "0")}/${prevYear}`,
      contributionType: "all",
      dueDateStart: "",
      dueDateEnd: "",
      paymentDateStart: "",
      paymentDateEnd: "",
    });
  };

  const updateFilter = (key: keyof FilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border/60 bg-card shadow-sm">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Filter className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Filtros Avançados</h3>
                <p className="text-xs text-muted-foreground">
                  {resultCount} registro{resultCount !== 1 ? "s" : ""} encontrado{resultCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                {resultCount}
              </Badge>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-4">
            {/* Row 1: Search and basic filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome, CNPJ, matrícula..."
                    value={filters.search}
                    onChange={(e) => updateFilter("search", e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Situação</Label>
                <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Tipo de Contribuição</Label>
                <Select value={filters.contributionType} onValueChange={(v) => updateFilter("contributionType", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {contributionTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Competence and date filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Competência</Label>
                <Select value={filters.competence} onValueChange={(v) => updateFilter("competence", v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Todas</SelectItem>
                    {getStaticYearRange().flatMap((year) =>
                      Array.from({ length: 12 }, (_, i) => 12 - i).map((month) => {
                        const key = `${String(month).padStart(2, "0")}/${year}`;
                        return (
                          <SelectItem key={key} value={key}>
                            {key}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Venc. Início</Label>
                <Input
                  type="date"
                  value={filters.dueDateStart}
                  onChange={(e) => updateFilter("dueDateStart", e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Venc. Fim</Label>
                <Input
                  type="date"
                  value={filters.dueDateEnd}
                  onChange={(e) => updateFilter("dueDateEnd", e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Pgto. Início</Label>
                <Input
                  type="date"
                  value={filters.paymentDateStart}
                  onChange={(e) => updateFilter("paymentDateStart", e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Pgto. Fim</Label>
                <Input
                  type="date"
                  value={filters.paymentDateEnd}
                  onChange={(e) => updateFilter("paymentDateEnd", e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <Button variant="ghost" size="sm" onClick={handleClear} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Limpar Filtros
              </Button>
              <Button size="sm" onClick={onSearch} className="gap-2">
                <Search className="h-4 w-4" />
                Pesquisar
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
