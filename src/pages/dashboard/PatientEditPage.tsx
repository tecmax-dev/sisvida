import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface Patient {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  cpf: string | null;
  address: string | null;
  birth_date: string | null;
  notes: string | null;
  insurance_plan_id: string | null;
}

interface InsurancePlan {
  id: string;
  name: string;
}

// Validação de CPF brasileiro
const isValidCPF = (cpf: string): boolean => {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
};

const formatCPF = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  return cleaned
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .substring(0, 14);
};

const formatPhone = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  return cleaned
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .substring(0, 15);
};

const patientSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(100),
  phone: z.string().min(10, "Telefone inválido").max(20),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  cpf: z.string()
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || val.replace(/\D/g, '').length === 0 || isValidCPF(val), {
      message: "CPF inválido"
    }),
  birth_date: z.string().optional().or(z.literal("")),
  address: z.string().max(200, "Endereço deve ter no máximo 200 caracteres").optional().or(z.literal("")),
  insurance_plan_id: z.string().optional().or(z.literal("")),
  notes: z.string().max(500, "Observações deve ter no máximo 500 caracteres").optional().or(z.literal("")),
});

export default function PatientEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);
  
  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");
  const [insurancePlanId, setInsurancePlanId] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (currentClinic && id) {
      fetchPatient();
      fetchInsurancePlans();
    }
  }, [currentClinic, id]);

  const fetchPatient = async () => {
    if (!currentClinic || !id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .eq('clinic_id', currentClinic.id)
        .single();

      if (error) throw error;
      
      if (data) {
        setPatient(data);
        setName(data.name);
        setPhone(formatPhone(data.phone));
        setEmail(data.email || "");
        setCpf(data.cpf ? formatCPF(data.cpf) : "");
        setBirthDate(data.birth_date || "");
        setAddress(data.address || "");
        setInsurancePlanId(data.insurance_plan_id || "");
        setNotes(data.notes || "");
      }
    } catch (error) {
      console.error("Error fetching patient:", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar os dados do paciente.",
        variant: "destructive",
      });
      navigate('/dashboard/patients');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsurancePlans = async () => {
    if (!currentClinic) return;
    
    try {
      const { data, error } = await supabase
        .from('insurance_plans')
        .select('id, name')
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setInsurancePlans(data || []);
    } catch (error) {
      console.error("Error fetching insurance plans:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = patientSchema.safeParse({
      name,
      phone,
      email: email || undefined,
      cpf: cpf || undefined,
      birth_date: birthDate || undefined,
      address: address || undefined,
      insurance_plan_id: insurancePlanId || undefined,
      notes: notes || undefined,
    });
    
    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        newErrors[field] = err.message;
      });
      setErrors(newErrors);
      return;
    }

    if (!currentClinic || !id) return;

    setSaving(true);
    setErrors({});

    try {
      const { error } = await supabase
        .from('patients')
        .update({
          name: name.trim(),
          phone: phone.replace(/\D/g, '').trim(),
          email: email.trim() || null,
          cpf: cpf.replace(/\D/g, '').trim() || null,
          address: address.trim() || null,
          birth_date: birthDate || null,
          notes: notes.trim() || null,
          insurance_plan_id: insurancePlanId || null,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Paciente atualizado",
        description: "As informações foram salvas com sucesso.",
      });

      navigate('/dashboard/patients');
    } catch (error: any) {
      if (error.message?.includes('CPF_DUPLICADO') || error.message?.includes('idx_patients_cpf_clinic')) {
        setErrors({ cpf: "Este CPF já está cadastrado no sistema." });
        toast({
          title: "CPF duplicado",
          description: "Este CPF já está cadastrado no sistema.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao atualizar",
          description: error.message || "Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Paciente não encontrado.</p>
        <Button variant="outline" onClick={() => navigate('/dashboard/patients')} className="mt-4">
          Voltar para lista
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/patients')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Editar Paciente</h1>
          <p className="text-muted-foreground">{patient.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Paciente</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`mt-1.5 ${errors.name ? "border-destructive" : ""}`}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-destructive">{errors.name}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className={`mt-1.5 ${errors.phone ? "border-destructive" : ""}`}
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-destructive">{errors.phone}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className={`mt-1.5 ${errors.cpf ? "border-destructive" : ""}`}
                />
                {errors.cpf && (
                  <p className="mt-1 text-sm text-destructive">{errors.cpf}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className={`mt-1.5 ${errors.email ? "border-destructive" : ""}`}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-destructive">{errors.email}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="birthDate">Data de Nascimento</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              
              <div className="sm:col-span-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro, cidade"
                  className={`mt-1.5 ${errors.address ? "border-destructive" : ""}`}
                />
                {errors.address && (
                  <p className="mt-1 text-sm text-destructive">{errors.address}</p>
                )}
              </div>
              
              <div className="sm:col-span-2">
                <Label htmlFor="insurance">Plano de Saúde</Label>
                <Select value={insurancePlanId || "none"} onValueChange={(val) => setInsurancePlanId(val === "none" ? "" : val)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {insurancePlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="sm:col-span-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informações adicionais sobre o paciente"
                  className={`mt-1.5 ${errors.notes ? "border-destructive" : ""}`}
                  rows={3}
                />
                {errors.notes && (
                  <p className="mt-1 text-sm text-destructive">{errors.notes}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard/patients')}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
