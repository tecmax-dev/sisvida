import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface BoletosPrintColumn {
  key: "associado" | "cpfCnpj" | "competencia" | "vencimento" | "valor" | "valorPago" | "dataPagamento" | "status";
  label: string;
}

export const ALL_BOLETOS_PRINT_COLUMNS: BoletosPrintColumn[] = [
  { key: "associado", label: "Associado / Empresa" },
  { key: "cpfCnpj", label: "CPF / CNPJ" },
  { key: "competencia", label: "Competência" },
  { key: "vencimento", label: "Vencimento" },
  { key: "valor", label: "Valor" },
  { key: "valorPago", label: "Valor Pago" },
  { key: "dataPagamento", label: "Data Pagamento" },
  { key: "status", label: "Status" },
];

export interface BoletosPrintConfig {
  tipo: "resumido" | "detalhado";
  colunas: BoletosPrintColumn["key"][];
  ordenacao: "nome" | "vencimento" | "pagamento" | "valor" | "status";
  incluirCards: boolean;
  incluirGrafico: boolean;
  orientacao: "portrait" | "landscape";
  incluirFiltros: boolean;
}

export const defaultBoletosPrintConfig: BoletosPrintConfig = {
  tipo: "detalhado",
  colunas: ALL_BOLETOS_PRINT_COLUMNS.map((c) => c.key),
  ordenacao: "vencimento",
  incluirCards: true,
  incluirGrafico: true,
  orientacao: "landscape",
  incluirFiltros: true,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (config: BoletosPrintConfig) => void;
}

export function BoletosPrintConfigDialog({ open, onOpenChange, onConfirm }: Props) {
  const [config, setConfig] = useState<BoletosPrintConfig>(defaultBoletosPrintConfig);

  const toggleColumn = (key: BoletosPrintColumn["key"]) => {
    setConfig((prev) => ({
      ...prev,
      colunas: prev.colunas.includes(key)
        ? prev.colunas.filter((c) => c !== key)
        : [...prev.colunas, key],
    }));
  };

  const handleConfirm = () => {
    onConfirm(config);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar Impressão do Relatório</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo de relatório</Label>
            <RadioGroup
              value={config.tipo}
              onValueChange={(v) => setConfig((p) => ({ ...p, tipo: v as any }))}
              className="flex gap-6"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="resumido" /> Resumido
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="detalhado" /> Detalhado
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Colunas visíveis</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_BOLETOS_PRINT_COLUMNS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={config.colunas.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Ordenar por</Label>
            <Select
              value={config.ordenacao}
              onValueChange={(v) => setConfig((p) => ({ ...p, ordenacao: v as any }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nome">Nome</SelectItem>
                <SelectItem value="vencimento">Vencimento</SelectItem>
                <SelectItem value="pagamento">Data de pagamento</SelectItem>
                <SelectItem value="valor">Valor</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Orientação da página</Label>
            <RadioGroup
              value={config.orientacao}
              onValueChange={(v) => setConfig((p) => ({ ...p, orientacao: v as any }))}
              className="flex gap-6"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="portrait" /> Retrato
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="landscape" /> Paisagem
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={config.incluirCards}
                onCheckedChange={(v) => setConfig((p) => ({ ...p, incluirCards: !!v }))}
              />
              Incluir cards de totais
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={config.incluirGrafico}
                onCheckedChange={(v) => setConfig((p) => ({ ...p, incluirGrafico: !!v }))}
              />
              Incluir gráfico
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={config.incluirFiltros}
                onCheckedChange={(v) => setConfig((p) => ({ ...p, incluirFiltros: !!v }))}
              />
              Incluir filtros aplicados no cabeçalho
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm}>Gerar Relatório</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
