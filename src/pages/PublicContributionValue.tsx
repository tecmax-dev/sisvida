import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Calendar, DollarSign, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface ContributionData {
  id: string;
  status: string;
  value: number;
  due_date: string;
  competence_month: number;
  competence_year: number;
  lytex_invoice_url: string | null;
  employer_id?: string | null;
  contribution_type_id?: string | null;
  clinic_id?: string | null;
  employer: {
    id: string;
    name: string;
    cnpj: string;
  } | null;
  contribution_type: {
    name: string;
    default_value: number;
  } | null;
  clinic: {
    name: string;
    logo_url: string | null;
  } | null;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, "");
  return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export default function PublicContributionValue() {
  const { token, "*": splatToken } = useParams<{ token?: string; "*"?: string }>();
  // Support both normal :token and splat /* (for legacy tokens containing slashes)
  const rawToken = token || splatToken || "";
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [contribution, setContribution] = useState<ContributionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [success, setSuccess] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [types, setTypes] = useState<{ id: string; name: string; default_value: number }[]>([]);
  const [typeId, setTypeId] = useState<string>("");

  useEffect(() => {
    if (rawToken) {
      loadContribution();
    }
  }, [rawToken]);

  const loadContribution = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const decodedToken = rawToken ? decodeURIComponent(rawToken).trim() : rawToken;

      const { data: rpcData, error: baseError } = await supabase
        .rpc("get_contribution_by_public_token", { p_token: decodedToken });

      const baseContribution = rpcData as any;

      if (baseError) {
        console.error("Error loading public contribution base record:", baseError);
        setError("Erro ao validar o link da contribuição");
        return;
      }

      if (!baseContribution) {
        setError("Link inválido ou expirado");
        return;
      }

      const [employerResult, contributionTypeResult, clinicResult] = await Promise.all([
        baseContribution.employer_id
          ? supabase.from("employers").select("id, name, cnpj").eq("id", baseContribution.employer_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        baseContribution.contribution_type_id
          ? supabase.from("contribution_types").select("name, default_value").eq("id", baseContribution.contribution_type_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        baseContribution.clinic_id
          ? supabase.from("clinics").select("name, logo_url").eq("id", baseContribution.clinic_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      const contributionData: ContributionData = {
        ...baseContribution,
        employer: employerResult.data ?? null,
        contribution_type: contributionTypeResult.data ?? null,
        clinic: clinicResult.data ?? null,
      };

      setContribution(contributionData);
      setTypeId(contributionData.contribution_type_id ?? "");

      // Tipos de contribuição disponíveis para escolha (link seguro)
      const { data: typesData } = await supabase.rpc("get_public_contribution_types", {
        p_token: decodedToken,
      });
      if (Array.isArray(typesData)) {
        // Somente os tipos permitidos no link seguro: 124, 125 e 126
        const ALLOWED_PREFIXES = ["124 -", "125 -", "126 -"];
        const allowed = (typesData as any[]).filter((t) =>
          ALLOWED_PREFIXES.some((p) => String(t?.name || "").trim().startsWith(p))
        );
        setTypes(allowed as any);
        if (!allowed.some((t) => t.id === (contributionData.contribution_type_id ?? ""))) {
          setTypeId("");
        }
      }

      if (contributionData.contribution_type?.default_value) {
        setValue((contributionData.contribution_type.default_value / 100).toFixed(2).replace(".", ","));
      }

      // Pré-preenche com a data de vencimento atual (se ainda for futura)
      const currentDue = (contributionData.due_date || "").slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);
      setNewDueDate(currentDue && currentDue >= todayStr ? currentDue : todayStr);

      if (contributionData.status !== "awaiting_value" && contributionData.lytex_invoice_url) {
        setSuccess(true);
        setInvoiceUrl(contributionData.lytex_invoice_url);
      }
    } catch (err) {
      console.error("Error loading contribution:", err);
      setError("Erro ao carregar dados da contribuição");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contribution || !value) {
      toast.error("Informe o valor da contribuição");
      return;
    }

    const valueInCents = Math.round(parseFloat(value.replace(",", ".")) * 100);
    if (isNaN(valueInCents) || valueInCents <= 0) {
      toast.error("Valor inválido");
      return;
    }

    setSubmitting(true);
    try {
      // Tipo de contribuição escolhido no link seguro
      if (typeId && typeId !== contribution.contribution_type_id) {
        const { data: typeOk } = await supabase.rpc("set_contribution_type_by_public_token", {
          p_token: rawToken ? decodeURIComponent(rawToken).trim() : rawToken,
          p_type_id: typeId,
        });
        if (typeOk === false) {
          toast.error("Não foi possível alterar o tipo de contribuição");
          return;
        }
      }

      const { data, error: submitError } = await supabase.functions.invoke("set-contribution-value", {
        body: {
          contribution_id: contribution.id,
          value: valueInCents,
          due_date: newDueDate || undefined,
          portal_type: "public_token",
          portal_id: rawToken,
        },
      });

      if (submitError || data?.error) {
        toast.error(data?.error || "Erro ao gerar boleto");
        return;
      }

      setSuccess(true);
      setInvoiceUrl(data.lytex_invoice_url);
      toast.success("Boleto gerado com sucesso!");
    } catch (err) {
      console.error("Error submitting:", err);
      toast.error("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error || !contribution) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-3 rounded-full bg-rose-100 dark:bg-rose-900/30">
                <AlertTriangle className="h-8 w-8 text-rose-600 dark:text-rose-400" />
              </div>
              <h2 className="text-xl font-semibold">Link Inválido</h2>
              <p className="text-muted-foreground">
                {error || "Este link não é válido ou já foi utilizado."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center border-b pb-6">
          {contribution.clinic?.logo_url ? (
            <img 
              src={contribution.clinic.logo_url} 
              alt={contribution.clinic.name}
              className="h-16 object-contain mx-auto mb-4"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          )}
          <CardTitle className="text-xl">{contribution.clinic?.name || "Contribuição"}</CardTitle>
          <CardDescription>
            Informe o valor e gere o boleto para pagamento
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
          {/* Contribution Details */}
          <div className="space-y-4 bg-muted/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{contribution.employer?.name}</p>
                <p className="text-sm text-muted-foreground">
                  CNPJ: {formatCNPJ(contribution.employer?.cnpj || "")}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium">
                  {contribution.contribution_type?.name || "Contribuição"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Competência: {MONTHS[contribution.competence_month - 1]}/{contribution.competence_year}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">Vencimento</p>
                <p className="font-medium">
                  {format(new Date(contribution.due_date + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                    Boleto Gerado!
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Clique no botão abaixo para acessar o boleto
                  </p>
                </div>
              </div>
              
              {invoiceUrl && (
                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  onClick={() => window.open(invoiceUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Acessar Boleto
                </Button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {types.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo de Contribuição *</Label>
                  <select
                    id="type"
                    value={typeId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setTypeId(id);
                      const t = types.find((x) => x.id === id);
                      if (t?.default_value) {
                        setValue((t.default_value / 100).toFixed(2).replace(".", ","));
                      }
                    }}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">Selecione o tipo</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="value">Valor da Contribuição *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    id="value"
                    type="text"
                    placeholder="0,00"
                    value={value}
                    onChange={(e) => {
                      // Allow only numbers and comma
                      const val = e.target.value.replace(/[^\d,]/g, "");
                      setValue(val);
                    }}
                    className="pl-10 text-lg font-medium"
                    required
                  />
                </div>
                {contribution.contribution_type?.default_value > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Valor sugerido: {formatCurrency(contribution.contribution_type.default_value)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Nova Data de Vencimento *</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={newDueDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Você pode manter o vencimento atual ou escolher uma nova data futura.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                size="lg"
                disabled={submitting || !value || !newDueDate}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando Boleto...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4" />
                    Gerar Boleto
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
