import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Loader2, Send, Mail, CheckCircle2, XCircle, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  email: string;
  memberName: string;
  boletosCount: number;
  success: boolean;
  error?: string;
}

interface BatchPFEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributions: Contribution[];
  clinicId: string;
  clinicName?: string;
  onComplete?: () => void;
}

export function BatchPFEmailDialog({
  open,
  onOpenChange,
  contributions,
  clinicId,
  clinicName,
  onComplete,
}: BatchPFEmailDialogProps) {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SendResult[]>([]);

  // Filter contributions with email and invoice URL
  const validContributions = contributions.filter(
    (c) => c.patients?.email && c.lytex_invoice_url && c.status !== "cancelled"
  );

  const invalidContributions = contributions.filter(
    (c) => !c.patients?.email || !c.lytex_invoice_url || c.status === "cancelled"
  );

  // Group contributions by member email
  const groupedByEmail = useMemo(() => {
    const groups = new Map<string, Contribution[]>();
    
    validContributions.forEach((contribution) => {
      const email = contribution.patients?.email?.toLowerCase() || "";
      if (!email) return;
      
      if (!groups.has(email)) {
        groups.set(email, []);
      }
      groups.get(email)!.push(contribution);
    });
    
    return groups;
  }, [validContributions]);

  const totalEmails = groupedByEmail.size;
  const totalBoletos = validContributions.length;

  useEffect(() => {
    if (open) {
      setResults([]);
      setProgress(0);
    }
  }, [open]);

  const handleSend = async () => {
    if (groupedByEmail.size === 0) {
      toast.error("Nenhuma contribuição válida para envio");
      return;
    }

    setSending(true);
    setResults([]);
    setProgress(0);

    const newResults: SendResult[] = [];
    let successCount = 0;
    let errorCount = 0;
    let currentIndex = 0;

    for (const [email, memberContributions] of groupedByEmail.entries()) {
      const memberName = memberContributions[0]?.patients?.name || "Associado";
      const memberId = memberContributions[0]?.patients?.id;
      const memberCpf = memberContributions[0]?.patients?.cpf || "";

      // Build boletos array for the email
      const boletos = memberContributions.map((c) => ({
        employerName: c.patients?.name || "Associado",
        employerCnpj: memberCpf, // Using CPF for PF
        contributionType: c.contribution_types?.name || "Contribuição",
        competenceMonth: c.competence_month,
        competenceYear: c.competence_year,
        dueDate: c.due_date,
        value: c.value,
        status: c.status,
        invoiceUrl: c.lytex_invoice_url || "",
        digitableLine: c.lytex_boleto_digitable_line || undefined,
        pixCode: c.lytex_pix_code || undefined,
        isPF: true, // Mark as person (not company)
      }));

      try {
        const { data, error } = await supabase.functions.invoke("send-boleto-email", {
          body: {
            recipientEmail: email,
            recipientName: memberName,
            clinicName: clinicName || "Sindicato",
            boletos,
          },
        });

        if (error) {
          throw new Error(error.message || "Erro ao enviar email");
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        successCount++;
        newResults.push({
          email,
          memberName,
          boletosCount: boletos.length,
          success: true,
        });
      } catch (error: any) {
        errorCount++;
        newResults.push({
          email,
          memberName,
          boletosCount: boletos.length,
          success: false,
          error: error.message || "Erro ao enviar",
        });
      }

      currentIndex++;
      setProgress((currentIndex / totalEmails) * 100);
      setResults([...newResults]);

      // Small delay between emails to avoid rate limiting
      if (currentIndex < totalEmails) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    setSending(false);

    if (successCount > 0 && errorCount === 0) {
      toast.success(`${successCount} email(s) enviado(s) com sucesso!`);
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`${successCount} enviado(s), ${errorCount} com erro`);
    } else {
      toast.error(`Falha ao enviar ${errorCount} email(s)`);
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
            <Mail className="h-5 w-5 text-blue-600" />
            Envio em Lote por Email
          </DialogTitle>
          <DialogDescription>
            Envie as contribuições selecionadas para os sócios por email. Múltiplas contribuições do mesmo sócio serão agrupadas em um único email.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Summary */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {contributions.length} contribuição(ões) selecionada(s)
            </Badge>
            <Badge className="bg-blue-500/15 text-blue-700 border-blue-300 gap-1">
              <Mail className="h-3 w-3" />
              {totalEmails} email(s) a enviar
            </Badge>
            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {totalBoletos} boleto(s) válido(s)
            </Badge>
            {invalidContributions.length > 0 && (
              <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 gap-1">
                <AlertTriangle className="h-3 w-3" />
                {invalidContributions.length} sem email/boleto
              </Badge>
            )}
          </div>

          {/* Preview of grouped emails */}
          {!sending && results.length === 0 && groupedByEmail.size > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Resumo do envio:</p>
              <ScrollArea className="max-h-[200px] border rounded-md p-3">
                <div className="space-y-2">
                  {Array.from(groupedByEmail.entries()).map(([email, contribs]) => (
                    <div key={email} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                      <div>
                        <span className="font-medium">{contribs[0]?.patients?.name}</span>
                        <span className="text-muted-foreground ml-2">({email})</span>
                      </div>
                      <Badge variant="secondary">
                        {contribs.length} boleto(s)
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Progress */}
          {sending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Enviando emails...</span>
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
                    {successResults.map((r, idx) => (
                      <div key={idx} className="text-sm text-muted-foreground pl-5">
                        {r.memberName} - {r.email} ({r.boletosCount} boleto(s))
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
                    {errorResults.map((r, idx) => (
                      <div key={idx} className="text-sm text-muted-foreground pl-5">
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
              disabled={sending || totalEmails === 0}
              className="gap-2"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar {totalEmails} email(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
