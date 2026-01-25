import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addDays } from "date-fns";
import { UserPlus, Loader2, AlertCircle, Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CpfInputCard } from "@/components/ui/cpf-input-card";
import { CnpjInputCard } from "@/components/ui/cnpj-input-card";

// Validação de CPF
function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(cleaned[10]);
}

const quickRegistrationSchema = z.object({
  cpf: z.string()
    .min(11, "CPF é obrigatório")
    .refine((val) => isValidCPF(val), "CPF inválido"),
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  birth_date: z.string().min(1, "Data de nascimento é obrigatória"),
  phone: z.string().min(10, "Telefone WhatsApp é obrigatório"),
  employer_cnpj: z.string().optional(),
});

type QuickRegistrationForm = z.infer<typeof quickRegistrationSchema>;

interface QuickPatientRegistrationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (patientId: string) => void;
  initialCpf?: string;
}

export function QuickPatientRegistration({
  open,
  onOpenChange,
  onSuccess,
  initialCpf = "",
}: QuickPatientRegistrationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [cpfChecking, setCpfChecking] = useState(false);
  const [cpfExists, setCpfExists] = useState(false);
  const [cpfExistsType, setCpfExistsType] = useState<'associado' | 'paciente' | null>(null);
  const { currentClinic } = useAuth();

  const form = useForm<QuickRegistrationForm>({
    resolver: zodResolver(quickRegistrationSchema),
    defaultValues: {
      cpf: initialCpf,
      name: "",
      birth_date: "",
      phone: "",
      employer_cnpj: "",
    },
  });

  // Reset cpf check state when dialog closes
  useEffect(() => {
    if (!open) {
      setCpfExists(false);
      setCpfExistsType(null);
    }
  }, [open]);

  // Check CPF in both sindical_associados and patients tables
  const checkCpf = async (cpfValue: string) => {
    if (!currentClinic) return;
    
    const cleanCpf = cpfValue.replace(/\D/g, "");
    if (cleanCpf.length !== 11) return;

    setCpfChecking(true);
    setCpfExists(false);
    setCpfExistsType(null);
    
    try {
      // Get sindicato linked to this clinic
      const { data: sindicato } = await supabase
        .from("union_entities")
        .select("id")
        .eq("clinic_id", currentClinic.id)
        .eq("status", "ativa")
        .maybeSingle();

      // Check in sindical_associados (pending applications)
      if (sindicato) {
        const { data: associadoData } = await supabase
          .from("sindical_associados")
          .select("id")
          .eq("sindicato_id", sindicato.id)
          .eq("cpf", cleanCpf)
          .maybeSingle();

        if (associadoData) {
          setCpfExists(true);
          setCpfExistsType('associado');
          return;
        }
      }

      // Check in patients table (already registered members)
      const formattedCpf = cleanCpf
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        
      const { data: patientData } = await supabase
        .from("patients")
        .select("id")
        .eq("clinic_id", currentClinic.id)
        .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`)
        .maybeSingle();

      if (patientData) {
        setCpfExists(true);
        setCpfExistsType('paciente');
        return;
      }
    } finally {
      setCpfChecking(false);
    }
  };

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    return cleaned
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  };

  const formatCNPJ = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 14);
    return cleaned
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const onSubmit = async (data: QuickRegistrationForm) => {
    if (!currentClinic) {
      toast.error("Clínica não encontrada");
      return;
    }

    // Block submission if CPF already exists
    if (cpfExists) {
      toast.error(
        cpfExistsType === 'paciente' ? "CPF já cadastrado" : "Solicitação já existe",
        {
          description: cpfExistsType === 'paciente'
            ? "Este CPF já possui cadastro ativo. Verifique na lista de pacientes."
            : "Este CPF já possui uma solicitação de filiação pendente.",
        }
      );
      return;
    }

    setIsLoading(true);
    try {
      // Check if CPF already exists
      const cpfCleaned = data.cpf.replace(/\D/g, "");
      const { data: existing } = await supabase
        .from("patients")
        .select("id")
        .eq("clinic_id", currentClinic.id)
        .eq("cpf", cpfCleaned)
        .maybeSingle();

      if (existing) {
        toast.error("CPF já cadastrado", {
          description: "Este CPF já está vinculado a outro paciente.",
        });
        setIsLoading(false);
        return;
      }

      // Generate registration number
      const { data: registrationNumber } = await supabase.rpc(
        "generate_patient_registration_number",
        { p_clinic_id: currentClinic.id }
      );

      // Create patient
      const { data: patient, error: patientError } = await supabase
        .from("patients")
        .insert({
          clinic_id: currentClinic.id,
          name: data.name.trim(),
          cpf: cpfCleaned,
          birth_date: data.birth_date,
          phone: data.phone.replace(/\D/g, ""),
          employer_cnpj: data.employer_cnpj?.replace(/\D/g, "") || null,
          registration_number: registrationNumber || null,
        })
        .select("id")
        .single();

      if (patientError) throw patientError;

      // Generate card number (uses patient's registration_number)
      const { data: cardNumber, error: cardError } = await supabase.rpc(
        "generate_card_number",
        { p_clinic_id: currentClinic.id, p_patient_id: patient.id }
      );

      if (cardError) {
        console.error("Error generating card number:", cardError);
      } else {
        // Create patient card with 15 days validity
        const expiresAt = addDays(new Date(), 15);
        
        const { error: insertCardError } = await supabase
          .from("patient_cards")
          .insert({
            clinic_id: currentClinic.id,
            patient_id: patient.id,
            card_number: cardNumber,
            issued_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            is_active: true,
            token: crypto.randomUUID(),
          });

        if (insertCardError) {
          console.error("Error creating card:", insertCardError);
        }
      }

      toast.success("Paciente cadastrado com sucesso!", {
        description: "Carteirinha digital criada com validade de 15 dias.",
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.(patient.id);
    } catch (error: any) {
      console.error("Error registering patient:", error);
      if (error.message?.includes("CPF_DUPLICADO")) {
        toast.error("CPF já cadastrado");
      } else {
        toast.error("Erro ao cadastrar paciente", {
          description: error.message,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Cadastro Rápido de Paciente
          </DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para cadastrar um novo paciente. 
            Uma carteirinha digital será criada automaticamente com validade de 15 dias.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <CpfInputCard
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                        if (value.replace(/\D/g, "").length === 11) {
                          checkCpf(value);
                        } else {
                          setCpfExists(false);
                          setCpfExistsType(null);
                        }
                      }}
                      error={cpfExists ? "CPF já cadastrado" : form.formState.errors.cpf?.message}
                      required
                      showValidation
                      loading={cpfChecking}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Alert for existing CPF */}
            {cpfExists && (
              <Alert className="border-amber-300 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-700">
                  <strong className="block mb-1">
                    {cpfExistsType === 'paciente' 
                      ? "CPF já cadastrado" 
                      : "Solicitação de filiação pendente"}
                  </strong>
                  {cpfExistsType === 'paciente' 
                    ? "Este CPF já possui cadastro ativo. Verifique na lista de pacientes."
                    : "Este CPF já possui uma solicitação de filiação em análise. Aprove ou rejeite antes de cadastrar."}
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nome do paciente" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="birth_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Nascimento *</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone WhatsApp *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="(00) 00000-0000"
                      onChange={(e) => field.onChange(formatPhone(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="employer_cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <CnpjInputCard
                      value={field.value || ""}
                      onChange={field.onChange}
                      label="CNPJ da Empresa (opcional)"
                      showLookupButton={false}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Cadastrar
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
