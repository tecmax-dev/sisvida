import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CalendarIcon, Copy, ExternalLink, Send, CheckCircle2, Mail, FileText, Link2 } from "lucide-react";
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

type CreationMode = "with_value" | "without_value";

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
  
  // Mode selection
  const [mode, setMode] = useState<CreationMode>("with_value");
  
  // Form state
  const [typeId, setTypeId] = useState("");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dueDate, setDueDate] = useState<Date | undefined>(addMonths(now, 1));
  const [value, setValue] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  
  // Result state
  const [publicLink, setPublicLink] = useState("");
  const [copied, setCopied] = useState(false);

  // Reset form on open
  useEffect(() => {
    if (open) {
      setStep("form");
      setMode("with_value");
      const activeType = contributionTypes.find(t => t.is_active);
      setTypeId(activeType?.id || "");
      setValue(activeType?.default_value ? String(activeType.default_value / 100) : "");
      setMonth(now.getMonth() + 1);
      setYear(now.getFullYear());
      setDueDate(addMonths(now, 1));
      setSendWhatsApp(false);
      setSendEmail(false);
      setEmailAddress(employer.email || "");
      setPublicLink("");
      setCopied(false);
    }
  }, [open, contributionTypes]);

  // Update value when type changes
  useEffect(() => {
    if (mode === "with_value" && typeId) {
      const selectedType = contributionTypes.find(t => t.id === typeId);
      if (selectedType?.default_value) {
        setValue(String(selectedType.default_value / 100));
      }
    }
  }, [typeId, mode, contributionTypes]);

  const handleCreate = async () => {
    if (!typeId) {
      toast.error("Selecione o tipo de contribuição");
      return;
    }
    if (!dueDate) {
      toast.error("Selecione a data de vencimento");
      return;
    }
    
    // Validate value for "with_value" mode
    if (mode === "with_value") {
      const numericValue = parseFloat(value.replace(",", "."));
      if (isNaN(numericValue) || numericValue <= 0) {
        toast.error("Informe um valor válido maior que zero");
        return;
      }
    }

    setLoading(true);
    try {
      const isAwaitingValue = mode === "without_value";
      const token = isAwaitingValue ? crypto.randomUUID().replace(/-/g, "").slice(0, 32) : null;
      const numericValue = isAwaitingValue ? 0 : Math.round(parseFloat(value.replace(",", ".")) * 100);
      
      // Create contribution
      const { data: newContribution, error: insertError } = await supabase
        .from("employer_contributions")
        .insert({
          clinic_id: clinicId,
          employer_id: employer.id,
          contribution_type_id: typeId,
          competence_month: month,
          competence_year: year,
          value: numericValue,
          due_date: format(dueDate, "yyyy-MM-dd"),
          status: isAwaitingValue ? "awaiting_value" : "pending",
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

      // For "without_value" mode, build public link
      if (isAwaitingValue && token) {
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

        // Send via Email if checked
        if (sendEmail && emailAddress) {
          const selectedType = contributionTypes.find(t => t.id === typeId);
          const typeName = selectedType?.name || "Contribuição";
          
          try {
            const { data: clinicData } = await supabase
              .from("clinics")
              .select("name")
              .eq("id", clinicId)
              .single();
            
            const clinicName = clinicData?.name || "Sistema";
            
            const { error: emailError } = await supabase.functions.invoke("send-boleto-email", {
              body: {
                recipientEmail: emailAddress,
                recipientName: employer.name,
                clinicName,
                boletos: [{
                  employerName: employer.name,
                  employerCnpj: employer.cnpj,
                  contributionType: typeName,
                  competenceMonth: month,
                  competenceYear: year,
                  value: 0,
                  dueDate: format(dueDate, "yyyy-MM-dd"),
                  invoiceUrl: link,
                  isAwaitingValue: true,
                }],
              },
            });
            
            if (emailError) {
              console.error("Email send error:", emailError);
              toast.warning("Contribuição criada, mas erro ao enviar e-mail");
            } else {
              toast.success("E-mail enviado com sucesso!");
            }
          } catch (emailErr) {
            console.error("Email error:", emailErr);
            toast.warning("Contribuição criada, mas erro ao enviar e-mail");
          }
        }

        toast.success("Contribuição criada com sucesso!");
        setStep("success");
      } else {
        // For "with_value" mode, just show success and close
        toast.success("Contribuição criada com sucesso!");
        onOpenChange(false);
      }
      
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
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="md">
      <PopupHeader>
        <PopupTitle>Nova Contribuição</PopupTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha como deseja criar a contribuição para esta empresa.
        </p>
      </PopupHeader>

      <div className="max-h-[70vh] overflow-y-auto">
        {step === "form" ? (
          <div className="space-y-4 py-4">
            {/* Employer Info */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-medium">{employer.name}</p>
              <p className="text-sm text-muted-foreground">
                CNPJ: {employer.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
              </p>
            </div>

            {/* Mode Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Modo de Criação</Label>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as CreationMode)}
                className="grid grid-cols-2 gap-3"
              >
                <Label
                  htmlFor="with_value"
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-all",
                    mode === "with_value"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <RadioGroupItem value="with_value" id="with_value" className="sr-only" />
                  <FileText className={cn(
                    "h-6 w-6",
                    mode === "with_value" ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-sm font-medium text-center",
                    mode === "with_value" ? "text-primary" : "text-muted-foreground"
                  )}>
                    Com Valor
                  </span>
                  <span className="text-xs text-muted-foreground text-center">
                    Definir valor agora
                  </span>
                </Label>
                <Label
                  htmlFor="without_value"
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-all",
                    mode === "without_value"
                      ? "border-amber-500 bg-amber-500/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <RadioGroupItem value="without_value" id="without_value" className="sr-only" />
                  <Link2 className={cn(
                    "h-6 w-6",
                    mode === "without_value" ? "text-amber-500" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-sm font-medium text-center",
                    mode === "without_value" ? "text-amber-600" : "text-muted-foreground"
                  )}>
                    Sem Valor
                  </span>
                  <span className="text-xs text-muted-foreground text-center">
                    Empresa informa
                  </span>
                </Label>
              </RadioGroup>
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

            {/* Value (only for with_value mode) */}
            {mode === "with_value" && (
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
            )}

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

            {/* Send Options (only for without_value mode) */}
            {mode === "without_value" && (
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-xs uppercase text-muted-foreground">Enviar Link para Empresa</Label>
                
                {/* WhatsApp Option */}
                {employer.phone && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sendWhatsapp"
                      checked={sendWhatsApp}
                      onCheckedChange={(checked) => setSendWhatsApp(!!checked)}
                    />
                    <label htmlFor="sendWhatsapp" className="text-sm cursor-pointer flex items-center gap-2">
                      <Send className="h-4 w-4 text-emerald-600" />
                      Enviar via WhatsApp
                    </label>
                  </div>
                )}

                {/* Email Option */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sendEmail"
                      checked={sendEmail}
                      onCheckedChange={(checked) => setSendEmail(!!checked)}
                    />
                    <label htmlFor="sendEmail" className="text-sm cursor-pointer flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-600" />
                      Enviar via E-mail
                    </label>
                  </div>
                  {sendEmail && (
                    <Input
                      type="email"
                      placeholder="email@empresa.com"
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      className="ml-6"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center text-center py-4">
              <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold">Contribuição Criada!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                O link foi gerado para a empresa informar o valor.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Link para enviar à empresa</Label>
              <div className="flex gap-2">
                <Input value={publicLink} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  <Copy className={cn("h-4 w-4", copied && "text-emerald-600")} />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={publicLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <PopupFooter>
        {step === "form" ? (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Contribuição
            </Button>
          </>
        ) : (
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Fechar
          </Button>
        )}
      </PopupFooter>
    </PopupBase>
  );
}
