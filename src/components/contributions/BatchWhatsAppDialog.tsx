import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Loader2, Send, MessageCircle, CheckCircle2, XCircle, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { formatCompetence } from "@/lib/competence-format";

interface Member {
  id: string;
  name: string;
  cpf: string | null;
  email?: string | null;
  phone?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
}

interface Contribution {
  id: string;
  value: number;
  due_date: string;
  status: string;
  competence_month: number;
  competence_year: number;
  lytex_invoice_id: string | null;
  lytex_invoice_url: string | null;
  lytex_boleto_digitable_line: string | null;
  lytex_pix_code: string | null;
  patients?: Member;
  contribution_types?: ContributionType;
}

interface SendResult {
  contributionId: string;
  memberName: string;
  phone: string;
  success: boolean;
  error?: string;
}

interface BatchWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributions: Contribution[];
  clinicId: string;
  clinicName?: string;
  onComplete?: () => void;
}

export function BatchWhatsAppDialog({
  open,
  onOpenChange,
  contributions,
  clinicId,
  clinicName,
  onComplete,
}: BatchWhatsAppDialogProps) {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SendResult[]>([]);
  const [messageTemplate, setMessageTemplate] = useState("");

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  // Filter contributions with phone and invoice URL
  const validContributions = contributions.filter(
    (c) => c.patients?.phone && c.lytex_invoice_url && c.status !== "cancelled"
  );

  const invalidContributions = contributions.filter(
    (c) => !c.patients?.phone || !c.lytex_invoice_url || c.status === "cancelled"
  );

  const generateDefaultTemplate = () => {
    return `Olá {nome}! 👋

📋 *{tipo}*

━━━━━━━━━━━━━━━━
*Competência:* {competencia}
*Vencimento:* {vencimento}
*Valor:* {valor}
━━━━━━━━━━━━━━━━

🔗 *Acesse o boleto:*
{link_boleto}

📱 *Código PIX (Copia e Cola):*
\`\`\`{pix}\`\`\`

Atenciosamente,
${clinicName || "Entidade"}`;
  };

  useEffect(() => {
    if (open) {
      setMessageTemplate(generateDefaultTemplate());
      setResults([]);
      setProgress(0);
    }
  }, [open]);

  const generateMessage = (contribution: Contribution): string => {
    const memberName = contribution.patients?.name || "Associado";
    const competence = formatCompetence(contribution.competence_month, contribution.competence_year);
    const dueDate = format(new Date(contribution.due_date + "T12:00:00"), "dd/MM/yyyy");
    const value = formatCurrency(contribution.value);
    const typeName = contribution.contribution_types?.name || "Contribuição";

    let msg = messageTemplate
      .replace(/{nome}/g, memberName)
      .replace(/{tipo}/g, typeName)
      .replace(/{competencia}/g, competence)
      .replace(/{vencimento}/g, dueDate)
      .replace(/{valor}/g, value)
      .replace(/{link_boleto}/g, contribution.lytex_invoice_url || "")
      .replace(/{pix}/g, contribution.lytex_pix_code || "Não disponível")
      .replace(/{linha_digitavel}/g, contribution.lytex_boleto_digitable_line || "Não disponível");

    // Remove PIX section if not available
    if (!contribution.lytex_pix_code) {
      msg = msg.replace(/📱 \*Código PIX.*?\`\`\`Não disponível\`\`\`\n?/gs, "");
    }

    return msg;
  };

  const handleSend = async () => {
    if (validContributions.length === 0) {
      toast.error("Nenhuma contribuição válida para envio");
      return;
    }

    setSending(true);
    setResults([]);
    setProgress(0);

    const newResults: SendResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < validContributions.length; i++) {
      const contribution = validContributions[i];
      const phone = contribution.patients?.phone?.replace(/\D/g, "") || "";
      const message = generateMessage(contribution);

      try {
        const result = await sendWhatsAppMessage({
          phone,
          message,
          clinicId,
          type: "custom",
        });

        if (result.success) {
          successCount++;
          newResults.push({
            contributionId: contribution.id,
            memberName: contribution.patients?.name || "Desconhecido",
            phone,
            success: true,
          });
        } else {
          errorCount++;
          newResults.push({
            contributionId: contribution.id,
            memberName: contribution.patients?.name || "Desconhecido",
            phone,
            success: false,
            error: result.error || "Erro desconhecido",
          });
        }
      } catch (error: any) {
        errorCount++;
        newResults.push({
          contributionId: contribution.id,
          memberName: contribution.patients?.name || "Desconhecido",
          phone,
          success: false,
          error: error.message || "Erro ao enviar",
        });
      }

      setProgress(((i + 1) / validContributions.length) * 100);
      setResults([...newResults]);

      // Small delay between messages to avoid rate limiting
      if (i < validContributions.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    setSending(false);

    if (successCount > 0 && errorCount === 0) {
      toast.success(`${successCount} mensagem(ns) enviada(s) com sucesso!`);
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`${successCount} enviada(s), ${errorCount} com erro`);
    } else {
      toast.error(`Falha ao enviar ${errorCount} mensagem(ns)`);
    }

    onComplete?.();
  };

  const successResults = results.filter((r) => r.success);
  const errorResults = results.filter((r) => !r.success);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Envio em Lote via WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envie as contribuições selecionadas para os sócios via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Summary */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {contributions.length} selecionada(s)
            </Badge>
            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {validContributions.length} válida(s)
            </Badge>
            {invalidContributions.length > 0 && (
              <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 gap-1">
                <AlertTriangle className="h-3 w-3" />
                {invalidContributions.length} sem telefone/boleto
              </Badge>
            )}
          </div>

          {/* Template Editor */}
          {!sending && results.length === 0 && (
            <div className="space-y-2">
              <Label htmlFor="template">Modelo da Mensagem</Label>
              <Textarea
                id="template"
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder="Use {nome}, {tipo}, {competencia}, {vencimento}, {valor}, {link_boleto}, {pix}"
              />
              <p className="text-xs text-muted-foreground">
                Variáveis disponíveis: {"{nome}"}, {"{tipo}"}, {"{competencia}"}, {"{vencimento}"}, {"{valor}"}, {"{link_boleto}"}, {"{pix}"}, {"{linha_digitavel}"}
              </p>
            </div>
          )}

          {/* Progress */}
          {sending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Enviando mensagens...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <ScrollArea className="flex-1 max-h-[300px] border rounded-md p-3">
              <div className="space-y-2">
                {successResults.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Enviados com sucesso ({successResults.length})
                    </p>
                    {successResults.map((r) => (
                      <div key={r.contributionId} className="text-sm text-muted-foreground pl-5">
                        {r.memberName} - {r.phone}
                      </div>
                    ))}
                  </div>
                )}
                {errorResults.length > 0 && (
                  <div className="space-y-1 mt-3">
                    <p className="text-sm font-medium text-rose-600 flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      Erros ({errorResults.length})
                    </p>
                    {errorResults.map((r) => (
                      <div key={r.contributionId} className="text-sm text-muted-foreground pl-5">
                        {r.memberName} - {r.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            {results.length > 0 ? "Fechar" : "Cancelar"}
          </Button>
          {results.length === 0 && (
            <Button
              onClick={handleSend}
              disabled={sending || validContributions.length === 0}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar {validContributions.length} mensagem(ns)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
