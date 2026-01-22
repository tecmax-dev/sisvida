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

  // Fetch patients (union members)
  const { data: patients = [] } = useQuery({
    queryKey: ["union-members-search", currentClinic?.id, patientSearch],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      let query = supabase
        .from("patients")
        .select("id, name, cpf, registration_number")
        .eq("clinic_id", currentClinic.id)
        .eq("is_union_member", true)
        .eq("is_active", true)
        .order("name")
        .limit(20);

      if (patientSearch) {
        query = query.or(`name.ilike.%${patientSearch}%,cpf.ilike.%${patientSearch}%`);
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
        .select("id, name, cpf")
        .eq("id", preselectedPatientId)
        .single()
        .then(({ data }) => {
          if (data) setSelectedPatient(data);
        });
    }
  }, [preselectedPatientId, open, form]);

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

  const onSubmit = (data: FormData) => {
    if (data.beneficiary_type === "dependent" && !data.dependent_id) {
      toast({ title: "Selecione um dependente", variant: "destructive" });
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
                      <Command>
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
                                value={patient.id}
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
              <Button type="submit" disabled={mutation.isPending}>
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
