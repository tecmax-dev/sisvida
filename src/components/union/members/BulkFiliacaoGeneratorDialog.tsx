import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  FileArchive,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

interface MemberStatus {
  id: string;
  name: string;
  cpf: string | null;
  status: "pending" | "generating" | "success" | "error" | "no_filiacao";
  error?: string;
}

export function BulkFiliacaoGeneratorDialog({ open, onOpenChange, clinicId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [members, setMembers] = useState<MemberStatus[]>([]);
  const [progress, setProgress] = useState(0);
  const [generatedPDFs, setGeneratedPDFs] = useState<{ name: string; blob: Blob }[]>([]);
  const [sindicato, setSindicato] = useState<any>(null);

  useEffect(() => {
    if (open) {
      loadMembers();
      loadSindicato();
    }
  }, [open, clinicId]);

  const loadSindicato = async () => {
    const { data } = await supabase
      .from("union_entities")
      .select("razao_social, clinic_id")
      .eq("clinic_id", clinicId)
      .single();

    if (data) {
      const { data: clinic } = await supabase
        .from("clinics")
        .select("logo_url")
        .eq("id", clinicId)
        .single();

      setSindicato({ ...data, logo_url: clinic?.logo_url });
    }
  };

  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, cpf")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      setMembers(
        (data || []).map((m) => ({
          id: m.id,
          name: m.name,
          cpf: m.cpf,
          status: "pending" as const,
        }))
      );
    } catch (error) {
      console.error("Error loading members:", error);
      toast({ title: "Erro ao carregar sócios", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generatePDFForMember = async (
    cpf: string,
    memberName: string
  ): Promise<Blob | null> => {
    // Fetch filiacao data
    const { data: filiacao } = await supabase
      .from("sindical_associados")
      .select("*")
      .eq("cpf", cpf)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!filiacao) {
      return null;
    }

    // Fetch dependents
    const { data: dependents } = await supabase
      .from("sindical_associado_dependentes")
      .select("*")
      .eq("associado_id", filiacao.id);

    // Generate PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

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
    if (dependents && dependents.length > 0) {
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

    return doc.output("blob");
  };

  const handleGenerateAll = async () => {
    setGenerating(true);
    setProgress(0);
    setGeneratedPDFs([]);

    const pdfs: { name: string; blob: Blob }[] = [];
    const total = members.length;

    for (let i = 0; i < members.length; i++) {
      const member = members[i];

      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, status: "generating" } : m
        )
      );

      try {
        if (!member.cpf) {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === member.id
                ? { ...m, status: "error", error: "CPF não cadastrado" }
                : m
            )
          );
          continue;
        }

        const pdfBlob = await generatePDFForMember(member.cpf, member.name);

        if (pdfBlob) {
          pdfs.push({
            name: `ficha-filiacao-${member.name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30)}.pdf`,
            blob: pdfBlob,
          });
          setMembers((prev) =>
            prev.map((m) =>
              m.id === member.id ? { ...m, status: "success" } : m
            )
          );
        } else {
          setMembers((prev) =>
            prev.map((m) =>
              m.id === member.id ? { ...m, status: "no_filiacao" } : m
            )
          );
        }
      } catch (error: any) {
        console.error(`Error generating PDF for ${member.name}:`, error);
        setMembers((prev) =>
          prev.map((m) =>
            m.id === member.id
              ? { ...m, status: "error", error: error.message }
              : m
          )
        );
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setGeneratedPDFs(pdfs);
    setGenerating(false);

    if (pdfs.length > 0) {
      toast({
        title: `${pdfs.length} fichas geradas com sucesso!`,
        description: "Clique em baixar para salvar os PDFs.",
      });
    } else {
      toast({
        title: "Nenhuma ficha gerada",
        description: "Nenhum sócio possui ficha de filiação cadastrada.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadAll = () => {
    generatedPDFs.forEach((pdf) => {
      const url = URL.createObjectURL(pdf.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdf.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    toast({ title: `${generatedPDFs.length} PDFs baixados!` });
  };

  const stats = {
    total: members.length,
    success: members.filter((m) => m.status === "success").length,
    noFiliacao: members.filter((m) => m.status === "no_filiacao").length,
    error: members.filter((m) => m.status === "error").length,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5 text-purple-500" />
            Gerar Fichas de Filiação em Lote
          </DialogTitle>
          <DialogDescription>
            Gere fichas de filiação em PDF para todos os sócios cadastrados que possuem ficha de filiação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.success}</p>
              <p className="text-xs text-muted-foreground">Geradas</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.noFiliacao}</p>
              <p className="text-xs text-muted-foreground">Sem ficha</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/10 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.error}</p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </div>
          </div>

          {/* Progress */}
          {generating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Gerando fichas...</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Members list */}
          <ScrollArea className="h-[300px] border rounded-lg">
            <div className="p-2 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum sócio cadastrado</p>
                </div>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      {member.status === "pending" && (
                        <div className="h-4 w-4 rounded-full bg-muted" />
                      )}
                      {member.status === "generating" && (
                        <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                      )}
                      {member.status === "success" && (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      )}
                      {member.status === "no_filiacao" && (
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                      )}
                      {member.status === "error" && (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm font-medium">{member.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.status === "no_filiacao" && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          Sem ficha
                        </Badge>
                      )}
                      {member.status === "error" && (
                        <Badge variant="outline" className="text-red-600 border-red-300">
                          {member.error || "Erro"}
                        </Badge>
                      )}
                      {member.status === "success" && (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                          Gerada
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            {generatedPDFs.length > 0 && (
              <Button onClick={handleDownloadAll} className="gap-2">
                <Download className="h-4 w-4" />
                Baixar {generatedPDFs.length} PDFs
              </Button>
            )}
            <Button
              onClick={handleGenerateAll}
              disabled={generating || loading || members.length === 0}
              className="gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Gerar Fichas
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
