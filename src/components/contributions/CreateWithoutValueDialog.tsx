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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CalendarIcon, Copy, ExternalLink, Send, CheckCircle2, Mail, Link2, Check, ChevronsUpDown, MessageCircle, Building2 } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

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

interface CreateWithoutValueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employers: Employer[];
  contributionTypes: ContributionType[];
  clinicId: string;
  userId: string;
  onSuccess: () => void;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Custom domain for portal
const PORTAL_DOMAIN = "https://app.eclini.com.br";

export default function CreateWithoutValueDialog({
  open,
  onOpenChange,
  employers,
  contributionTypes,
  clinicId,
  userId,
  onSuccess,
}: CreateWithoutValueDialogProps) {
  const { currentClinic } = useAuth();
  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  
  // Employer selection
  const [selectedEmployerId, setSelectedEmployerId] = useState("");
  const [employerPopoverOpen, setEmployerPopoverOpen] = useState(false);
  
  // Form fields
  const [typeId, setTypeId] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [dueDate, setDueDate] = useState<Date>(addMonths(new Date(), 1));
  const [dueDateOpen, setDueDateOpen] = useState(false);
  
  // Send options
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  
  // Created contribution data
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  const selectedEmployer = employers.find(e => e.id === selectedEmployerId);
  const activeTypes = contributionTypes.filter(t => t.is_active);
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  useEffect(() => {
    if (open) {
      setStep("form");
      setSelectedEmployerId("");
      setTypeId("");
      setMonth(new Date().getMonth() + 1);
      setYear(new Date().getFullYear());
      setDueDate(addMonths(new Date(), 1));
      setSendWhatsApp(false);
      setSendEmail(false);
      setPublicToken(null);
      setPublicUrl(null);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!selectedEmployerId || !typeId) {
      toast.error("Selecione empresa e tipo de contribuição");
      return;
    }

    // VALIDAÇÃO CRÍTICA: Vencimento não pode ser anterior ao mês de competência
    const competenceStart = new Date(year, month - 1, 1);
    const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    if (dueDate < competenceStart) {
      toast.error(`Data de vencimento não pode ser anterior ao mês de competência (${MONTHS_PT[month - 1]}/${year})`);
      return;
    }

    // VALIDAÇÃO: Competência não pode estar muito no futuro em relação ao vencimento
    const dueDateYear = dueDate.getFullYear();
    if (year > dueDateYear + 1) {
      toast.error(`Competência ${MONTHS_PT[month - 1]}/${year} é inconsistente com a data de vencimento`);
      return;
    }

    setLoading(true);
    try {
      const token = crypto.randomUUID();
      
      const { data, error } = await supabase
        .from("employer_contributions")
        .insert({
          clinic_id: clinicId,
          employer_id: selectedEmployerId,
          contribution_type_id: typeId,
          competence_month: month,
          competence_year: year,
          value: 0,
          due_date: format(dueDate, "yyyy-MM-dd"),
          status: "awaiting_value",
          public_access_token: token,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      const url = `${PORTAL_DOMAIN}/contribuicao/${token}`;
      setPublicToken(token);
      setPublicUrl(url);

      // Send via WhatsApp if checked
      if (sendWhatsApp && selectedEmployer?.phone) {
        await handleSendWhatsApp(url);
      }

      // Send via Email if checked
      if (sendEmail && selectedEmployer?.email) {
        await handleSendEmail(url);
      }

      setStep("success");
      toast.success("Contribuição criada com sucesso!");
    } catch (error: any) {
      console.error("Error creating contribution:", error);
      if (error.message?.includes("unique_active_contribution")) {
        toast.error("Já existe uma contribuição ativa para esta competência");
      } else {
        toast.error("Erro ao criar contribuição");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsApp = async (url: string) => {
    if (!selectedEmployer?.phone || !currentClinic) return;

    const cleanPhone = selectedEmployer.phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) return;

    const typeName = contributionTypes.find(t => t.id === typeId)?.name || "Contribuição";
    const competence = `${String(month).padStart(2, "0")}/${year}`;

    const message = `📋 *Contribuição Sindical - ${typeName}*

Olá *${selectedEmployer.name}*!

Foi gerada uma contribuição referente à competência *${competence}*.

Para informar o valor e gerar o boleto, acesse o link abaixo:

🔗 ${url}

Atenciosamente,
${currentClinic.name}`;

    try {
      await sendWhatsAppMessage({
        phone: cleanPhone,
        message,
        clinicId: currentClinic.id,
        type: "custom",
      });
      toast.success("Link enviado por WhatsApp!");
    } catch (error) {
      console.error("WhatsApp error:", error);
      toast.error("Erro ao enviar WhatsApp");
    }
  };

  const handleSendEmail = async (url: string) => {
    if (!selectedEmployer?.email || !currentClinic) return;

    try {
      const { error } = await supabase.functions.invoke("send-boleto-email", {
        body: {
          to: selectedEmployer.email,
          employerName: selectedEmployer.name,
          clinicName: currentClinic.name,
          publicAccessUrl: url,
          isAwaitingValue: true,
          competence: `${String(month).padStart(2, "0")}/${year}`,
          contributionTypeName: contributionTypes.find(t => t.id === typeId)?.name || "Contribuição",
        },
      });

      if (error) throw error;
      toast.success("Link enviado por E-mail!");
    } catch (error) {
      console.error("Email error:", error);
      toast.error("Erro ao enviar E-mail");
    }
  };

  const handleCopyLink = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado!");
    }
  };

  const handleSendLinkManually = async (type: "whatsapp" | "email") => {
    if (!publicUrl) return;
    setSendingLink(true);
    try {
      if (type === "whatsapp") {
        await handleSendWhatsApp(publicUrl);
      } else {
        await handleSendEmail(publicUrl);
      }
    } finally {
      setSendingLink(false);
    }
  };

  const handleClose = () => {
    if (step === "success") {
      onSuccess();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Nova Contribuição - Sem Valor
          </DialogTitle>
          <DialogDescription>
            Crie uma contribuição aguardando valor. A empresa receberá um link para informar o valor e gerar o boleto.
          </DialogDescription>
        </DialogHeader>

        {step === "form" ? (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 py-4 pr-4">
              {/* Employer Selection */}
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Popover open={employerPopoverOpen} onOpenChange={setEmployerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedEmployer ? (
                        <span className="truncate">{selectedEmployer.name}</span>
                      ) : (
                        <span className="text-muted-foreground">Selecione uma empresa...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar empresa..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma empresa encontrada</CommandEmpty>
                        <CommandGroup>
                          {employers.slice(0, 50).map((employer) => (
                            <CommandItem
                              key={employer.id}
                              value={employer.name}
                              onSelect={() => {
                                setSelectedEmployerId(employer.id);
                                setEmployerPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedEmployerId === employer.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{employer.name}</span>
                                <span className="text-xs text-muted-foreground">{employer.cnpj}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Contribution Type */}
              <div className="space-y-2">
                <Label>Tipo de Contribuição *</Label>
                <Select value={typeId} onValueChange={setTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Competence */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, idx) => (
                        <SelectItem key={idx + 1} value={String(idx + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
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
                <Label>Data de Vencimento</Label>
                <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(date) => {
                        if (date) {
                          setDueDate(date);
                          setDueDateOpen(false);
                        }
                      }}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Send Options */}
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm font-medium">Enviar link automaticamente</Label>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="send-whatsapp"
                    checked={sendWhatsApp}
                    onCheckedChange={(checked) => setSendWhatsApp(checked === true)}
                    disabled={!selectedEmployer?.phone}
                  />
                  <label htmlFor="send-whatsapp" className="text-sm flex items-center gap-2 cursor-pointer">
                    <MessageCircle className="h-4 w-4 text-green-600" />
                    WhatsApp
                    {!selectedEmployer?.phone && (
                      <span className="text-xs text-muted-foreground">(sem telefone)</span>
                    )}
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="send-email"
                    checked={sendEmail}
                    onCheckedChange={(checked) => setSendEmail(checked === true)}
                    disabled={!selectedEmployer?.email}
                  />
                  <label htmlFor="send-email" className="text-sm flex items-center gap-2 cursor-pointer">
                    <Mail className="h-4 w-4 text-blue-600" />
                    E-mail
                    {!selectedEmployer?.email && (
                      <span className="text-xs text-muted-foreground">(sem e-mail)</span>
                    )}
                  </label>
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center text-green-600 mb-4">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            
            <div className="text-center mb-4">
              <p className="font-medium">Contribuição criada com sucesso!</p>
              <p className="text-sm text-muted-foreground">
                A empresa pode acessar o link abaixo para informar o valor e gerar o boleto.
              </p>
            </div>

            {publicUrl && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Input
                    value={publicUrl}
                    readOnly
                    className="text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" asChild>
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleSendLinkManually("whatsapp")}
                    disabled={!selectedEmployer?.phone || sendingLink}
                  >
                    {sendingLink ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                    )}
                    Enviar WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleSendLinkManually("email")}
                    disabled={!selectedEmployer?.email || sendingLink}
                  >
                    {sendingLink ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4 mr-2 text-blue-600" />
                    )}
                    Enviar E-mail
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "form" ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={loading || !selectedEmployerId || !typeId}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Criar e Gerar Link
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
