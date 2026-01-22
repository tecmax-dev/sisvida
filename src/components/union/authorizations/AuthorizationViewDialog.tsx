import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Share2, Copy, ExternalLink } from "lucide-react";
import { PopupBase, PopupHeader, PopupTitle } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Authorization {
  id: string;
  authorization_number: string;
  validation_hash: string;
  valid_from: string;
  valid_until: string;
  status: string;
  is_for_dependent: boolean;
  issued_at: string;
  patient: {
    id: string;
    name: string;
    cpf: string | null;
  };
  dependent?: {
    id: string;
    name: string;
  } | null;
  benefit: {
    id: string;
    name: string;
    partner_name: string | null;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorization: Authorization | null;
}

export function AuthorizationViewDialog({ open, onOpenChange, authorization }: Props) {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch union entity data
  const { data: unionEntity } = useQuery({
    queryKey: ["union-entity", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return null;
      const { data } = await supabase
        .from("union_entities")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .eq("status", "ativa")
        .single();
      return data;
    },
    enabled: !!currentClinic?.id && open,
  });

  // Fetch president signature
  const { data: signature } = useQuery({
    queryKey: ["president-signature", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return null;
      const { data } = await supabase
        .from("union_president_signatures")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .single();
      return data;
    },
    enabled: !!currentClinic?.id && open,
  });

  // Fetch full patient data
  const { data: patient } = useQuery({
    queryKey: ["patient-full", authorization?.patient?.id],
    queryFn: async () => {
      if (!authorization?.patient?.id) return null;
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("id", authorization.patient.id)
        .single();
      return data;
    },
    enabled: !!authorization?.patient?.id && open,
  });

  if (!authorization) return null;

  const publicUrl = `${window.location.origin}/autorizacao/${authorization.validation_hash}`;

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return "-";
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: "Link copiado!" });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Autorização ${authorization.authorization_number}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 40px; 
              max-width: 800px; 
              margin: 0 auto;
            }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 5px 0; color: #666; }
            .title { text-align: center; margin: 30px 0; }
            .title h2 { margin: 0; font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .content { margin: 20px 0; line-height: 1.8; }
            .field { margin: 10px 0; }
            .field strong { display: inline-block; width: 150px; }
            .qr-section { text-align: center; margin: 30px 0; }
            .qr-section img { width: 120px; height: 120px; }
            .signature { margin-top: 50px; text-align: center; }
            .signature-line { border-top: 1px solid #333; width: 300px; margin: 0 auto; padding-top: 10px; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30">ATIVA</Badge>;
      case "expired":
        return <Badge variant="secondary">EXPIRADA</Badge>;
      case "revoked":
        return <Badge variant="destructive">REVOGADA</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const beneficiaryName = authorization.is_for_dependent 
    ? authorization.dependent?.name 
    : authorization.patient?.name;

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="2xl">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-3">
          Autorização {authorization.authorization_number}
          {getStatusBadge(authorization.status)}
        </PopupTitle>
      </PopupHeader>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyLink}>
          <Copy className="h-4 w-4 mr-2" />
          Copiar Link
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir Link
          </a>
        </Button>
      </div>

      <Separator />

      {/* Print content */}
      <div ref={printRef} className="space-y-6">
        {/* Header */}
        <div className="header text-center">
          <h1 className="text-xl font-bold">{unionEntity?.razao_social || currentClinic?.name}</h1>
          {unionEntity?.cnpj && <p className="text-sm text-muted-foreground">CNPJ: {unionEntity.cnpj}</p>}
          {unionEntity?.endereco && <p className="text-sm text-muted-foreground">{unionEntity.endereco}</p>}
        </div>

        {/* Title */}
        <div className="title text-center">
          <h2 className="text-lg font-semibold border-b-2 border-foreground pb-2">
            AUTORIZAÇÃO DE BENEFÍCIO
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Nº {authorization.authorization_number}
          </p>
        </div>

        {/* Content */}
        <div className="content space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Beneficiário</p>
              <p className="font-medium">{beneficiaryName}</p>
            </div>
            {authorization.is_for_dependent && (
              <div>
                <p className="text-sm text-muted-foreground">Titular</p>
                <p className="font-medium">{authorization.patient?.name}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">CPF</p>
              <p className="font-medium font-mono">{formatCPF(patient?.cpf)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Matrícula</p>
              <p className="font-medium">{patient?.registration_number || "-"}</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Benefício</p>
              <p className="font-medium">{authorization.benefit?.name}</p>
            </div>
            {authorization.benefit?.partner_name && (
              <div>
                <p className="text-sm text-muted-foreground">Convênio</p>
                <p className="font-medium">{authorization.benefit.partner_name}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Data de Emissão</p>
              <p className="font-medium">
                {format(new Date(authorization.issued_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Validade</p>
              <p className="font-medium">
                {format(new Date(authorization.valid_from), "dd/MM/yyyy", { locale: ptBR })} até{" "}
                {format(new Date(authorization.valid_until), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          <Separator />

          <div className="bg-muted/50 p-4 rounded-lg text-sm">
            <p>
              Declaramos que o(a) beneficiário(a) acima identificado(a) é associado(a) regular 
              desta entidade sindical, estando apto(a) a utilizar o benefício mencionado, 
              conforme convênio vigente.
            </p>
          </div>
        </div>

        {/* QR Code */}
        <div className="qr-section flex flex-col items-center gap-2">
          <QRCodeSVG value={publicUrl} size={120} />
          <p className="text-xs text-muted-foreground">
            Escaneie para validar esta autorização
          </p>
        </div>

        {/* Signature */}
        {signature && (
          <div className="signature text-center mt-8">
            {signature.signature_data && (
              <img 
                src={signature.signature_data} 
                alt="Assinatura" 
                className="h-16 mx-auto mb-2"
              />
            )}
            <div className="signature-line border-t border-foreground w-64 mx-auto pt-2">
              <p className="font-medium">{signature.president_name}</p>
              <p className="text-sm text-muted-foreground">{signature.president_title}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="footer text-center text-xs text-muted-foreground mt-6">
          <p>Documento gerado eletronicamente em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          <p>Validação: {publicUrl}</p>
        </div>
      </div>
    </PopupBase>
  );
}
