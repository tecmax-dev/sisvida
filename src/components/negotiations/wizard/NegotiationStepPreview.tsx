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
import { Building2, FileText, Calendar, DollarSign, Download, Link2, Check, Copy, Loader2 } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import { toast } from "sonner";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name: string | null;
  registration_number?: string | null;
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
  logo_url: string | null;
}

interface UnionEntity {
  id: string;
  razao_social: string;
  cnpj: string | null;
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
  customDates?: Record<number, Date>;
}

import { formatCompetence } from "@/lib/competence-format";

export default function NegotiationStepPreview({
  employer,
  calculatedItems,
  settings,
  totals,
  installmentsCount,
  downPayment,
  firstDueDate,
  clinicId,
  customDates = {},
}: NegotiationStepPreviewProps) {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [unionEntity, setUnionEntity] = useState<UnionEntity | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Normalize to midday to prevent timezone shifting (e.g. showing 06/01 instead of 07/01)
  const safeFirstDueDate = new Date(firstDueDate);
  safeFirstDueDate.setHours(12, 0, 0, 0);

  useEffect(() => {
    fetchClinicAndEntity();
  }, [clinicId]);

  const fetchClinicAndEntity = async () => {
    // Fetch clinic with logo
    const { data: clinicData } = await supabase
      .from("clinics")
      .select("id, name, cnpj, address, city, state_code, logo_url")
      .eq("id", clinicId)
      .single();

    if (clinicData) setClinic(clinicData);

    // Fetch union entity linked to this clinic
    const { data: entityData } = await supabase
      .from("union_entities")
      .select("id, razao_social, cnpj")
      .eq("clinic_id", clinicId)
      .eq("status", "ativa")
      .single();

    if (entityData) setUnionEntity(entityData as UnionEntity);
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

  // Generate installments schedule with custom dates support
  const installmentsSchedule = [];
  for (let i = 1; i <= installmentsCount; i++) {
    const autoDate = addMonths(safeFirstDueDate, i - 1);
    const customDate = customDates[i];
    const isCustom = !!customDate;
    const installmentDate = customDate || autoDate;
    
    installmentsSchedule.push({
      number: i,
      date: installmentDate,
      value: totals.installmentValue,
      isCustom,
    });
  }

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    let startY = 20;
    
    // Add logo if available (from clinic)
    if (clinic?.logo_url) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = clinic.logo_url!;
        });
        
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        const imgData = canvas.toDataURL("image/png");
        
        // Center logo at top
        const logoWidth = 40;
        const logoHeight = (img.height / img.width) * logoWidth;
        doc.addImage(imgData, "PNG", (pageWidth - logoWidth) / 2, 10, logoWidth, logoHeight);
        startY = 15 + logoHeight + 5;
      } catch (error) {
        console.error("Error loading logo for PDF:", error);
      }
    }
    
    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("ESPELHO DE NEGOCIAÇÃO DE CONTRIBUIÇÕES SINDICAIS", pageWidth / 2, startY, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Simulação de Negociação - Aguardando Aprovação", pageWidth / 2, startY + 8, { align: "center" });
    doc.text(`Data: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, startY + 14, { align: "center" });

    const entityStartY = startY + 28;
    
    // Entidade Sindical
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ENTIDADE SINDICAL", 14, entityStartY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const entityName = unionEntity?.razao_social || clinic?.name || "-";
    const entityCnpj = unionEntity?.cnpj || clinic?.cnpj;
    doc.text(`Nome: ${entityName}`, 14, entityStartY + 7);
    doc.text(`CNPJ: ${entityCnpj ? formatCNPJ(entityCnpj) : "-"}`, 14, entityStartY + 13);
    if (clinic?.address) {
      doc.text(`Endereço: ${clinic.address}${clinic.city ? `, ${clinic.city}` : ""}${clinic.state_code ? ` - ${clinic.state_code}` : ""}`, 14, entityStartY + 19);
    }

    const contribuinteStartY = entityStartY + (clinic?.address ? 32 : 26);
    
    // Empresa
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("EMPRESA", 14, contribuinteStartY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Razão Social: ${employer.name}`, 14, contribuinteStartY + 7);
    doc.text(`CNPJ: ${formatCNPJ(employer.cnpj)}`, 14, contribuinteStartY + 13);
    if (employer.trade_name) {
      doc.text(`Nome Fantasia: ${employer.trade_name}`, 14, contribuinteStartY + 19);
    }

    const contribTableStartY = contribuinteStartY + (employer.trade_name ? 32 : 26);
    
    // Contribuições
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("CONTRIBUIÇÕES NEGOCIADAS", 14, contribTableStartY);

    const contributionsData = calculatedItems.map((item) => [
      item.contribution.contribution_types?.name || "-",
      formatCompetence(item.contribution.competence_month, item.contribution.competence_year),
      format(parseDateOnlyToLocalNoon(item.contribution.due_date), "dd/MM/yyyy"),
      formatCurrency(item.contribution.value),
      `${item.daysOverdue} dias`,
      formatCurrency(item.interestValue + item.correctionValue + item.lateFeeValue),
      formatCurrency(item.totalValue),
    ]);

    autoTable(doc, {
      startY: contribTableStartY + 4,
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
      ["Primeira Parcela", format(safeFirstDueDate, "dd/MM/yyyy")],
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

  const generateAccessToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    try {
      const accessToken = generateAccessToken();
      
      // Prepare contributions data snapshot
      const contributionsSnapshot = calculatedItems.map(item => ({
        contribution_id: item.contribution.id,
        contribution_type_name: item.contribution.contribution_types?.name || "N/A",
        competence_month: item.contribution.competence_month,
        competence_year: item.contribution.competence_year,
        due_date: item.contribution.due_date,
        original_value: item.contribution.value,
        days_overdue: item.daysOverdue,
        interest_value: item.interestValue,
        correction_value: item.correctionValue,
        late_fee_value: item.lateFeeValue,
        total_value: item.totalValue,
      }));

      // Convert custom dates to ISO strings for storage
      const customDatesForStorage: Record<string, string> = {};
      Object.entries(customDates).forEach(([key, date]) => {
        customDatesForStorage[key] = format(date, "yyyy-MM-dd");
      });

      const { error } = await supabase
        .from("negotiation_previews")
        .insert({
          clinic_id: clinicId,
          employer_id: employer.id,
          access_token: accessToken,
          employer_name: employer.name,
          employer_cnpj: employer.cnpj,
          employer_trade_name: employer.trade_name,
          interest_rate_monthly: settings.interest_rate_monthly,
          monetary_correction_monthly: settings.monetary_correction_monthly,
          late_fee_percentage: settings.late_fee_percentage,
          legal_basis: settings.legal_basis || null,
          total_original_value: totals.originalValue,
          total_interest: totals.totalInterest,
          total_correction: totals.totalCorrection,
          total_late_fee: totals.totalLateFee,
          total_negotiated_value: totals.totalNegotiated,
          installments_count: installmentsCount,
          installment_value: totals.installmentValue,
          down_payment: downPayment,
          first_due_date: format(safeFirstDueDate, "yyyy-MM-dd"),
          contributions_data: contributionsSnapshot,
          custom_dates: Object.keys(customDatesForStorage).length > 0 ? customDatesForStorage : null,
        });

      if (error) {
        console.error("Error creating preview:", error);
        toast.error("Erro ao gerar link");
        return;
      }

      const baseUrl = window.location.origin;
      const link = `${baseUrl}/negociacao-espelho/${accessToken}`;
      setGeneratedLink(link);
      toast.success("Link gerado com sucesso!");
    } catch (err) {
      console.error("Error generating link:", err);
      toast.error("Erro ao gerar link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  return (
    <div className="space-y-6" ref={printRef}>
      {/* Header with Logo */}
      <div className="text-center space-y-4">
        {clinic?.logo_url && (
          <div className="flex justify-center">
            <img 
              src={clinic.logo_url} 
              alt={unionEntity?.razao_social || clinic?.name || "Logo da Entidade"} 
              className="h-16 w-auto object-contain"
            />
          </div>
        )}
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Espelho de Negociação de Contribuições Sindicais</h2>
          <Badge variant="outline" className="bg-purple-500/15 text-purple-700">
            Simulação - Aguardando Aprovação
          </Badge>
          <p className="text-sm text-muted-foreground">
            Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
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
              <span className="font-medium">{unionEntity?.razao_social || clinic?.name || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">CNPJ</span>
              <span className="font-mono">{(unionEntity?.cnpj || clinic?.cnpj) ? formatCNPJ(unionEntity?.cnpj || clinic?.cnpj || "") : "-"}</span>
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

      {/* Empresa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Empresa
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
                      {formatCompetence(item.contribution.competence_month, item.contribution.competence_year)}
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
                <span className="font-medium">{format(safeFirstDueDate, "dd/MM/yyyy")}</span>
              </div>
            </div>
            <div className="space-y-1 max-h-[150px] overflow-y-auto text-xs">
              {installmentsSchedule.slice(0, 12).map((inst) => (
                <div 
                  key={inst.number} 
                  className={cn(
                    "flex justify-between p-1 rounded",
                    inst.isCustom 
                      ? "bg-amber-100 dark:bg-amber-950/30" 
                      : "bg-muted"
                  )}
                >
                  <span>
                    Parcela {inst.number}
                    {inst.isCustom && <span className="text-amber-600 ml-1">*</span>}
                  </span>
                  <span>{format(inst.date, "dd/MM/yyyy")} - {formatCurrency(inst.value)}</span>
                </div>
              ))}
              {installmentsCount > 12 && (
                <div className="text-center text-muted-foreground">
                  ... e mais {installmentsCount - 12} parcela(s)
                </div>
              )}
              {Object.keys(customDates).length > 0 && (
                <p className="text-amber-600 text-center mt-2">* Datas personalizadas</p>
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

      {/* Export Buttons */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
          <Button 
            variant="outline" 
            onClick={handleGenerateLink}
            disabled={generatingLink}
          >
            {generatingLink ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4 mr-2" />
            )}
            Gerar Link
          </Button>
        </div>
        
        {generatedLink && (
          <div className="w-full max-w-lg p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground mb-2 text-center">
              Link válido por 30 dias:
            </p>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={generatedLink} 
                readOnly 
                className="flex-1 px-3 py-1.5 text-sm bg-background border rounded-md"
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCopyLink}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
