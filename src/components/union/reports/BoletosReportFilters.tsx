import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";

export type BoletoStatusFilter = "pending" | "overdue" | "paid" | "cancelled";

export interface BoletosReportFiltersState {
  periodoBase: "vencimento" | "geracao";
  dataInicio: string;
  dataFim: string;
  dataPagamentoInicio: string;
  dataPagamentoFim: string;
  competenciaMes: string; // "" = todos
  competenciaAno: string; // "" = todos
  status: BoletoStatusFilter[];
  associadoOuEmpresa: string;
  cpfCnpj: string;
  valorMin: string;
  valorMax: string;
  pagoNaoPago: "all" | "paid" | "unpaid";
  vencidoNaoVencido: "all" | "overdue" | "not_overdue";
}

export const defaultBoletosReportFilters: BoletosReportFiltersState = {
  periodoBase: "vencimento",
  dataInicio: "",
  dataFim: "",
  dataPagamentoInicio: "",
  dataPagamentoFim: "",
  competenciaMes: "",
  competenciaAno: "",
  status: [],
  associadoOuEmpresa: "",
  cpfCnpj: "",
  valorMin: "",
  valorMax: "",
  pagoNaoPago: "all",
  vencidoNaoVencido: "all",
};

const STATUS_OPTIONS: { value: BoletoStatusFilter; label: string }[] = [
  { value: "pending", label: "Pendente" },
  { value: "overdue", label: "Vencido" },
  { value: "paid", label: "Pago" },
  { value: "cancelled", label: "Cancelado" },
];

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props {
  filters: BoletosReportFiltersState;
  onFiltersChange: (f: BoletosReportFiltersState) => void;
  anosDisponiveis: number[];
}

export function BoletosReportFilters({ filters, onFiltersChange, anosDisponiveis }: Props) {
  const [expanded, setExpanded] = useState(true);

  const update = (patch: Partial<BoletosReportFiltersState>) =>
    onFiltersChange({ ...filters, ...patch });

  const toggleStatus = (s: BoletoStatusFilter) => {
    const has = filters.status.includes(s);
    update({ status: has ? filters.status.filter((x) => x !== s) : [...filters.status, s] });
  };

  const clearAll = () => onFiltersChange(defaultBoletosReportFilters);

  const activeCount = [
    filters.dataInicio, filters.dataFim, filters.dataPagamentoInicio, filters.dataPagamentoFim,
    filters.competenciaMes, filters.competenciaAno, filters.associadoOuEmpresa, filters.cpfCnpj,
    filters.valorMin, filters.valorMax,
  ].filter(Boolean).length + filters.status.length +
    (filters.pagoNaoPago !== "all" ? 1 : 0) +
    (filters.vencidoNaoVencido !== "all" ? 1 : 0);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <button
            className="flex items-center gap-2 text-sm font-medium text-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            <Filter className="h-4 w-4 text-primary" />
            Filtros
            {activeCount > 0 && (
              <span className="rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">
                {activeCount}
              </span>
            )}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="h-3.5 w-3.5 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>

        {expanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Período aplicado a</Label>
              <Select
                value={filters.periodoBase}
                onValueChange={(v) => update({ periodoBase: v as "vencimento" | "geracao" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vencimento">Data de vencimento</SelectItem>
                  <SelectItem value="geracao">Data de geração</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Vencimento de</Label>
              <Input type="date" value={filters.dataInicio} onChange={(e) => update({ dataInicio: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vencimento até</Label>
              <Input type="date" value={filters.dataFim} onChange={(e) => update({ dataFim: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Competência (mês)</Label>
              <Select value={filters.competenciaMes || "all"} onValueChange={(v) => update({ competenciaMes: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {MESES.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Competência (ano)</Label>
              <Select value={filters.competenciaAno || "all"} onValueChange={(v) => update({ competenciaAno: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {anosDisponiveis.map((a) => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Pagamento de</Label>
              <Input type="date" value={filters.dataPagamentoInicio} onChange={(e) => update({ dataPagamentoInicio: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pagamento até</Label>
              <Input type="date" value={filters.dataPagamentoFim} onChange={(e) => update({ dataPagamentoFim: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Pago / Não pago</Label>
              <Select value={filters.pagoNaoPago} onValueChange={(v) => update({ pagoNaoPago: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paid">Somente pagos</SelectItem>
                  <SelectItem value="unpaid">Somente não pagos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Vencido / Não vencido</Label>
              <Select value={filters.vencidoNaoVencido} onValueChange={(v) => update({ vencidoNaoVencido: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="overdue">Somente vencidos</SelectItem>
                  <SelectItem value="not_overdue">Somente não vencidos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Associado / Empresa</Label>
              <Input
                placeholder="Nome do sócio ou empresa"
                value={filters.associadoOuEmpresa}
                onChange={(e) => update({ associadoOuEmpresa: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CPF / CNPJ</Label>
              <Input
                placeholder="Somente números"
                value={filters.cpfCnpj}
                onChange={(e) => update({ cpfCnpj: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Valor mínimo (R$)</Label>
              <Input type="number" step="0.01" value={filters.valorMin} onChange={(e) => update({ valorMin: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor máximo (R$)</Label>
              <Input type="number" step="0.01" value={filters.valorMax} onChange={(e) => update({ valorMax: e.target.value })} />
            </div>

            <div className="space-y-1.5 md:col-span-2 lg:col-span-4">
              <Label className="text-xs">Status</Label>
              <div className="flex flex-wrap gap-4">
                {STATUS_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={filters.status.includes(opt.value)}
                      onCheckedChange={() => toggleStatus(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
