import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Printer, Download } from "lucide-react";
import { toast } from "sonner";
import {
  generateUnionContributionReceiptPDF,
  printUnionContributionReceipt,
  generateUnionReceiptNumber,
  type UnionContributionReceiptData,
} from "@/lib/unionContributionReceiptUtils";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  registration_number?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
}

interface Contribution {
  id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  paid_at: string | null;
  paid_value: number | null;
  payment_method: string | null;
  notes?: string | null;
  employers?: Employer;
  contribution_types?: ContributionType;
}

interface UnionEntity {
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  telefone?: string | null;
  email_contato?: string | null;
  logo_url?: string | null;
}

interface UnionContributionReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contribution: Contribution | null;
  unionEntity: UnionEntity | null;
}

export default function UnionContributionReceiptDialog({
  open,
  onOpenChange,
  contribution,
  unionEntity,
}: UnionContributionReceiptDialogProps) {
  const [occurrence, setOccurrence] = useState("");
  const [generating, setGenerating] = useState(false);

  if (!contribution || !contribution.paid_at || !contribution.employers) return null;

  const buildReceiptData = (): UnionContributionReceiptData => ({
    entity: {
      name: unionEntity?.razao_social || unionEntity?.nome_fantasia || "Entidade Sindical",
      cnpj: unionEntity?.cnpj,
      address: unionEntity?.endereco,
      city: unionEntity?.cidade,
      state: unionEntity?.estado,
      phone: unionEntity?.telefone,
      email: unionEntity?.email_contato,
      logo_url: unionEntity?.logo_url,
    },
    employer: {
      name: contribution.employers!.name,
      cnpj: contribution.employers!.cnpj,
      registration_number: contribution.employers!.registration_number,
    },
    contribution: {
      id: contribution.id,
      competence_month: contribution.competence_month,
      competence_year: contribution.competence_year,
      value: contribution.value,
      paid_value: contribution.paid_value || contribution.value,
      paid_at: contribution.paid_at!,
      payment_method: contribution.payment_method || "outros",
      contribution_type_name: contribution.contribution_types?.name || "Contribuição",
      notes: contribution.notes,
    },
    receiptNumber: generateUnionReceiptNumber(),
    occurrence: occurrence.trim() || undefined,
  });

  const handleDownloadPDF = async () => {
    setGenerating(true);
    try {
      const data = buildReceiptData();
      const { blob, fileName } = await generateUnionContributionReceiptPDF(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Recibo gerado com sucesso!");
    } catch (err) {
      console.error("Error generating receipt:", err);
      toast.error("Erro ao gerar recibo");
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    try {
      const data = buildReceiptData();
      printUnionContributionReceipt(data);
    } catch (err) {
      console.error("Error printing receipt:", err);
      toast.error("Erro ao imprimir recibo");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Recibo de Pagamento</DialogTitle>
          <DialogDescription>
            Recibo para a contribuição de {contribution.contribution_types?.name || "contribuição"} - {contribution.employers?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Competência</p>
              <p className="font-medium">
                {String(contribution.competence_month).padStart(2, "0")}/{contribution.competence_year}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Valor Pago</p>
              <p className="font-medium text-emerald-600">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                  (contribution.paid_value || contribution.value) / 100
                )}
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="occurrence">Ocorrência / Observações</Label>
            <Textarea
              id="occurrence"
              placeholder="Descreva a ocorrência ou observações para constar no recibo (ex: Pagamento realizado com atraso, baixa manual por depósito identificado...)"
              value={occurrence}
              onChange={(e) => setOccurrence(e.target.value)}
              rows={4}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Campo opcional. Se preenchido, será incluído no corpo do recibo.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button onClick={handleDownloadPDF} disabled={generating}>
            {generating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
