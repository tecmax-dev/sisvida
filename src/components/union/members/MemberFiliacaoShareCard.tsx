import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Send,
  MessageCircle,
  Mail,
  Download,
  Loader2,
  Copy,
  CheckCircle,
  Share2,
  ExternalLink,
} from "lucide-react";
import { generateFichaFiliacaoPDF } from "@/lib/filiacao-pdf-generator";
import { sendWhatsAppDocument } from "@/lib/whatsapp";

interface MemberData {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  cpf: string | null;
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

interface Props {
  member: MemberData;
  clinicId: string;
}

export function MemberFiliacaoShareCard({ member, clinicId }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState(member.phone || "");
  const [emailAddress, setEmailAddress] = useState(member.email || "");
  const [linkCopied, setLinkCopied] = useState(false);

  // Fetch filiacao data for the member
  const fetchFiliacaoData = async (): Promise<{ filiacao: FiliacaoData | null; dependents: any[]; sindicato: any | null }> => {
    // First try to find by CPF in sindical_associados
    const { data: filiacao } = await supabase
      .from("sindical_associados")
      .select("*")
      .eq("cpf", member.cpf)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!filiacao) {
      return { filiacao: null, dependents: [], sindicato: null };
    }

    // Fetch dependents
    const { data: dependents } = await supabase
      .from("sindical_associado_dependentes")
      .select("*")
      .eq("associado_id", filiacao.id);

    // Fetch sindicato info
    const { data: sindicato } = await supabase
      .from("union_entities")
      .select("razao_social, clinic_id")
      .eq("clinic_id", clinicId)
      .single();

    // Fetch clinic logo
    let logoUrl = null;
    if (sindicato?.clinic_id) {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("logo_url")
        .eq("id", sindicato.clinic_id)
        .single();
      logoUrl = clinic?.logo_url;
    }

    return {
      filiacao,
      dependents: dependents || [],
      sindicato: sindicato ? { ...sindicato, logo_url: logoUrl } : null,
    };
  };

  // Generate PDF and download
  const handleDownloadPDF = async () => {
    setGeneratingPDF(true);
    try {
      const { filiacao, dependents, sindicato } = await fetchFiliacaoData();
      
      if (!filiacao) {
        toast({ 
          title: "Ficha de filiação não encontrada",
          description: "Este associado não possui ficha de filiação cadastrada.",
          variant: "destructive" 
        });
        return;
      }

      await generateFichaFiliacaoPDF(filiacao, dependents, sindicato);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast({ 
        title: "Erro ao gerar PDF", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Generate PDF as base64 for sending
  const generatePDFBase64 = async (): Promise<string> => {
    const { filiacao, dependents, sindicato } = await fetchFiliacaoData();
    
    if (!filiacao) {
      throw new Error("Ficha de filiação não encontrada");
    }

    // Import jsPDF dynamically
    const jsPDF = (await import("jspdf")).default;
    const autoTable = (await import("jspdf-autotable")).default;
    const { format } = await import("date-fns");
    const { ptBR } = await import("date-fns/locale");

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Colors
    const COLORS = {
      primary: [15, 23, 42] as [number, number, number],
      accent: [16, 185, 129] as [number, number, number],
      muted: [100, 116, 139] as [number, number, number],
      light: [248, 250, 252] as [number, number, number],
      white: [255, 255, 255] as [number, number, number],
    };

    const formatCPF = (cpf: string) => {
      const cleaned = cpf.replace(/\D/g, "");
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    };

    const paymentMethodLabels: Record<string, string> = {
      desconto_folha: "Desconto em Folha",
      boleto: "Boleto Bancário",
      pix: "PIX",
      debito_automatico: "Débito Automático",
    };

    // Header
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pageWidth, 40, "F");
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, 40, pageWidth, 3, "F");

    // Logo
    if (sindicato?.logo_url) {
      try {
        const response = await fetch(sindicato.logo_url);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        doc.addImage(base64, "PNG", 10, 6, 28, 28);
      } catch (e) {
        console.warn("Failed to load logo:", e);
      }
    }

    // Title
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.white);
    doc.setFont("helvetica", "bold");
    doc.text("FICHA DE FILIAÇÃO", pageWidth / 2, 18, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(sindicato?.razao_social || "Sindicato", pageWidth / 2, 28, { align: "center" });

    if (filiacao.matricula) {
      doc.setFontSize(9);
      doc.setTextColor(200, 200, 200);
      doc.text(`Matrícula: ${filiacao.matricula}`, pageWidth / 2, 36, { align: "center" });
    }

    let yPos = 52;

    // Member name card
    doc.setFillColor(...COLORS.light);
    doc.roundedRect(14, yPos, pageWidth - 28, 18, 2, 2, "F");
    doc.setFillColor(...COLORS.accent);
    doc.rect(14, yPos, 3, 18, "F");

    doc.setFontSize(14);
    doc.setTextColor(...COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.text(filiacao.nome, 22, yPos + 8);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(`CPF: ${formatCPF(filiacao.cpf)}`, 22, yPos + 14);

    yPos += 26;

    // Personal Data Section
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS PESSOAIS", 14, yPos);
    yPos += 6;

    const personalData = [
      ["RG", filiacao.rg || "-"],
      ["Data de Nascimento", filiacao.data_nascimento ? format(new Date(filiacao.data_nascimento + "T12:00:00"), "dd/MM/yyyy") : "-"],
      ["Sexo", filiacao.sexo || "-"],
      ["Estado Civil", filiacao.estado_civil || "-"],
      ["Nome do Pai", filiacao.nome_pai || "-"],
      ["Nome da Mãe", filiacao.nome_mae || "-"],
      ["E-mail", filiacao.email],
      ["Telefone", filiacao.telefone],
    ];

    autoTable(doc, {
      startY: yPos,
      body: personalData,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 45, textColor: COLORS.muted },
        1: { cellWidth: 90 },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Address Section
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.text("ENDEREÇO", 14, yPos);
    yPos += 6;

    const fullAddress = [filiacao.logradouro, filiacao.numero ? `nº ${filiacao.numero}` : null, filiacao.complemento].filter(Boolean).join(", ");
    const cityState = [filiacao.bairro, filiacao.cidade, filiacao.uf].filter(Boolean).join(" - ");

    const addressData = [
      ["Endereço", fullAddress || "-"],
      ["Bairro/Cidade/UF", cityState || "-"],
      ["CEP", filiacao.cep || "-"],
    ];

    autoTable(doc, {
      startY: yPos,
      body: addressData,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 45, textColor: COLORS.muted },
        1: { cellWidth: 90 },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Company Section
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS PROFISSIONAIS", 14, yPos);
    yPos += 6;

    const companyData = [
      ["Empresa", filiacao.empresa_razao_social || "-"],
      ["CNPJ", filiacao.empresa_cnpj || "-"],
      ["Cargo/Função", filiacao.cargo || "-"],
      ["Data de Admissão", filiacao.data_admissao ? format(new Date(filiacao.data_admissao + "T12:00:00"), "dd/MM/yyyy") : "-"],
      ["Forma de Pagamento", filiacao.forma_pagamento ? paymentMethodLabels[filiacao.forma_pagamento] || filiacao.forma_pagamento : "-"],
    ];

    autoTable(doc, {
      startY: yPos,
      body: companyData,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 45, textColor: COLORS.muted },
        1: { cellWidth: 90 },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Dependents Section
    if (dependents.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(...COLORS.primary);
      doc.setFont("helvetica", "bold");
      doc.text("DEPENDENTES", 14, yPos);
      yPos += 6;

      const depsTableData = dependents.map((d: any) => [
        d.nome,
        d.grau_parentesco,
        d.data_nascimento ? format(new Date(d.data_nascimento + "T12:00:00"), "dd/MM/yyyy") : "-",
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Nome", "Parentesco", "Data Nasc."]],
        body: depsTableData,
        theme: "plain",
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: {
          fillColor: COLORS.accent,
          textColor: COLORS.white,
          fontStyle: "bold",
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // Authorization Section
    doc.setFillColor(...COLORS.light);
    doc.roundedRect(14, yPos, pageWidth - 28, 35, 2, 2, "F");

    doc.setFontSize(9);
    doc.setTextColor(...COLORS.primary);
    doc.setFont("helvetica", "bold");
    doc.text("AUTORIZAÇÃO DE DESCONTO", 20, yPos + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);

    const authText = `Autorizo o desconto mensal da contribuição sindical equivalente a 2% do menor piso salarial da categoria, conforme estabelecido em convenção coletiva de trabalho, a ser efetuado diretamente em folha de pagamento ou pela forma de pagamento escolhida acima.`;
    const lines = doc.splitTextToSize(authText, pageWidth - 48);
    doc.text(lines, 20, yPos + 15);

    // Signature
    yPos += 42;

    if (filiacao.assinatura_digital_url) {
      try {
        const response = await fetch(filiacao.assinatura_digital_url);
        const blob = await response.blob();
        const sigBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        doc.addImage(sigBase64, "PNG", pageWidth / 2 - 30, yPos, 60, 20);
        yPos += 22;
      } catch (e) {
        console.warn("Failed to load signature:", e);
      }
    }

    // Signature line
    doc.setDrawColor(...COLORS.muted);
    doc.setLineWidth(0.3);
    doc.line(pageWidth / 2 - 40, yPos, pageWidth / 2 + 40, yPos);

    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text("Assinatura do Associado", pageWidth / 2, yPos + 5, { align: "center" });

    if (filiacao.assinatura_aceite_at) {
      doc.text(
        `Assinado digitalmente em ${format(new Date(filiacao.assinatura_aceite_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
        pageWidth / 2,
        yPos + 10,
        { align: "center" }
      );
    }

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...COLORS.accent);
    doc.setLineWidth(0.5);
    doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);

    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, pageHeight - 8);

    if (filiacao.aprovado_at) {
      doc.text(
        `Filiação aprovada em ${format(new Date(filiacao.aprovado_at), "dd/MM/yyyy", { locale: ptBR })}`,
        pageWidth - 14,
        pageHeight - 8,
        { align: "right" }
      );
    }

    // Return as base64
    const pdfBase64 = doc.output("datauristring").split(",")[1];
    return pdfBase64;
  };

  // Send PDF via WhatsApp
  const handleSendWhatsApp = async () => {
    if (!whatsappPhone.trim()) {
      toast({ title: "Informe o número do WhatsApp", variant: "destructive" });
      return;
    }

    setSendingWhatsApp(true);
    try {
      const pdfBase64 = await generatePDFBase64();
      
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
        variant: "destructive" 
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

    setSendingEmail(true);
    try {
      const pdfBase64 = await generatePDFBase64();
      
      // Get sindicato name
      const { data: sindicato } = await supabase
        .from("union_entities")
        .select("razao_social")
        .eq("clinic_id", clinicId)
        .single();

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
        variant: "destructive" 
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  return (
    <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-purple-600/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Share2 className="h-5 w-5 text-purple-500" />
          Ficha de Filiação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Envie a ficha de filiação completa com todos os dados cadastrais, dependentes e autorização de desconto em folha assinada digitalmente.
        </p>

        {/* Download PDF */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="flex-1 gap-2"
            onClick={handleDownloadPDF}
            disabled={generatingPDF}
          >
            {generatingPDF ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Baixar PDF
          </Button>
        </div>

        <Separator />

        {/* WhatsApp */}
        <div className="space-y-2">
          <Label className="text-sm flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-green-500" />
            Enviar por WhatsApp
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="(00) 00000-0000"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(formatPhone(e.target.value))}
              className="flex-1"
            />
            <Button 
              size="icon"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleSendWhatsApp}
              disabled={sendingWhatsApp}
            >
              {sendingWhatsApp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-500" />
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
              size="icon"
              variant="outline"
              className="border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
              onClick={handleSendEmail}
              disabled={sendingEmail}
            >
              {sendingEmail ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
