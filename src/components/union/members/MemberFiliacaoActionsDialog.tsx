import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Download,
  Mail,
  MessageCircle,
  Loader2,
  CheckCircle,
  User,
  Building2,
  Users,
  CalendarCheck,
  Signature,
} from "lucide-react";
import { generateFichaFiliacaoPDF, generateFiliacaoPDFBlob } from "@/lib/filiacao-pdf-generator";
import { sendWhatsAppDocument } from "@/lib/whatsapp";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MemberData {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  cpf: string | null;
  birth_date?: string | null;
  gender?: string | null;
  address?: string | null;
  address_number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  registration_number?: string | null;
}

interface FiliacaoData {
  id: string;
  nome: string;
  cpf: string;
  rg?: string | null;
  data_nascimento: string;
  sexo?: string | null;
  estado_civil?: string | null;
  nome_pai?: string | null;
  nome_mae?: string | null;
  email: string;
  telefone: string;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cargo?: string | null;
  data_admissao?: string | null;
  empresa_razao_social?: string | null;
  empresa_cnpj?: string | null;
  forma_pagamento?: string | null;
  assinatura_digital_url?: string | null;
  assinatura_aceite_desconto?: boolean | null;
  assinatura_aceite_at?: string | null;
  matricula?: string | null;
  created_at: string;
  aprovado_at?: string | null;
}

interface DependentData {
  id: string;
  nome: string;
  grau_parentesco: string;
  data_nascimento?: string | null;
  cpf?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: MemberData;
  clinicId: string;
}

export function MemberFiliacaoActionsDialog({ open, onOpenChange, member, clinicId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState(member.phone || "");
  const [emailAddress, setEmailAddress] = useState(member.email || "");
  const [filiacaoData, setFiliacaoData] = useState<FiliacaoData | null>(null);
  const [dependents, setDependents] = useState<DependentData[]>([]);
  const [sindicato, setSindicato] = useState<any>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [hasFullFiliacaoRecord, setHasFullFiliacaoRecord] = useState(false); // True if from sindical_associados

  // Fetch filiacao data when dialog opens
  const fetchFiliacaoData = async () => {
    if (dataLoaded) return;
    
    setLoading(true);
    try {
      // First try to find by CPF in sindical_associados
      if (member.cpf) {
        const normalizedCpf = member.cpf.replace(/\D/g, "");
        const { data: filiacao } = await supabase
          .from("sindical_associados")
          .select("*")
          .or(`cpf.eq.${normalizedCpf},cpf.eq.${member.cpf}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (filiacao) {
          setFiliacaoData(filiacao);
          setHasFullFiliacaoRecord(true);

          // Fetch dependents from sindical_associado_dependentes
          const { data: deps } = await supabase
            .from("sindical_associado_dependentes")
            .select("*")
            .eq("associado_id", filiacao.id);
          setDependents(deps || []);
        } else {
          // No sindical_associados record found - create filiacao data from patient record
          await buildFiliacaoFromPatient();
        }
      } else {
        // No CPF - build from patient data anyway
        await buildFiliacaoFromPatient();
      }

      // Fetch sindicato info
      const { data: sind } = await supabase
        .from("union_entities")
        .select("razao_social, clinic_id, logo_url, cnpj")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sind) {
        // Also fetch clinic logo as fallback
        const { data: clinic } = await supabase
          .from("clinics")
          .select("logo_url, city, state_code")
          .eq("id", clinicId)
          .maybeSingle();
        
        setSindicato({
          ...sind,
          logo_url: sind.logo_url || clinic?.logo_url,
          cidade: clinic?.city,
          uf: clinic?.state_code,
        });
      }

      setDataLoaded(true);
    } catch (error) {
      console.error("Error fetching filiacao data:", error);
    } finally {
      setLoading(false);
    }
  };

  const buildFiliacaoFromPatient = async () => {
    // Fetch dependents from patient_dependents
    const { data: patientDeps } = await supabase
      .from("patient_dependents")
      .select("id, name, relationship, birth_date, cpf")
      .eq("patient_id", member.id)
      .eq("is_active", true);
    
    const mappedDeps: DependentData[] = (patientDeps || []).map(d => ({
      id: d.id,
      nome: d.name,
      grau_parentesco: d.relationship || "Dependente",
      data_nascimento: d.birth_date,
      cpf: d.cpf,
    }));
    setDependents(mappedDeps);

    // Build filiacao data from patient record
    const filiacaoFromPatient: FiliacaoData = {
      id: member.id,
      nome: member.name,
      cpf: member.cpf || "",
      data_nascimento: member.birth_date || "",
      sexo: member.gender,
      email: member.email || "",
      telefone: member.phone,
      cep: member.zip_code,
      logradouro: member.address,
      numero: member.address_number,
      bairro: member.neighborhood,
      cidade: member.city,
      uf: member.state,
      matricula: member.registration_number,
      created_at: new Date().toISOString(),
      aprovado_at: new Date().toISOString(), // Assume filiado se está na base
    };
    setFiliacaoData(filiacaoFromPatient);
    setHasFullFiliacaoRecord(false);
  };

  // Load data when dialog opens
  if (open && !dataLoaded && !loading) {
    fetchFiliacaoData();
  }

  const formatCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  // Generate and download PDF
  const handleDownloadPDF = async () => {
    setGeneratingPDF(true);
    try {
      if (!filiacaoData) {
        toast({
          title: "Ficha de filiação não encontrada",
          description: "Este associado não possui ficha de filiação cadastrada.",
          variant: "destructive",
        });
        return;
      }

      await generateFichaFiliacaoPDF(filiacaoData, dependents, sindicato);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Generate PDF as Blob for sending
  const generatePDFForSending = async (): Promise<string> => {
    if (!filiacaoData) {
      throw new Error("Ficha de filiação não encontrada");
    }

    const blob = await generateFiliacaoPDFBlob(filiacaoData, dependents, sindicato);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Send PDF via WhatsApp
  const handleSendWhatsApp = async () => {
    if (!whatsappPhone.trim()) {
      toast({ title: "Informe o número do WhatsApp", variant: "destructive" });
      return;
    }

    if (!filiacaoData) {
      toast({
        title: "Ficha de filiação não encontrada",
        description: "Este associado não possui ficha de filiação cadastrada.",
        variant: "destructive",
      });
      return;
    }

    setSendingWhatsApp(true);
    try {
      const pdfBase64 = await generatePDFForSending();

      const result = await sendWhatsAppDocument({
        phone: whatsappPhone,
        clinicId,
        pdfBase64,
        fileName: `ficha-filiacao-${member.name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}.pdf`,
        caption: `📋 *Ficha de Filiação*\n\n${member.name}\n\nDocumento com todos os dados cadastrais e autorização de desconto em folha.`,
      });

      if (!result.success) {
        throw new Error(result.error || "Erro ao enviar WhatsApp");
      }

      toast({ title: "Ficha enviada por WhatsApp com sucesso!" });
    } catch (error: any) {
      console.error("Error sending WhatsApp:", error);
      toast({
        title: "Erro ao enviar WhatsApp",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  // Send PDF via Email
  const handleSendEmail = async () => {
    if (!emailAddress.trim()) {
      toast({ title: "Informe o endereço de e-mail", variant: "destructive" });
      return;
    }

    if (!filiacaoData) {
      toast({
        title: "Ficha de filiação não encontrada",
        description: "Este associado não possui ficha de filiação cadastrada.",
        variant: "destructive",
      });
      return;
    }

    setSendingEmail(true);
    try {
      const pdfBase64 = await generatePDFForSending();

      const { error } = await supabase.functions.invoke("send-filiacao-pdf-email", {
        body: {
          email: emailAddress,
          memberName: member.name,
          pdfBase64,
          sindicatoName: sindicato?.razao_social || "Sindicato",
        },
      });

      if (error) throw error;

      toast({ title: "Ficha enviada por e-mail com sucesso!" });
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({
        title: "Erro ao enviar e-mail",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const hasFiliacaoData = !!filiacaoData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Ficha de Filiação
          </DialogTitle>
          <DialogDescription>
            Emitir ou enviar a ficha de filiação do associado
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Member Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{member.name}</span>
              </div>
              {member.cpf && (
                <div className="text-sm text-muted-foreground">
                  CPF: {formatCPF(member.cpf)}
                </div>
              )}
              
              {hasFiliacaoData && (
                <>
                  {/* Show data source indicator */}
                  {!hasFullFiliacaoRecord && (
                    <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/50 p-2 rounded flex items-center gap-2">
                      <CheckCircle className="h-3 w-3" />
                      Ficha será gerada com os dados cadastrais do associado
                    </div>
                  )}
                  {hasFullFiliacaoRecord && (
                    <div className="text-xs text-green-600 bg-green-50 dark:bg-green-950/50 p-2 rounded flex items-center gap-2">
                      <CheckCircle className="h-3 w-3" />
                      Ficha de filiação completa disponível
                    </div>
                  )}
                  
                  {filiacaoData.empresa_razao_social && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      {filiacaoData.empresa_razao_social}
                    </div>
                  )}
                  {dependents.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {dependents.length} dependente{dependents.length > 1 ? "s" : ""} vinculado{dependents.length > 1 ? "s" : ""}
                    </div>
                  )}
                  {filiacaoData.aprovado_at && hasFullFiliacaoRecord && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarCheck className="h-4 w-4" />
                      Filiado em {format(new Date(filiacaoData.aprovado_at), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  )}
                  {filiacaoData.assinatura_aceite_desconto && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Signature className="h-4 w-4" />
                      Autorização de desconto assinada
                    </div>
                  )}
                </>
              )}

              {!hasFiliacaoData && !loading && (
                <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/50 p-2 rounded mt-2">
                  ⚠️ Não foi possível carregar os dados. Verifique o cadastro do associado.
                </div>
              )}
            </div>

            <Separator />

            {/* Download PDF */}
            <div className="space-y-2">
              <Button
                onClick={handleDownloadPDF}
                disabled={generatingPDF || !hasFiliacaoData}
                className="w-full"
                variant="outline"
              >
                {generatingPDF ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Baixar Ficha de Filiação (PDF)
              </Button>
            </div>

            <Separator />

            {/* Send via WhatsApp */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" />
                Enviar por WhatsApp
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="(00) 00000-0000"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendWhatsApp}
                  disabled={sendingWhatsApp || !hasFiliacaoData}
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                >
                  {sendingWhatsApp ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageCircle className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Send via Email */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                Enviar por E-mail
              </Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !hasFiliacaoData}
                  variant="default"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {sendingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
