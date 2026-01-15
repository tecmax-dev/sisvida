import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CalendarIcon, Copy, ExternalLink, Send, CheckCircle2 } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  phone?: string | null;
  email?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
  default_value: number;
  is_active: boolean;
}

interface CreateAwaitingValueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employer: Employer;
  contributionTypes: ContributionType[];
  clinicId: string;
  userId: string;
  onSuccess: () => void;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function CreateAwaitingValueDialog({
  open,
  onOpenChange,
  employer,
  contributionTypes,
  clinicId,
  userId,
  onSuccess,
}: CreateAwaitingValueDialogProps) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [typeId, setTypeId] = useState("");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dueDate, setDueDate] = useState<Date | undefined>(addMonths(now, 1));
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  
  // Result state
  const [publicLink, setPublicLink] = useState("");
  const [copied, setCopied] = useState(false);

  // Reset form on open
  useEffect(() => {
    if (open) {
      setStep("form");
      setTypeId(contributionTypes.find(t => t.is_active)?.id || "");
      setMonth(now.getMonth() + 1);
      setYear(now.getFullYear());
      setDueDate(addMonths(now, 1));
      setSendWhatsApp(true);
      setPublicLink("");
      setCopied(false);
    }
  }, [open, contributionTypes]);

  const handleCreate = async () => {
    if (!typeId) {
      toast.error("Selecione o tipo de contribuição");
      return;
    }
    if (!dueDate) {
      toast.error("Selecione a data de vencimento");
      return;
    }

    setLoading(true);
    try {
      // Generate unique token
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
      
      // Create contribution
      const { data: newContribution, error: insertError } = await supabase
        .from("employer_contributions")
        .insert({
          clinic_id: clinicId,
          employer_id: employer.id,
          contribution_type_id: typeId,
          competence_month: month,
          competence_year: year,
          value: 0,
          due_date: format(dueDate, "yyyy-MM-dd"),
          status: "awaiting_value",
          public_access_token: token,
          created_by: userId,
        })
        .select("id")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          toast.error("Já existe uma contribuição para esta competência");
        } else {
          throw insertError;
        }
        return;
      }

      // Build public link
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/contribuicao/${token}`;
      setPublicLink(link);

      // Send via WhatsApp if checked
      if (sendWhatsApp && employer.phone) {
        const selectedType = contributionTypes.find(t => t.id === typeId);
        const typeName = selectedType?.name || "Contribuição";
        const competence = `${MONTHS[month - 1]}/${year}`;
        const vencimento = format(dueDate, "dd/MM/yyyy");
        
        const message = encodeURIComponent(
          `Olá! Segue o link para informar o valor e gerar o boleto da contribuição:\n\n` +
          `📋 *${typeName}*\n` +
          `📅 Competência: ${competence}\n` +
          `⏰ Vencimento: ${vencimento}\n\n` +
          `🔗 ${link}\n\n` +
          `Acesse o link, informe o valor e gere seu boleto.`
        );

        const phone = employer.phone.replace(/\D/g, "");
        const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;
        window.open(`https://wa.me/${formattedPhone}?text=${message}`, "_blank");
      }

      toast.success("Contribuição criada com sucesso!");
      setStep("success");
      onSuccess();
    } catch (error: any) {
      console.error("Error creating contribution:", error);
      toast.error(error.message || "Erro ao criar contribuição");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Contribuição Sem Valor</DialogTitle>
          <DialogDescription>
            A empresa receberá um link para informar o valor e emitir o boleto.
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <>
            <div className="space-y-4 py-4">
              {/* Employer Info */}
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium">{employer.name}</p>
                <p className="text-sm text-muted-foreground">
                  CNPJ: {employer.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
                </p>
              </div>

              {/* Contribution Type */}
              <div className="space-y-2">
                <Label>Tipo de Contribuição *</Label>
                <Select value={typeId} onValueChange={setTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contributionTypes.filter(t => t.is_active).map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Competence */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(y => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label>Data de Vencimento *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "dd/MM/yyyy") : "Selecione..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* WhatsApp Option */}
              {employer.phone && (
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="sendWhatsapp"
                    checked={sendWhatsApp}
                    onCheckedChange={(checked) => setSendWhatsApp(!!checked)}
                  />
                  <label htmlFor="sendWhatsapp" className="text-sm cursor-pointer">
                    Enviar link via WhatsApp
                  </label>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar e Gerar Link"
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="py-6 space-y-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Contribuição Criada!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {sendWhatsApp && employer.phone 
                    ? "Link enviado via WhatsApp" 
                    : "Copie o link e envie para a empresa"}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Link para Preenchimento</Label>
              <div className="flex gap-2">
                <Input 
                  value={publicLink} 
                  readOnly 
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(publicLink, "_blank")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Testar Link
              </Button>
              <Button className="flex-1" onClick={() => onOpenChange(false)}>
                Concluir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
