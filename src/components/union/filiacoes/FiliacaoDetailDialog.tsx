import { useState } from "react";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  User,
  Building2,
  MapPin,
  Phone,
  Mail,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  MessageCircle,
  Loader2,
  Pen,
  Users,
} from "lucide-react";
import { generateFichaFiliacaoPDF } from "@/lib/filiacao-pdf-generator";

interface FiliacaoFull {
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
  empresa_nome_fantasia?: string | null;
  empresa_endereco?: string | null;
  forma_pagamento?: string | null;
  documento_foto_url?: string | null;
  documento_rg_url?: string | null;
  documento_rg_verso_url?: string | null;
  documento_comprovante_url?: string | null;
  assinatura_digital_url?: string | null;
  assinatura_aceite_desconto?: boolean | null;
  assinatura_aceite_at?: string | null;
  status: string;
  observacoes?: string | null;
  created_at: string;
  aprovado_at?: string | null;
  aprovado_por?: string | null;
  rejeitado_at?: string | null;
  motivo_rejeicao?: string | null;
  matricula?: string | null;
}

interface Props {
  filiacao: { id: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  onRefresh: () => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pendente: { label: "Pendente", color: "bg-amber-500/20 text-amber-600 border-amber-500/30", icon: Clock },
  aprovado: { label: "Aprovado", color: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30", icon: CheckCircle },
  rejeitado: { label: "Rejeitado", color: "bg-red-500/20 text-red-600 border-red-500/30", icon: XCircle },
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

export function FiliacaoDetailDialog({
  filiacao,
  open,
  onOpenChange,
  onApprove,
  onReject,
  onRefresh,
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FiliacaoFull | null>(null);
  const [dependents, setDependents] = useState<any[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Fetch full data when dialog opens
  const fetchData = async () => {
    if (!filiacao?.id) return;
    
    setLoading(true);
    try {
      const { data: filiacaoData, error } = await supabase
        .from("sindical_associados")
        .select("*")
        .eq("id", filiacao.id)
        .single();

      if (error) throw error;
      setData(filiacaoData);

      // Fetch dependents
      const { data: depsData } = await supabase
        .from("sindical_associado_dependentes")
        .select("*")
        .eq("associado_id", filiacao.id);
      
      setDependents(depsData || []);
    } catch (error) {
      console.error("Error fetching filiacao:", error);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Fetch when dialog opens
  if (open && filiacao?.id && !data) {
    fetchData();
  }

  // Reset when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setData(null);
      setDependents([]);
    }
    onOpenChange(newOpen);
  };

  const handleDownloadPDF = async () => {
    if (!data) return;
    
    setGeneratingPDF(true);
    try {
      // Fetch sindicato info
      const { data: sindicato } = await supabase
        .from("union_entities")
        .select("razao_social")
        .single();
      
      await generateFichaFiliacaoPDF(data, dependents, sindicato);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleSendEmail = async () => {
    if (!data) return;
    
    setSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke("send-filiacao-notification", {
        body: {
          filiacaoId: data.id,
          channel: "email",
        },
      });

      if (error) throw error;
      toast({ title: "E-mail enviado com sucesso!" });
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

  const handleSendWhatsApp = async () => {
    if (!data) return;
    
    setSendingWhatsApp(true);
    try {
      const { error } = await supabase.functions.invoke("send-filiacao-notification", {
        body: {
          filiacaoId: data.id,
          channel: "whatsapp",
        },
      });

      if (error) throw error;
      toast({ title: "WhatsApp enviado com sucesso!" });
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

  if (!data) {
    return (
      <PopupBase open={open} onClose={() => handleOpenChange(false)} maxWidth="3xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PopupBase>
    );
  }

  const status = statusConfig[data.status] || statusConfig.pendente;
  const StatusIcon = status.icon;

  return (
    <PopupBase open={open} onClose={() => handleOpenChange(false)} maxWidth="3xl">
      <PopupHeader>
        <div className="flex items-center justify-between">
          <PopupTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-purple-500" />
            Detalhes da Filiação
          </PopupTitle>
          <Badge variant="outline" className={`gap-1 ${status.color}`}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </Badge>
        </div>
      </PopupHeader>

      <ScrollArea className="max-h-[60vh] pr-4">
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/5 rounded-lg p-4 border border-purple-500/20">
            <div className="flex items-start gap-4">
              {data.documento_foto_url ? (
                <img 
                  src={data.documento_foto_url} 
                  alt={data.nome}
                  className="w-20 h-24 object-cover rounded-lg border"
                />
              ) : (
                <div className="w-20 h-24 bg-muted rounded-lg flex items-center justify-center">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{data.nome}</h3>
                <p className="text-sm font-mono text-muted-foreground">{formatCPF(data.cpf)}</p>
                {data.matricula && (
                  <p className="text-sm text-purple-600 mt-1">Matrícula: {data.matricula}</p>
                )}
                {data.cargo && (
                  <p className="text-sm text-muted-foreground">{data.cargo}</p>
                )}
              </div>
            </div>
          </div>

          {/* Personal Info */}
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-blue-500" />
              Dados Pessoais
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">RG</p>
                <p>{data.rg || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Data Nascimento</p>
                <p>{data.data_nascimento ? format(new Date(data.data_nascimento + "T12:00:00"), "dd/MM/yyyy") : "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Sexo</p>
                <p>{data.sexo || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Estado Civil</p>
                <p>{data.estado_civil || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Nome do Pai</p>
                <p>{data.nome_pai || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Nome da Mãe</p>
                <p>{data.nome_mae || "-"}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Info */}
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
              <Phone className="h-4 w-4 text-green-500" />
              Contato
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{data.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{data.telefone}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Address */}
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-red-500" />
              Endereço
            </h4>
            <div className="text-sm">
              <p>
                {data.logradouro || ""}
                {data.numero ? `, ${data.numero}` : ""}
                {data.complemento ? ` - ${data.complemento}` : ""}
              </p>
              <p className="text-muted-foreground">
                {data.bairro ? `${data.bairro} - ` : ""}
                {data.cidade || ""}
                {data.uf ? `/${data.uf}` : ""}
                {data.cep ? ` - CEP: ${data.cep}` : ""}
              </p>
            </div>
          </div>

          <Separator />

          {/* Company Info */}
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-amber-500" />
              Dados da Empresa
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Razão Social</p>
                <p>{data.empresa_razao_social || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">CNPJ</p>
                <p className="font-mono">{data.empresa_cnpj || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Cargo/Função</p>
                <p>{data.cargo || "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Data Admissão</p>
                <p>{data.data_admissao ? format(new Date(data.data_admissao + "T12:00:00"), "dd/MM/yyyy") : "-"}</p>
              </div>
            </div>
          </div>

          {/* Dependents */}
          {dependents.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-purple-500" />
                  Dependentes ({dependents.length})
                </h4>
                <div className="space-y-2">
                  {dependents.map((dep, idx) => (
                    <div key={dep.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                      <div>
                        <p className="font-medium">{dep.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {dep.grau_parentesco} • {dep.data_nascimento ? format(new Date(dep.data_nascimento + "T12:00:00"), "dd/MM/yyyy") : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Payment & Signature */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-cyan-500" />
                Forma de Pagamento
              </h4>
              <p className="text-sm">
                {data.forma_pagamento 
                  ? paymentMethodLabels[data.forma_pagamento] || data.forma_pagamento
                  : "-"}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                <Pen className="h-4 w-4 text-indigo-500" />
                Assinatura Digital
              </h4>
              {data.assinatura_digital_url ? (
                <div className="space-y-2">
                  <img 
                    src={data.assinatura_digital_url} 
                    alt="Assinatura" 
                    className="h-12 border rounded bg-white"
                  />
                  {data.assinatura_aceite_desconto && (
                    <p className="text-xs text-emerald-600">
                      ✓ Autorizou desconto em {data.assinatura_aceite_at 
                        ? format(new Date(data.assinatura_aceite_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) 
                        : ""}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Não assinado</p>
              )}
            </div>
          </div>

          {/* Documents */}
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-slate-500" />
              Documentos Anexados
            </h4>
            <div className="flex flex-wrap gap-2">
              {data.documento_rg_url && (
                <a 
                  href={data.documento_rg_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80"
                >
                  RG (Frente)
                </a>
              )}
              {data.documento_rg_verso_url && (
                <a 
                  href={data.documento_rg_verso_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80"
                >
                  RG (Verso)
                </a>
              )}
              {data.documento_comprovante_url && (
                <a 
                  href={data.documento_comprovante_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80"
                >
                  Comprovante
                </a>
              )}
            </div>
          </div>

          {/* Rejection reason */}
          {data.status === "rejeitado" && data.motivo_rejeicao && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-sm font-medium text-red-600">Motivo da Rejeição:</p>
              <p className="text-sm mt-1">{data.motivo_rejeicao}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Solicitação em: {format(new Date(data.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            {data.aprovado_at && (
              <p>Aprovado em: {format(new Date(data.aprovado_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            )}
            {data.rejeitado_at && (
              <p>Rejeitado em: {format(new Date(data.rejeitado_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Actions */}
      <PopupFooter>
        {data.status === "pendente" ? (
          <>
            <Button onClick={onApprove} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle className="h-4 w-4" />
              Aprovar
            </Button>
            <Button onClick={onReject} variant="destructive" className="gap-2">
              <XCircle className="h-4 w-4" />
              Rejeitar
            </Button>
          </>
        ) : data.status === "aprovado" ? (
          <>
            <Button onClick={handleDownloadPDF} variant="outline" className="gap-2" disabled={generatingPDF}>
              {generatingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Baixar Ficha PDF
            </Button>
            <Button onClick={handleSendEmail} variant="outline" className="gap-2" disabled={sendingEmail}>
              {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar E-mail
            </Button>
            <Button onClick={handleSendWhatsApp} variant="outline" className="gap-2" disabled={sendingWhatsApp}>
              {sendingWhatsApp ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              Enviar WhatsApp
            </Button>
          </>
        ) : null}
        <Button variant="ghost" onClick={() => handleOpenChange(false)}>
          Fechar
        </Button>
      </PopupFooter>
    </PopupBase>
  );
}
