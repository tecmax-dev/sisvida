import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, FileText, Calendar, DollarSign, Printer, Download } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name: string | null;
}

interface Contribution {
  id: string;
  value: number;
  competence_month: number;
  competence_year: number;
  due_date: string;
  contribution_types?: {
    id: string;
    name: string;
  };
}

interface CalculatedItem {
  contribution: Contribution;
  daysOverdue: number;
  interestValue: number;
  correctionValue: number;
  lateFeeValue: number;
  totalValue: number;
}

interface NegotiationSettings {
  interest_rate_monthly: number;
  monetary_correction_monthly: number;
  late_fee_percentage: number;
  legal_basis: string;
}

interface Clinic {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state_code: string | null;
}

interface NegotiationStepPreviewProps {
  employer: Employer;
  calculatedItems: CalculatedItem[];
  settings: NegotiationSettings;
  totals: {
    originalValue: number;
    totalInterest: number;
    totalCorrection: number;
    totalLateFee: number;
    totalNegotiated: number;
    installmentValue: number;
  };
  installmentsCount: number;
  downPayment: number;
  firstDueDate: Date;
  clinicId: string;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function NegotiationStepPreview({
  employer,
  calculatedItems,
  settings,
  totals,
  installmentsCount,
  downPayment,
  firstDueDate,
  clinicId,
}: NegotiationStepPreviewProps) {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchClinic();
  }, [clinicId]);

  const fetchClinic = async () => {
    const { data } = await supabase
      .from("clinics")
      .select("id, name, cnpj, address, city, state_code")
      .eq("id", clinicId)
      .single();

    if (data) setClinic(data);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  // Generate installments schedule
  const installmentsSchedule = [];
  let currentDate = new Date(firstDueDate);
  for (let i = 1; i <= installmentsCount; i++) {
    installmentsSchedule.push({
      number: i,
      date: new Date(currentDate),
      value: totals.installmentValue,
    });
    currentDate = addMonths(currentDate, 1);
  }

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("ESPELHO DE NEGOCIAÇÃO DE CONTRIBUIÇÕES SINDICAIS", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Simulação de Negociação - Aguardando Aprovação", pageWidth / 2, 28, { align: "center" });
    doc.text(`Data: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 34, { align: "center" });

    // Entidade Sindical
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ENTIDADE SINDICAL", 14, 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Nome: ${clinic?.name || "-"}`, 14, 55);
    doc.text(`CNPJ: ${clinic?.cnpj ? formatCNPJ(clinic.cnpj) : "-"}`, 14, 61);
    if (clinic?.address) {
      doc.text(`Endereço: ${clinic.address}${clinic.city ? `, ${clinic.city}` : ""}${clinic.state_code ? ` - ${clinic.state_code}` : ""}`, 14, 67);
    }

    // Contribuinte
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("CONTRIBUINTE", 14, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Razão Social: ${employer.name}`, 14, 87);
    doc.text(`CNPJ: ${formatCNPJ(employer.cnpj)}`, 14, 93);
    if (employer.trade_name) {
      doc.text(`Nome Fantasia: ${employer.trade_name}`, 14, 99);
    }

    // Contribuições
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("CONTRIBUIÇÕES NEGOCIADAS", 14, 112);

    const contributionsData = calculatedItems.map((item) => [
      item.contribution.contribution_types?.name || "-",
      `${MONTHS[item.contribution.competence_month - 1]}/${item.contribution.competence_year}`,
      format(new Date(item.contribution.due_date), "dd/MM/yyyy"),
      formatCurrency(item.contribution.value),
      `${item.daysOverdue} dias`,
      formatCurrency(item.interestValue + item.correctionValue + item.lateFeeValue),
      formatCurrency(item.totalValue),
    ]);

    autoTable(doc, {
      startY: 116,
      head: [["Tipo", "Competência", "Vencimento", "Original", "Atraso", "Encargos", "Total"]],
      body: contributionsData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Resumo financeiro
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMO FINANCEIRO", 14, finalY);
    
    const summaryData = [
      ["Valor Original Total", formatCurrency(totals.originalValue)],
      ["Total de Juros", formatCurrency(totals.totalInterest)],
      ["Total de Correção Monetária", formatCurrency(totals.totalCorrection)],
      ["Total de Multa Moratória", formatCurrency(totals.totalLateFee)],
      ["VALOR TOTAL NEGOCIADO", formatCurrency(totals.totalNegotiated)],
    ];

    autoTable(doc, {
      startY: finalY + 4,
      body: summaryData,
      theme: "plain",
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: "right" } },
    });

    // Condições
    const conditionsY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("CONDIÇÕES DO PARCELAMENTO", 14, conditionsY);
    
    const conditionsData = [
      ["Valor de Entrada", formatCurrency(downPayment)],
      ["Quantidade de Parcelas", `${installmentsCount}x`],
      ["Valor de Cada Parcela", formatCurrency(totals.installmentValue)],
      ["Primeira Parcela", format(firstDueDate, "dd/MM/yyyy")],
    ];

    autoTable(doc, {
      startY: conditionsY + 4,
      body: conditionsData,
      theme: "plain",
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: "right" } },
    });

    // Legal basis
    if (settings.legal_basis) {
      const legalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      const splitText = doc.splitTextToSize(`Fundamentação: ${settings.legal_basis}`, pageWidth - 28);
      doc.text(splitText, 14, legalY);
    }

    doc.save(`espelho-negociacao-${employer.cnpj}-${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  return (
    <div className="space-y-6" ref={printRef}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">Espelho de Negociação de Contribuições Sindicais</h2>
        <Badge variant="outline" className="bg-purple-500/15 text-purple-700">
          Simulação - Aguardando Aprovação
        </Badge>
        <p className="text-sm text-muted-foreground">
          Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>

      {/* Entidade Sindical */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Entidade Sindical
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium">{clinic?.name || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CNPJ</span>
              <span className="font-mono">{clinic?.cnpj ? formatCNPJ(clinic.cnpj) : "-"}</span>
            </div>
            {clinic?.address && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Endereço</span>
                <span>{clinic.address}{clinic.city ? `, ${clinic.city}` : ""}{clinic.state_code ? ` - ${clinic.state_code}` : ""}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contribuinte */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Contribuinte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Razão Social</span>
              <span className="font-medium">{employer.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CNPJ</span>
              <span className="font-mono">{formatCNPJ(employer.cnpj)}</span>
            </div>
            {employer.trade_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nome Fantasia</span>
                <span>{employer.trade_name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contribuições Detalhadas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Contribuições Negociadas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead className="text-right">Original</TableHead>
                <TableHead className="text-center">Atraso</TableHead>
                <TableHead className="text-right">Encargos</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculatedItems.map((item) => (
                <TableRow key={item.contribution.id}>
                  <TableCell className="text-sm">{item.contribution.contribution_types?.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {MONTHS[item.contribution.competence_month - 1]}/{item.contribution.competence_year}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(item.contribution.value)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="destructive" className="text-xs">{item.daysOverdue}d</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(item.interestValue + item.correctionValue + item.lateFeeValue)}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.totalValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Resumo Financeiro */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Resumo Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Valor Original Total</span>
              <span>{formatCurrency(totals.originalValue)}</span>
            </div>
            <div className="flex justify-between text-amber-600">
              <span>Juros ({settings.interest_rate_monthly}% a.m.)</span>
              <span>+{formatCurrency(totals.totalInterest)}</span>
            </div>
            <div className="flex justify-between text-blue-600">
              <span>Correção Monetária ({settings.monetary_correction_monthly}% a.m.)</span>
              <span>+{formatCurrency(totals.totalCorrection)}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Multa Moratória ({settings.late_fee_percentage}%)</span>
              <span>+{formatCurrency(totals.totalLateFee)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Valor Total Negociado</span>
              <span className="text-primary">{formatCurrency(totals.totalNegotiated)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Condições do Parcelamento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Condições do Parcelamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              {downPayment > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entrada</span>
                  <span className="font-medium">{formatCurrency(downPayment)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parcelas</span>
                <span className="font-medium">{installmentsCount}x de {formatCurrency(totals.installmentValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Primeira Parcela</span>
                <span className="font-medium">{format(firstDueDate, "dd/MM/yyyy")}</span>
              </div>
            </div>
            <div className="space-y-1 max-h-[150px] overflow-y-auto text-xs">
              {installmentsSchedule.slice(0, 12).map((inst) => (
                <div key={inst.number} className="flex justify-between p-1 rounded bg-muted">
                  <span>Parcela {inst.number}</span>
                  <span>{format(inst.date, "dd/MM/yyyy")} - {formatCurrency(inst.value)}</span>
                </div>
              ))}
              {installmentsCount > 12 && (
                <div className="text-center text-muted-foreground">
                  ... e mais {installmentsCount - 12} parcela(s)
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal Basis */}
      {settings.legal_basis && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm italic text-muted-foreground">
              <strong>Fundamentação:</strong> {settings.legal_basis}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Export Button */}
      <div className="flex justify-center gap-2">
        <Button variant="outline" onClick={handleExportPDF}>
          <Download className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
      </div>
    </div>
  );
}
