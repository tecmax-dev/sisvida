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
  employer: {
    id: string;
    name: string;
    cnpj: string;
  };
  contribution_type: {
    name: string;
    default_value: number;
  };
  clinic: {
    name: string;
    logo_url: string | null;
  };
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
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [contribution, setContribution] = useState<ContributionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [success, setSuccess] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadContribution();
    }
  }, [token]);

  const loadContribution = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from("employer_contributions")
        .select(`
          id,
          status,
          value,
          due_date,
          competence_month,
          competence_year,
          lytex_invoice_url,
          employer:employers(id, name, cnpj),
          contribution_type:contribution_types(name, default_value),
          clinic:clinics(name, logo_url)
        `)
        .eq("public_access_token", token)
        .single();

      if (fetchError || !data) {
        setError("Link inválido ou expirado");
        return;
      }

      // Cast the data properly
      const contributionData = data as unknown as ContributionData;
      setContribution(contributionData);

      // Pre-fill with default value if exists
      if (contributionData.contribution_type?.default_value) {
        setValue((contributionData.contribution_type.default_value / 100).toFixed(2).replace(".", ","));
      }

      // If already has invoice, show success
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
      const { data, error: submitError } = await supabase.functions.invoke("set-contribution-value", {
        body: {
          contribution_id: contribution.id,
          value: valueInCents,
          portal_type: "public_token",
          portal_id: token,
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error || !contribution) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-4 flex items-center justify-center">
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

              <Button
                type="submit"
                className="w-full gap-2"
                size="lg"
                disabled={submitting || !value}
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
