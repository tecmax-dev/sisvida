import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { AlertTriangle, Clock } from "lucide-react";
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
  negotiation_id: string | null;
  is_cancelled: boolean;
  cancelled_at: string | null;
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

type UnavailableReason = "not_found" | "expired" | "cancelled";

export default function NegotiationPreviewPage() {
  const { token } = useParams<{ token: string }>();
  const [preview, setPreview] = useState<NegotiationPreview | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [unionEntity, setUnionEntity] = useState<UnionEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<UnavailableReason | null>(null);

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
        setUnavailableReason("not_found");
        setError("Espelho de negociação não encontrado ou expirado.");
        setLoading(false);
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        setUnavailableReason("expired");
        setError("Este espelho de negociação expirou.");
        setLoading(false);
        return;
      }

      // Check if preview was marked as cancelled (via trigger on debt_negotiations)
      if (data.is_cancelled) {
        setUnavailableReason("cancelled");
        setError("Esta negociação foi cancelada e não está mais disponível.");
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
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length !== 14) return cnpj;
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-600"></div>
      </div>
    );
  }

  if (error || !preview) {
    const title =
      unavailableReason === "cancelled"
        ? "Negociação cancelada"
        : unavailableReason === "expired"
          ? "Link expirado"
          : "Link Inválido";

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
          {unavailableReason === "cancelled" && (
            <div className="mb-3 flex justify-center">
              <Badge variant="outline" className="text-xs">
                Status: Cancelada
              </Badge>
            </div>
          )}
          <p className="text-gray-600">
            {error || "Este espelho de negociação não existe ou expirou."}
          </p>
        </div>
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

  const entityName = unionEntity?.razao_social || clinic?.name || "";
  const entityCnpj = unionEntity?.cnpj || clinic?.cnpj || "";

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        
        {/* Header */}
        <header className="border-b pb-6 mb-6">
          <div className="flex items-start gap-4">
            {clinic?.logo_url && (
              <img 
                src={clinic.logo_url} 
                alt={entityName} 
                className="h-16 w-16 object-contain flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                {entityName}
              </h1>
              {entityCnpj && (
                <p className="text-sm text-gray-500 font-mono mt-0.5">
                  CNPJ: {formatCNPJ(entityCnpj)}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900">ESPELHO DE NEGOCIAÇÃO</h2>
              <Badge variant="outline" className="mt-1 text-xs bg-amber-50 text-amber-700 border-amber-200">
                Aguardando Aprovação
              </Badge>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
            <span>Emitido em: {format(new Date(preview.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Válido até {format(new Date(preview.expires_at), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </div>
        </header>

        {/* Empresa/Contribuinte */}
        <section className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contribuinte</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="font-semibold text-gray-900">{preview.employer_name}</p>
            <p className="text-sm text-gray-600 font-mono">CNPJ: {formatCNPJ(preview.employer_cnpj)}</p>
            {preview.employer_trade_name && (
              <p className="text-sm text-gray-500 mt-1">{preview.employer_trade_name}</p>
            )}
          </div>
        </section>

        {/* Contribuições */}
        <section className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contribuições Negociadas</h3>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-semibold">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold">Competência</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Original</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Atraso</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Encargos</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contributionsData.map((item: any, index: number) => (
                  <TableRow key={index} className="text-sm">
                    <TableCell className="py-2">{item.contribution_type_name}</TableCell>
                    <TableCell className="py-2">
                      {formatCompetence(item.competence_month, item.competence_year)}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{formatCurrency(item.original_value)}</TableCell>
                    <TableCell className="py-2 text-center">
                      <span className="text-xs text-gray-500">{item.days_overdue}d</span>
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums text-gray-600">
                      {formatCurrency(item.interest_value + item.correction_value + item.late_fee_value)}
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums font-medium">{formatCurrency(item.total_value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Resumo Financeiro */}
        <section className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Resumo Financeiro</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Valor Original Total</span>
              <span className="tabular-nums">{formatCurrency(preview.total_original_value)}</span>
            </div>
            {preview.total_interest > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Juros ({preview.interest_rate_monthly}% a.m.)</span>
                <span className="tabular-nums text-amber-600">+{formatCurrency(preview.total_interest)}</span>
              </div>
            )}
            {preview.total_correction > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Correção Monetária ({preview.monetary_correction_monthly}% a.m.)</span>
                <span className="tabular-nums text-blue-600">+{formatCurrency(preview.total_correction)}</span>
              </div>
            )}
            {preview.total_late_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Multa Moratória ({preview.late_fee_percentage}%)</span>
                <span className="tabular-nums text-red-600">+{formatCurrency(preview.total_late_fee)}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold text-base">
              <span>Valor Total Negociado</span>
              <span className="tabular-nums text-gray-900">{formatCurrency(preview.total_negotiated_value)}</span>
            </div>
          </div>
        </section>

        {/* Condições do Parcelamento */}
        <section className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Condições do Parcelamento</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {preview.down_payment > 0 && <th className="px-4 py-2 text-left font-semibold text-xs">Entrada</th>}
                  <th className="px-4 py-2 text-left font-semibold text-xs">Parcelas</th>
                  <th className="px-4 py-2 text-left font-semibold text-xs">Valor Parcela</th>
                  <th className="px-4 py-2 text-left font-semibold text-xs">1º Vencimento</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {preview.down_payment > 0 && <td className="px-4 py-3 font-medium tabular-nums">{formatCurrency(preview.down_payment)}</td>}
                  <td className="px-4 py-3 font-medium">{preview.installments_count}x</td>
                  <td className="px-4 py-3 font-medium tabular-nums">{formatCurrency(preview.installment_value)}</td>
                  <td className="px-4 py-3 font-medium">{format(firstDueDate, "dd/MM/yyyy")}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Cronograma */}
          {installmentsSchedule.length > 1 && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-2">Cronograma de vencimentos:</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 text-xs">
                {installmentsSchedule.map((inst) => (
                  <div key={inst.number} className="bg-gray-100 rounded px-2 py-1 text-center">
                    <span className="text-gray-500">{inst.number}ª</span>{" "}
                    <span className="font-medium">{format(inst.date, "dd/MM")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Legal Basis */}
        {preview.legal_basis && (
          <section className="mb-6">
            <p className="text-xs text-gray-500 italic leading-relaxed">
              <strong>Fundamentação:</strong> {preview.legal_basis}
            </p>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t pt-4 mt-8">
          <p className="text-xs text-gray-400 text-center">
            Este documento é uma simulação de negociação e não representa um acordo formalizado.
          </p>
          <p className="text-xs text-gray-400 text-center mt-1">
            {entityName} • {format(new Date(preview.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </p>
        </footer>
      </div>
    </div>
  );
}
