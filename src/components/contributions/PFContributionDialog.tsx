import { useState, useEffect } from "react";
import { getStaticYearRange } from "@/hooks/useAvailableYears";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Loader2, Check, ChevronsUpDown, User, FileStack } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCompetence } from "@/lib/competence-format";
import PFBatchContributionDialog from "./PFBatchContributionDialog";

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
  description: string | null;
  default_value: number;
  is_active: boolean;
}

interface Contribution {
  id: string;
  employer_id: string;
  contribution_type_id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  due_date: string;
  status: string;
  lytex_invoice_id: string | null;
  lytex_invoice_url: string | null;
  lytex_boleto_digitable_line: string | null;
  lytex_pix_code: string | null;
  lytex_pix_qrcode: string | null;
  paid_at: string | null;
  paid_value: number | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  member_id?: string | null;
  patients?: Member;
  contribution_types?: ContributionType;
}

interface PFContributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contributionTypes: ContributionType[];
  clinicId: string;
  userId: string;
  onRefresh: () => void;
  onGenerateInvoice: (contribution: Contribution) => Promise<void>;
  onOpenBatch?: () => void;
}

// CNPJ do Sindicato Comerciários para emissão de boletos PF
const SINDICATO_PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

export default function PFContributionDialog({
  open,
  onOpenChange,
  contributionTypes,
  clinicId,
  userId,
  onRefresh,
  onGenerateInvoice,
  onOpenBatch,
}: PFContributionDialogProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  // Form states
  const [formMemberId, setFormMemberId] = useState("");
  const [formTypeId, setFormTypeId] = useState("");
  const [formMonth, setFormMonth] = useState(new Date().getMonth() + 1);
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formValue, setFormValue] = useState("");
  const [formDueDate, setFormDueDate] = useState(format(addDays(new Date(), 10), "yyyy-MM-dd"));
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Member combobox
  const [memberPopoverOpen, setMemberPopoverOpen] = useState(false);

  // Fetch members (patients) when dialog opens
  useEffect(() => {
    if (open && clinicId) {
      fetchMembers();
    }
  }, [open, clinicId]);

  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, cpf, email, phone")
        .eq("clinic_id", clinicId)
        .not("cpf", "is", null)
        .order("name");

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error("Error fetching members:", error);
      toast.error("Erro ao carregar sócios");
    } finally {
      setLoadingMembers(false);
    }
  };

  const resetForm = () => {
    setFormMemberId("");
    setFormTypeId("");
    setFormMonth(new Date().getMonth() + 1);
    setFormYear(new Date().getFullYear());
    setFormValue("");
    setFormDueDate(format(addDays(new Date(), 10), "yyyy-MM-dd"));
    setFormNotes("");
  };

  const handleTypeChange = (typeId: string) => {
    setFormTypeId(typeId);
    const type = contributionTypes.find((t) => t.id === typeId);
    if (type && type.default_value > 0) {
      setFormValue((type.default_value / 100).toFixed(2).replace(".", ","));
    }
  };

  // Get or create placeholder employer for PF contributions
  const getOrCreatePlaceholderEmployer = async () => {
    // First, check if placeholder already exists
    const { data: existing } = await supabase
      .from("employers")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("cnpj", "00000000000000")
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    // Create placeholder employer for PF contributions
    const { data: created, error } = await supabase
      .from("employers")
      .insert({
        clinic_id: clinicId,
        name: "Contribuições Pessoa Física",
        cnpj: "00000000000000",
        is_active: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating placeholder employer:", error);
      throw new Error("Erro ao configurar contribuição PF");
    }

    return created.id;
  };

  const handleSave = async () => {
    if (!formMemberId || !formTypeId || !formValue || !formDueDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const selectedMember = members.find((m) => m.id === formMemberId);
    if (!selectedMember?.cpf) {
      toast.error("Sócio selecionado não possui CPF cadastrado");
      return;
    }

    // VALIDAÇÃO CRÍTICA: Vencimento não pode ser anterior ao mês de competência
    const dueDateObj = new Date(formDueDate);
    const competenceStart = new Date(formYear, formMonth - 1, 1);
    const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    if (dueDateObj < competenceStart) {
      toast.error(`Data de vencimento não pode ser anterior ao mês de competência (${MONTHS_PT[formMonth - 1]}/${formYear})`);
      return;
    }

    // VALIDAÇÃO: Competência não pode estar muito no futuro em relação ao vencimento
    const dueDateYear = dueDateObj.getFullYear();
    if (formYear > dueDateYear + 1) {
      toast.error(`Competência ${MONTHS_PT[formMonth - 1]}/${formYear} é inconsistente com a data de vencimento`);
      return;
    }

    setSaving(true);
    try {
      const valueInCents = Math.round(parseFloat(formValue.replace(",", ".")) * 100);
      const placeholderEmployerId = await getOrCreatePlaceholderEmployer();

      const { data: newContribution, error } = await supabase
        .from("employer_contributions")
        .insert({
          clinic_id: clinicId,
          employer_id: placeholderEmployerId,
          member_id: formMemberId,
          contribution_type_id: formTypeId,
          competence_month: formMonth,
          competence_year: formYear,
          value: valueInCents,
          due_date: formDueDate,
          notes: formNotes || null,
          created_by: userId,
        })
        .select(`
          *,
          patients:member_id (id, name, cpf, email, phone),
          contribution_types (*)
        `)
        .single();

      if (error) {
        if (error.message.includes("unique_active_contribution_per_employer")) {
          toast.error("Já existe uma contribuição ativa deste tipo para esta competência");
          return;
        }
        throw error;
      }

      toast.success("Contribuição PF criada! Gerando boleto...");
      onOpenChange(false);
      resetForm();
      onRefresh();

      // Gerar boleto automaticamente
      if (newContribution) {
        try {
          await onGenerateInvoice(newContribution as unknown as Contribution);
        } catch (invoiceError) {
          console.error("Error generating invoice:", invoiceError);
        }
      }
    } catch (error) {
      console.error("Error saving PF contribution:", error);
      toast.error("Erro ao salvar contribuição");
    } finally {
      setSaving(false);
    }
  };

  const formatCPF = (cpf: string) => {
    const clean = cpf.replace(/\D/g, "");
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const selectedMember = members.find((m) => m.id === formMemberId);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-purple-600" />
            Nova Contribuição PF
          </DialogTitle>
          <DialogDescription>
            Cadastre uma contribuição individual (Pessoa Física)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sócio/Associado */}
          <div className="space-y-2">
            <Label>Sócio/Associado *</Label>
            <Popover open={memberPopoverOpen} onOpenChange={setMemberPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={memberPopoverOpen}
                  className="w-full justify-between font-normal"
                  disabled={loadingMembers}
                >
                  {loadingMembers ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando...
                    </span>
                  ) : formMemberId ? (
                    <span className="truncate">
                      {selectedMember?.name}
                    </span>
                  ) : (
                    "Selecione o sócio..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nome ou CPF..." />
                  <CommandList>
                    <CommandEmpty>Nenhum sócio encontrado.</CommandEmpty>
                    <CommandGroup>
                      {members.map((member) => (
                        <CommandItem
                          key={member.id}
                          value={`${member.name} ${member.cpf || ""}`}
                          onSelect={() => {
                            setFormMemberId(member.id);
                            setMemberPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formMemberId === member.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{member.name}</span>
                            {member.cpf && (
                              <span className="text-xs text-emerald-600">
                                {formatCPF(member.cpf)}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedMember?.cpf && (
              <p className="text-xs text-muted-foreground">
                CPF: <span className="font-medium text-emerald-600">{formatCPF(selectedMember.cpf)}</span>
              </p>
            )}
          </div>

          {/* Tipo de Contribuição */}
          <div className="space-y-2">
            <Label>Tipo de Contribuição *</Label>
            <Select value={formTypeId} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {contributionTypes
                  .filter((t) => t.is_active)
                  .map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Competência */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mês Competência *</Label>
              <Select
                value={formMonth.toString()}
                onValueChange={(v) => setFormMonth(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      {String(i + 1).padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano *</Label>
              <Select
                value={formYear.toString()}
                onValueChange={(v) => setFormYear(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getStaticYearRange().map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Valor e Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="text"
                placeholder="0,00"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Input
              type="text"
              placeholder="Observações opcionais"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onOpenBatch && (
            <Button
              type="button"
              variant="outline"
              onClick={onOpenBatch}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              <FileStack className="h-4 w-4 mr-2" />
              Gerar em Lote
            </Button>
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
