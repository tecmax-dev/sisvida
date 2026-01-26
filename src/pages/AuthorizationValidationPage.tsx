import { useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, XCircle, AlertTriangle, Loader2, Share2, Printer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PublicPageWrapper } from "@/components/layout/PublicLayout";
import { useToast } from "@/hooks/use-toast";

export default function AuthorizationValidationPage() {
  const { slug, hash } = useParams<{ slug: string; hash: string }>();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const currentUrl = window.location.href;

  const handleShare = async () => {
    const shareData = {
      title: "Autorização de Benefício",
      text: "Verifique esta autorização de benefício sindical",
      url: currentUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(currentUrl);
        toast({ title: "Link copiado para a área de transferência!" });
      }
    } catch (err) {
      // User cancelled or error
      if ((err as Error).name !== "AbortError") {
        await navigator.clipboard.writeText(currentUrl);
        toast({ title: "Link copiado!" });
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

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
          clinic:clinic_id (name),
          union_entity:union_entity_id (
            razao_social,
            nome_fantasia,
            logo_url,
            president_name,
            president_signature_url
          )
        `)
        .eq("validation_hash", hash)
        .single();

      if (error) throw error;

      // If union_entity is null, try to fetch by clinic_id
      let unionEntityData = data.union_entity;
      if (!unionEntityData && data.clinic_id) {
        // IMPORTANT: avoid `.single()` here because the clinic may (incorrectly) have multiple active entities
        // which would cause the signature/logo not to load on the public validation page.
        const { data: entityByClinic, error: entityByClinicError } = await supabase
          .from("union_entities")
          .select("razao_social, nome_fantasia, logo_url, president_name, president_signature_url")
          .eq("clinic_id", data.clinic_id)
          .eq("status", "ativa")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (entityByClinicError) {
          console.warn("[AuthorizationValidation] Unable to fetch union entity by clinic:", entityByClinicError);
        }
        unionEntityData = entityByClinic;
      }

      // Increment view count
      await supabase
        .from("union_authorizations")
        .update({ view_count: (data.view_count || 0) + 1, last_viewed_at: new Date().toISOString() })
        .eq("id", data.id);

      return { ...data, union_entity: unionEntityData };
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
      <PublicPageWrapper>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-100">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      </PublicPageWrapper>
    );
  }

  if (error || !data) {
    return (
      <PublicPageWrapper>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-4">
          <Card className="w-full max-w-md bg-white">
            <CardContent className="pt-6 text-center">
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold mb-2 text-gray-900">Autorização Não Encontrada</h1>
              <p className="text-gray-600">O link de validação é inválido ou expirou.</p>
            </CardContent>
          </Card>
        </div>
      </PublicPageWrapper>
    );
  }

  const isValid = data.status === "active" && new Date(data.valid_until) >= new Date();
  const isExpired = data.status === "expired" || new Date(data.valid_until) < new Date();
  const isRevoked = data.status === "revoked";
  
  const unionEntity = data.union_entity as any;
  const entityName = unionEntity?.nome_fantasia || unionEntity?.razao_social || data.clinic?.name;
  const logoUrl = unionEntity?.logo_url;
  const presidentName = unionEntity?.president_name;
  const signatureUrl = unionEntity?.president_signature_url;

  return (
    <PublicPageWrapper>
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        isValid 
          ? "bg-gradient-to-br from-emerald-50 to-teal-100"
          : "bg-gradient-to-br from-red-50 to-orange-100"
      }`}>
        <Card className="w-full max-w-lg bg-white print:shadow-none print:border-none">
          <CardContent className="pt-6 space-y-6" ref={printRef}>
          {/* Action Buttons - hidden on print */}
          <div className="flex justify-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
              <Share2 className="h-4 w-4" />
              Compartilhar
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>

          {/* Logo */}
          {logoUrl && (
            <div className="flex justify-center">
              <img 
                src={logoUrl} 
                alt={entityName} 
                className="h-16 w-auto object-contain"
              />
            </div>
          )}

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
              <p className="font-medium">{entityName}</p>
            </div>

            {/* President Signature */}
            {(presidentName || signatureUrl) && (
              <>
                <Separator />
                <div className="text-center space-y-2">
                  {signatureUrl && (
                    <img 
                      src={signatureUrl} 
                      alt="Assinatura do Presidente" 
                      className="h-12 w-auto object-contain mx-auto"
                    />
                  )}
                  {presidentName && (
                    <>
                      <div className="w-48 mx-auto border-t border-gray-300" />
                      <p className="font-medium text-sm">{presidentName}</p>
                      <p className="text-xs text-muted-foreground">Presidente</p>
                    </>
                  )}
                </div>
              </>
            )}
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
    </PublicPageWrapper>
  );
}
