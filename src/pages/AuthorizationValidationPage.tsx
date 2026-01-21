import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AuthorizationValidationPage() {
  const { hash } = useParams<{ hash: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["authorization-validation", hash],
    queryFn: async () => {
      if (!hash) throw new Error("Hash inválido");

      const { data, error } = await supabase
        .from("union_authorizations")
        .select(`
          *,
          patient:patient_id (name, cpf, registration_number),
          dependent:dependent_id (name),
          benefit:benefit_id (name, partner_name),
          clinic:clinic_id (name)
        `)
        .eq("validation_hash", hash)
        .single();

      if (error) throw error;

      // Increment view count
      await supabase
        .from("union_authorizations")
        .update({ view_count: (data.view_count || 0) + 1, last_viewed_at: new Date().toISOString() })
        .eq("id", data.id);

      return data;
    },
    enabled: !!hash,
  });

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return "-";
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Autorização Não Encontrada</h1>
            <p className="text-muted-foreground">O link de validação é inválido ou expirou.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isValid = data.status === "active" && new Date(data.valid_until) >= new Date();
  const isExpired = data.status === "expired" || new Date(data.valid_until) < new Date();
  const isRevoked = data.status === "revoked";

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      isValid 
        ? "bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-slate-900 dark:to-slate-800"
        : "bg-gradient-to-br from-red-50 to-orange-100 dark:from-slate-900 dark:to-slate-800"
    }`}>
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6 space-y-6">
          {/* Status */}
          <div className="text-center">
            {isValid ? (
              <>
                <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                <Badge className="bg-emerald-500 text-white text-lg px-4 py-1">AUTORIZAÇÃO VÁLIDA</Badge>
              </>
            ) : isRevoked ? (
              <>
                <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                <Badge variant="destructive" className="text-lg px-4 py-1">AUTORIZAÇÃO REVOGADA</Badge>
              </>
            ) : (
              <>
                <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
                <Badge variant="secondary" className="text-lg px-4 py-1">AUTORIZAÇÃO EXPIRADA</Badge>
              </>
            )}
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Número</p>
              <p className="font-mono font-bold text-lg">{data.authorization_number}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Beneficiário</p>
                <p className="font-medium">{data.is_for_dependent ? data.dependent?.name : data.patient?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CPF</p>
                <p className="font-mono">{formatCPF(data.patient?.cpf)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Benefício</p>
                <p className="font-medium">{data.benefit?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Convênio</p>
                <p>{data.benefit?.partner_name || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Emitido em</p>
                <p>{format(new Date(data.issued_at), "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Válido até</p>
                <p className={isExpired ? "text-destructive font-medium" : ""}>
                  {format(new Date(data.valid_until), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>

            <Separator />

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Entidade</p>
              <p className="font-medium">{data.clinic?.name}</p>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex justify-center">
            <QRCodeSVG value={window.location.href} size={80} />
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Validado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
