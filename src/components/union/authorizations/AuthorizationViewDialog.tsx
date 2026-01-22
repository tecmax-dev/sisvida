import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Copy, ExternalLink, MessageCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SendAuthorizationWhatsAppDialog } from "./SendAuthorizationWhatsAppDialog";

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
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);

  // Fetch union entity data (includes logo, president name, and signature)
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

  // Also check union_president_signatures for canvas-drawn signatures
  const { data: drawnSignature } = useQuery({
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

  // Use drawn signature if available, otherwise use entity signature
  const signatureData = drawnSignature?.signature_data || unionEntity?.president_signature_url;
  const presidentName = drawnSignature?.president_name || unionEntity?.president_name;
  const presidentTitle = drawnSignature?.president_title || "Presidente";

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

  // Build public URL with clinic slug
  const entitySlug = currentClinic?.slug || "validar";
  const publicUrl = `${window.location.origin}/autorizacao/${entitySlug}/${authorization.validation_hash}`;

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
            @page { 
              size: A4; 
              margin: 15mm; 
            }
            * { box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              padding: 0;
              margin: 0;
              font-size: 11px;
              line-height: 1.4;
              max-width: 100%;
            }
            .header { text-align: center; margin-bottom: 10px; }
            .header img { max-height: 40px; width: auto; margin-bottom: 5px; }
            .header h1 { margin: 0; font-size: 14px; font-weight: bold; }
            .header p { margin: 2px 0; color: #666; font-size: 10px; }
            .title { text-align: center; margin: 12px 0; }
            .title h2 { margin: 0; font-size: 13px; border-bottom: 1px solid #333; padding-bottom: 5px; }
            .title p { margin: 3px 0; font-size: 10px; }
            .content { margin: 10px 0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
            .field p { margin: 1px 0; }
            .field .label { font-size: 9px; color: #666; }
            .field .value { font-size: 11px; font-weight: 500; }
            .declaration { background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 10px; margin: 10px 0; }
            .qr-section { text-align: center; margin: 12px 0; }
            .qr-section img, .qr-section svg { width: 70px !important; height: 70px !important; }
            .qr-section p { font-size: 8px; color: #666; margin-top: 3px; }
            .signature { text-align: center; margin-top: 15px; }
            .signature img { max-height: 35px; width: auto; margin-bottom: 3px; }
            .signature-line { border-top: 1px solid #333; width: 200px; margin: 0 auto; padding-top: 5px; }
            .signature-line p { margin: 1px 0; font-size: 10px; }
            .signature-line .title-text { font-size: 9px; color: #666; }
            .footer { text-align: center; font-size: 8px; color: #666; margin-top: 10px; }
            .separator { border-top: 1px solid #ddd; margin: 8px 0; }
            @media print { 
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Autorização {authorization.authorization_number}
            {getStatusBadge(authorization.status)}
          </DialogTitle>
        </DialogHeader>

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
          <Button 
            size="sm" 
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setWhatsappDialogOpen(true)}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            WhatsApp
          </Button>
        </div>

        <Separator />

        {/* Print content */}
        <div ref={printRef} className="space-y-3">
          {/* Header with Logo */}
          <div className="header text-center">
            {unionEntity?.logo_url && (
              <img 
                src={unionEntity.logo_url} 
                alt={unionEntity?.razao_social} 
                className="h-10 w-auto mx-auto mb-2 object-contain"
              />
            )}
            <h1 className="text-base font-bold">{unionEntity?.razao_social || currentClinic?.name}</h1>
            {unionEntity?.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {unionEntity.cnpj}</p>}
          </div>

          {/* Title */}
          <div className="title text-center">
            <h2 className="text-sm font-semibold border-b border-foreground pb-1">
              AUTORIZAÇÃO DE BENEFÍCIO
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Nº {authorization.authorization_number}
            </p>
          </div>

          {/* Content */}
          <div className="content space-y-2">
            <div className="grid gap-2 grid-cols-2 text-sm">
              <div className="field">
                <p className="label text-xs text-muted-foreground">Beneficiário</p>
                <p className="value font-medium text-sm">{beneficiaryName}</p>
              </div>
              {authorization.is_for_dependent && (
                <div className="field">
                  <p className="label text-xs text-muted-foreground">Titular</p>
                  <p className="value font-medium text-sm">{authorization.patient?.name}</p>
                </div>
              )}
              <div className="field">
                <p className="label text-xs text-muted-foreground">CPF</p>
                <p className="value font-medium font-mono text-sm">{formatCPF(patient?.cpf)}</p>
              </div>
              <div className="field">
                <p className="label text-xs text-muted-foreground">Matrícula</p>
                <p className="value font-medium text-sm">{patient?.registration_number || "-"}</p>
              </div>
            </div>

            <div className="separator border-t my-2" />

            <div className="grid gap-2 grid-cols-2 text-sm">
              <div className="field">
                <p className="label text-xs text-muted-foreground">Benefício</p>
                <p className="value font-medium text-sm">{authorization.benefit?.name}</p>
              </div>
              {authorization.benefit?.partner_name && (
                <div className="field">
                  <p className="label text-xs text-muted-foreground">Convênio</p>
                  <p className="value font-medium text-sm">{authorization.benefit.partner_name}</p>
                </div>
              )}
              <div className="field">
                <p className="label text-xs text-muted-foreground">Emissão</p>
                <p className="value font-medium text-sm">
                  {format(new Date(authorization.issued_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <div className="field">
                <p className="label text-xs text-muted-foreground">Validade</p>
                <p className="value font-medium text-sm">
                  {format(new Date(authorization.valid_from), "dd/MM/yyyy", { locale: ptBR })} a{" "}
                  {format(new Date(authorization.valid_until), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>

            <div className="declaration bg-muted/50 p-3 rounded text-xs mt-2">
              <p>
                Declaramos que o(a) beneficiário(a) acima é associado(a) regular 
                desta entidade sindical, apto(a) a utilizar o benefício mencionado.
              </p>
            </div>
          </div>

          {/* QR Code and Signature side by side */}
          <div className="flex items-end justify-between gap-4 mt-4">
            {/* QR Code */}
            <div className="qr-section flex flex-col items-center">
              <QRCodeSVG value={publicUrl} size={70} />
              <p className="text-[10px] text-muted-foreground mt-1">
                Validar
              </p>
            </div>

            {/* Signature */}
            {(signatureData || presidentName) && (
              <div className="signature text-center flex-1">
                {signatureData && (
                  <img 
                    src={signatureData} 
                    alt="Assinatura" 
                    className="h-10 mx-auto mb-1"
                  />
                )}
                <div className="signature-line border-t border-foreground w-48 mx-auto pt-1">
                  <p className="font-medium text-xs">{presidentName}</p>
                  <p className="text-[10px] text-muted-foreground">{presidentTitle}</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="footer text-center text-[10px] text-muted-foreground mt-2">
            <p>Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • {publicUrl}</p>
          </div>
        </div>

        {/* WhatsApp Dialog */}
        <SendAuthorizationWhatsAppDialog
          open={whatsappDialogOpen}
          onOpenChange={setWhatsappDialogOpen}
          authorization={authorization ? {
            ...authorization,
            patient: {
              ...authorization.patient,
              phone: patient?.phone,
            }
          } : null}
          clinicId={currentClinic?.id || ""}
          entityName={unionEntity?.razao_social || currentClinic?.name}
        />
      </DialogContent>
    </Dialog>
  );
}
