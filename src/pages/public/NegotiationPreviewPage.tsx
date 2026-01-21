import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Building2, FileText, Calendar, DollarSign, AlertTriangle, Clock } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import { formatCompetence } from "@/lib/competence-format";

interface NegotiationPreview {
  id: string;
  access_token: string;
  employer_name: string;
  employer_cnpj: string;
  employer_trade_name: string | null;
  interest_rate_monthly: number;
  monetary_correction_monthly: number;
  late_fee_percentage: number;
  legal_basis: string | null;
  total_original_value: number;
  total_interest: number;
  total_correction: number;
  total_late_fee: number;
  total_negotiated_value: number;
  installments_count: number;
  installment_value: number;
  down_payment: number;
  first_due_date: string;
  contributions_data: unknown;
  custom_dates: unknown;
  created_at: string;
  expires_at: string;
  view_count: number;
  clinic_id: string;
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

export default function NegotiationPreviewPage() {
  const { token } = useParams<{ token: string }>();
  const [preview, setPreview] = useState<NegotiationPreview | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [unionEntity, setUnionEntity] = useState<UnionEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchPreview();
    }
  }, [token]);

  const fetchPreview = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("negotiation_previews")
        .select("*")
        .eq("access_token", token)
        .single();

      if (fetchError || !data) {
        setError("Espelho de negociação não encontrado ou expirado.");
        setLoading(false);
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        setError("Este espelho de negociação expirou.");
        setLoading(false);
        return;
      }

      setPreview(data as NegotiationPreview);

      // Update view count
      await supabase
        .from("negotiation_previews")
        .update({ 
          view_count: (data.view_count || 0) + 1,
          viewed_at: new Date().toISOString()
        })
        .eq("id", data.id);

      // Fetch clinic info
      const { data: clinicData } = await supabase
        .from("clinics")
        .select("id, name, cnpj, address, city, state_code, logo_url")
        .eq("id", data.clinic_id)
        .single();

      if (clinicData) setClinic(clinicData);

      // Fetch union entity
      const { data: entityData } = await supabase
        .from("union_entities")
        .select("id, razao_social, cnpj")
        .eq("clinic_id", data.clinic_id)
        .eq("status", "ativa")
        .single();

      if (entityData) setUnionEntity(entityData);

    } catch (err) {
      setError("Erro ao carregar espelho de negociação.");
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">Link Inválido</h2>
              <p className="text-muted-foreground">
                {error || "Este espelho de negociação não existe ou expirou."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Generate installments schedule
  const firstDueDate = parseDateOnlyToLocalNoon(preview.first_due_date);
  const customDates = (preview.custom_dates || {}) as Record<string, string>;
  const contributionsData = (preview.contributions_data || []) as any[];
  const installmentsSchedule = [];
  
  for (let i = 1; i <= preview.installments_count; i++) {
    const autoDate = addMonths(firstDueDate, i - 1);
    const customDateStr = customDates[i.toString()];
    const customDate = customDateStr ? parseDateOnlyToLocalNoon(customDateStr) : null;
    const installmentDate = customDate || autoDate;
    
    installmentsSchedule.push({
      number: i,
      date: installmentDate,
      value: preview.installment_value,
      isCustom: !!customDate,
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with Logo */}
        <div className="text-center space-y-4">
          {clinic?.logo_url && (
            <div className="flex justify-center">
              <img 
                src={clinic.logo_url} 
                alt={unionEntity?.razao_social || clinic?.name || "Logo da Entidade"} 
                className="h-20 w-auto object-contain"
              />
            </div>
          )}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Espelho de Negociação de Contribuições Sindicais
            </h1>
            <Badge variant="outline" className="bg-purple-500/15 text-purple-700">
              Simulação - Aguardando Aprovação
            </Badge>
            <p className="text-sm text-muted-foreground">
              Gerado em {format(new Date(preview.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              Válido até {format(new Date(preview.expires_at), "dd/MM/yyyy", { locale: ptBR })}
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
                <span className="font-mono">
                  {(unionEntity?.cnpj || clinic?.cnpj) ? formatCNPJ(unionEntity?.cnpj || clinic?.cnpj || "") : "-"}
                </span>
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
                <span className="font-medium">{preview.employer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CNPJ</span>
                <span className="font-mono">{formatCNPJ(preview.employer_cnpj)}</span>
              </div>
              {preview.employer_trade_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome Fantasia</span>
                  <span>{preview.employer_trade_name}</span>
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
            <div className="overflow-x-auto">
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
                  {contributionsData.map((item: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="text-sm">{item.contribution_type_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {formatCompetence(item.competence_month, item.competence_year)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.original_value)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="destructive" className="text-xs">{item.days_overdue}d</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(item.interest_value + item.correction_value + item.late_fee_value)}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.total_value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
                <span>{formatCurrency(preview.total_original_value)}</span>
              </div>
              <div className="flex justify-between text-amber-600">
                <span>Juros ({preview.interest_rate_monthly}% a.m.)</span>
                <span>+{formatCurrency(preview.total_interest)}</span>
              </div>
              <div className="flex justify-between text-blue-600">
                <span>Correção Monetária ({preview.monetary_correction_monthly}% a.m.)</span>
                <span>+{formatCurrency(preview.total_correction)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Multa Moratória ({preview.late_fee_percentage}%)</span>
                <span>+{formatCurrency(preview.total_late_fee)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Valor Total Negociado</span>
                <span className="text-primary">{formatCurrency(preview.total_negotiated_value)}</span>
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
                {preview.down_payment > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entrada</span>
                    <span className="font-medium">{formatCurrency(preview.down_payment)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parcelas</span>
                  <span className="font-medium">{preview.installments_count}x de {formatCurrency(preview.installment_value)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Primeiro Vencimento</span>
                  <span className="font-medium">{format(firstDueDate, "dd/MM/yyyy")}</span>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <h4 className="font-medium text-sm">Cronograma de Parcelas</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-sm">
                {installmentsSchedule.map((inst) => (
                  <div key={inst.number} className="flex justify-between p-2 bg-muted/50 rounded">
                    <span className="text-muted-foreground">{inst.number}ª</span>
                    <span>{format(inst.date, "dd/MM/yyyy")}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legal Basis */}
        {preview.legal_basis && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground italic">
                <strong>Fundamentação:</strong> {preview.legal_basis}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4">
          <p>Este documento é uma simulação de negociação e não representa um acordo formalizado.</p>
          <p>Para formalizar, entre em contato com a entidade sindical.</p>
        </div>
      </div>
    </div>
  );
}
