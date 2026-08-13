import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  isBiolifeBenefit as isBiolifeBenefitShared,
} from "@/lib/biolifeAuthorization";
import { getAuthorizationBlockReasons } from "@/lib/authorizationBlockReasons";
import { AuthorizationBlockNotice } from "@/components/union/authorizations/AuthorizationBlockNotice";
import {
  getBiolifeAuthorizationInfo,
} from "@/lib/biolifeAuthorization";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { addDays, format } from "date-fns";

const formSchema = z.object({
  patient_id: z.string().min(1, "Selecione um associado"),
  beneficiary_type: z.enum(["titular", "dependent"]),
  dependent_id: z.string().optional(),
  benefit_id: z.string().min(1, "Selecione um benefício"),
  validity_days: z.coerce.number().min(1).max(365),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedPatientId?: string;
}

export function CreateAuthorizationDialog({ open, onOpenChange, preselectedPatientId }: Props) {
  const { currentClinic, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [patientSearch, setPatientSearch] = useState("");
  const [patientPopoverOpen, setPatientPopoverOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      patient_id: preselectedPatientId || "",
      beneficiary_type: "titular",
      dependent_id: "",
      benefit_id: "",
      validity_days: 30,
      notes: "",
    },
  });

  const beneficiaryType = form.watch("beneficiary_type");
  const patientId = form.watch("patient_id");
  const benefitId = form.watch("benefit_id");
  const dependentId = form.watch("dependent_id");

  const isFemaleGender = (g?: string | null) => {
    if (!g) return false;
    const v = g.trim().toLowerCase();
    return v === "f" || v.startsWith("fem");
  };

  // Biolife: titular = cobertura 100% pelo sindicato / dependente = somente desconto do laboratório
  const isBiolifeBenefit = (b?: { name?: string | null; partner_name?: string | null } | null) =>
    isBiolifeBenefitShared(b);

  // Fetch patients (union members)
  const { data: patients = [] } = useQuery({
    queryKey: ["union-members-search", currentClinic?.id, patientSearch],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      let query = supabase
        .from("patients")
        .select("id, name, cpf, registration_number, gender")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name")
        .limit(20);

      if (patientSearch) {
        const searchTerm = patientSearch.trim();
        const searchDigits = searchTerm.replace(/\D/g, "");
        
        // If search looks like CPF digits, search both formatted and unformatted
        if (searchDigits.length >= 3) {
          let cpfFormatted = "";
          if (searchDigits.length === 11) {
            cpfFormatted = searchDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
          }
          const cpfFilters = cpfFormatted
            ? `cpf.ilike.%${searchDigits}%,cpf.ilike.%${cpfFormatted}%`
            : `cpf.ilike.%${searchDigits}%`;
          query = query.or(`name.ilike.%${searchTerm}%,${cpfFilters}`);
        } else {
          query = query.or(`name.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%`);
        }
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!currentClinic?.id && open,
  });

  // Fetch dependents for selected patient
  const { data: dependents = [] } = useQuery({
    queryKey: ["patient-dependents", patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data } = await supabase
        .from("patient_dependents")
        .select("id, name, relationship")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!patientId && open,
  });

  // Fetch benefits
  const { data: benefits = [] } = useQuery({
    queryKey: ["union-benefits-active", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data } = await supabase
        .from("union_benefits")
        .select("id, name, partner_name, validity_days")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!currentClinic?.id && open,
  });

  // Fetch union entity to link with authorization
  const { data: unionEntity } = useQuery({
    queryKey: ["union-entity-active", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return null;
      const { data } = await supabase
        .from("union_entities")
        .select("id")
        .eq("clinic_id", currentClinic.id)
        .eq("status", "ativa")
        .single();
      return data;
    },
    enabled: !!currentClinic?.id && open,
  });

  // IDs dos benefícios Biolife na entidade atual (para checagem de cooldown de 12 meses)
  const biolifeBenefitIds = (benefits as Array<{ id: string; name: string | null; partner_name: string | null }>)
    .filter((b) => isBiolifeBenefit(b))
    .map((b) => b.id);

  // Última autorização Biolife do beneficiário selecionado (titular ou dependente),
  // qualquer status exceto revogada — o cooldown de 12 meses é contado separadamente.
  const { data: lastBiolifeAuth } = useQuery({
    queryKey: [
      "last-biolife-authorization",
      patientId,
      beneficiaryType,
      dependentId,
      biolifeBenefitIds.join(","),
    ],
    queryFn: async () => {
      if (!patientId || biolifeBenefitIds.length === 0) return null;
      let query = supabase
        .from("union_authorizations")
        .select("issued_at, benefit_id")
        .in("benefit_id", biolifeBenefitIds)
        .neq("status", "revoked");

      if (beneficiaryType === "dependent") {
        if (!dependentId) return null;
        query = query.eq("dependent_id", dependentId);
      } else {
        query = query.eq("patient_id", patientId).eq("is_for_dependent", false);
      }

      const { data } = await query.order("issued_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
    enabled: !!patientId && biolifeBenefitIds.length > 0 && open,
  });

  // Data em que pode emitir nova Biolife, ou null se pode emitir agora
  const biolifeNextAvailableAt = (() => {
    if (!lastBiolifeAuth?.issued_at) return null;
    const issued = new Date(lastBiolifeAuth.issued_at);
    const next = new Date(issued);
    next.setFullYear(next.getFullYear() + 1);
    return next > new Date() ? next : null;
  })();

  // Update validity_days when benefit changes
  useEffect(() => {
    if (benefitId) {
      const benefit = benefits.find(b => b.id === benefitId);
      if (benefit) {
        form.setValue("validity_days", benefit.validity_days);
      }
    }
  }, [benefitId, benefits, form]);

  // Load preselected patient
  useEffect(() => {
    if (preselectedPatientId && open) {
      form.setValue("patient_id", preselectedPatientId);
      supabase
        .from("patients")
        .select("id, name, cpf, gender")
        .eq("id", preselectedPatientId)
        .single()
        .then(({ data }) => {
          if (data) setSelectedPatient(data);
        });
    }
  }, [preselectedPatientId, open, form]);

  // Carteirinha do titular: vencida bloqueia qualquer emissão de autorização
  const { data: activeCard } = useQuery({
    queryKey: ["authorization-patient-card", patientId, currentClinic?.id],
    queryFn: async () => {
      if (!patientId) return null;
      const { data } = await supabase
        .from("patient_cards")
        .select("id, card_number, expires_at")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!patientId && open,
  });

  const cardExpiredAt =
    activeCard?.expires_at && new Date(activeCard.expires_at) < new Date()
      ? new Date(activeCard.expires_at)
      : null;

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!currentClinic?.id || !user?.id) throw new Error("Contexto inválido");

      // Generate authorization number and hash
      const { data: authNumber } = await supabase.rpc("generate_authorization_number", {
        p_clinic_id: currentClinic.id,
      });
      const { data: hash } = await supabase.rpc("generate_authorization_hash");

      const validFrom = new Date();
      const validUntil = addDays(validFrom, data.validity_days);

      const payload = {
        clinic_id: currentClinic.id,
        patient_id: data.patient_id,
        benefit_id: data.benefit_id,
        is_for_dependent: data.beneficiary_type === "dependent",
        dependent_id: data.beneficiary_type === "dependent" ? data.dependent_id : null,
        authorization_number: authNumber,
        validation_hash: hash,
        valid_from: format(validFrom, "yyyy-MM-dd"),
        valid_until: format(validUntil, "yyyy-MM-dd"),
        notes: data.notes || null,
        created_by: user.id,
        union_entity_id: unionEntity?.id || null,
      };

      const { error } = await supabase
        .from("union_authorizations")
        .insert(payload);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-authorizations"] });
      queryClient.invalidateQueries({ queryKey: ["member-authorizations"] });
      toast({ title: "Autorização gerada com sucesso!" });
      onOpenChange(false);
      form.reset();
      setSelectedPatient(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao gerar autorização", description: error.message, variant: "destructive" });
    },
  });

  const selectedBenefit = benefits.find((b) => b.id === benefitId);
  const blockReasons = getAuthorizationBlockReasons({
    cardExpiredAt: cardExpiredAt || null,
    isBiolife: isBiolifeBenefit(selectedBenefit),
    isForDependent: beneficiaryType === "dependent",
    titularIsFemale: selectedPatient ? isFemaleGender(selectedPatient?.gender) : undefined,
    biolifeNextAvailableAt: biolifeNextAvailableAt || null,
  });

  const onSubmit = (data: FormData) => {
    if (data.beneficiary_type === "dependent" && !data.dependent_id) {
      toast({ title: "Selecione um dependente", variant: "destructive" });
      return;
    }
    if (blockReasons.length > 0) {
      const r = blockReasons[0];
      toast({
        title: r.title,
        description: `${r.detail} Como regularizar: ${r.howToFix.join(" ")}`,
        variant: "destructive",
      });
      return;
    }
    if (cardExpiredAt) {
      toast({
        title: "Carteirinha vencida",
        description: `A carteirinha do associado venceu em ${format(cardExpiredAt, "dd/MM/yyyy")}. Renove a carteirinha para emitir autorizações.`,
        variant: "destructive",
      });
      return;
    }
    const benefit = benefits.find((b) => b.id === data.benefit_id);
    if (
      isBiolifeBenefit(benefit) &&
      data.beneficiary_type === "titular" &&
      !isFemaleGender(selectedPatient?.gender)
    ) {
      toast({
        title: "Benefício exclusivo para associadas",
        description:
          "A cobertura integral Biolife é destinada apenas a associadas do sexo feminino.",
        variant: "destructive",
      });
      return;
    }
    if (isBiolifeBenefit(benefit) && biolifeNextAvailableAt) {
      toast({
        title: "Biolife já utilizado nos últimos 12 meses",
        description: `Este beneficiário só poderá emitir nova autorização Biolife a partir de ${format(biolifeNextAvailableAt, "dd/MM/yyyy")}. Limite: 1 autorização a cada 12 meses.`,
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(data);
  };

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return "";
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Autorização</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Patient Selection */}
            <FormField
              control={form.control}
              name="patient_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Associado *</FormLabel>
                  <Popover open={patientPopoverOpen} onOpenChange={setPatientPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-start font-normal"
                        >
                          {selectedPatient ? (
                            <span>
                              {selectedPatient.name}
                              {selectedPatient.cpf && (
                                <span className="text-muted-foreground ml-2">
                                  ({formatCPF(selectedPatient.cpf)})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Buscar associado...</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Buscar por nome ou CPF..."
                          value={patientSearch}
                          onValueChange={setPatientSearch}
                        />
                        <CommandList>
                          <CommandEmpty>Nenhum associado encontrado</CommandEmpty>
                          <CommandGroup>
                            {patients.map((patient) => (
                              <CommandItem
                                key={patient.id}
                                value={`${patient.name} ${patient.cpf ?? ""} ${patient.registration_number ?? ""}`}
                                onSelect={() => {
                                  field.onChange(patient.id);
                                  setSelectedPatient(patient);
                                  setPatientPopoverOpen(false);
                                }}
                              >
                                <div>
                                  <p>{patient.name}</p>
                                  {patient.cpf && (
                                    <p className="text-xs text-muted-foreground">
                                      CPF: {formatCPF(patient.cpf)}
                                    </p>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Beneficiary Type */}
            <FormField
              control={form.control}
              name="beneficiary_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beneficiário</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="titular" id="titular" />
                        <Label htmlFor="titular">Titular</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem 
                          value="dependent" 
                          id="dependent"
                          disabled={dependents.length === 0}
                        />
                        <Label htmlFor="dependent">
                          Dependente {dependents.length === 0 && "(sem dependentes)"}
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dependent Selection */}
            {beneficiaryType === "dependent" && dependents.length > 0 && (
              <FormField
                control={form.control}
                name="dependent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dependente *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o dependente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {dependents.map((dep) => (
                          <SelectItem key={dep.id} value={dep.id}>
                            {dep.name} ({dep.relationship})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Benefit Selection */}
            <FormField
              control={form.control}
              name="benefit_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Benefício *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o benefício" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {benefits.map((benefit) => (
                        <SelectItem key={benefit.id} value={benefit.id}>
                          {benefit.name}
                          {benefit.partner_name && ` - ${benefit.partner_name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isBiolifeBenefit(benefits.find((b) => b.id === benefitId)) && (
              <div
                className={`rounded-md border p-3 text-sm ${
                  beneficiaryType === "dependent"
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-emerald-500/40 bg-emerald-500/10"
                }`}
              >
                <p className="font-semibold">
                  {getBiolifeAuthorizationInfo(beneficiaryType === "dependent").title}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {getBiolifeAuthorizationInfo(beneficiaryType === "dependent").description}
                </p>
              </div>
            )}

            <AuthorizationBlockNotice reasons={blockReasons} />

            {/* Validity */}
            <FormField
              control={form.control}
              name="validity_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Validade (dias)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max="365" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Observações adicionais..." 
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  mutation.isPending ||
                  !!cardExpiredAt ||
                  (isBiolifeBenefit(benefits.find((b) => b.id === benefitId)) && beneficiaryType === "titular" && !!selectedPatient && !isFemaleGender(selectedPatient?.gender)) ||
                  (isBiolifeBenefit(benefits.find((b) => b.id === benefitId)) && !!biolifeNextAvailableAt)
                }
              >
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Gerar Autorização
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
