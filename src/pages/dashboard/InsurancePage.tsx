import { useEffect, useState } from "react";
import { 
  Plus, 
  MoreVertical,
  Users,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface InsurancePlan {
  id: string;
  name: string;
  code: string | null;
  procedures: string[] | null;
  is_active: boolean;
  patient_count?: number;
}

const insuranceSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  code: z.string().optional(),
});

export default function InsurancePage() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [insurances, setInsurances] = useState<InsurancePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formErrors, setFormErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    if (currentClinic) {
      fetchInsurances();
    }
  }, [currentClinic]);

  const fetchInsurances = async () => {
    if (!currentClinic) return;
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('insurance_plans')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .order('name');

      if (error) throw error;
      
      // Get patient counts for each insurance
      const insurancesWithCounts = await Promise.all(
        (data || []).map(async (insurance) => {
          const { count } = await supabase
            .from('patients')
            .select('*', { count: 'exact', head: true })
            .eq('insurance_plan_id', insurance.id);
          
          return {
            ...insurance,
            patient_count: count || 0,
          };
        })
      );
      
      setInsurances(insurancesWithCounts);
    } catch (error) {
      console.error("Error fetching insurances:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInsurance = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = insuranceSchema.safeParse({
      name: formName,
      code: formCode || undefined,
    });
    
    if (!validation.success) {
      const errors: typeof formErrors = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === "name") errors.name = err.message;
      });
      setFormErrors(errors);
      return;
    }

    if (!currentClinic) return;

    setSaving(true);
    setFormErrors({});

    try {
      const { error } = await supabase
        .from('insurance_plans')
        .insert({
          clinic_id: currentClinic.id,
          name: formName.trim(),
          code: formCode.trim() || null,
          procedures: ['Consulta', 'Retorno'],
        });

      if (error) throw error;

      toast({
        title: "Convênio cadastrado",
        description: "O convênio foi adicionado com sucesso.",
      });

      setDialogOpen(false);
      setFormName("");
      setFormCode("");
      fetchInsurances();
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard permission="manage_insurance">
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Convênios</h1>
          <p className="text-muted-foreground">
            Gerencie os convênios aceitos pela clínica
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="h-4 w-4 mr-2" />
              Novo Convênio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Convênio</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateInsurance} className="space-y-4">
              <div>
                <Label htmlFor="insuranceName">Nome *</Label>
                <Input
                  id="insuranceName"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Unimed"
                  className={`mt-1.5 ${formErrors.name ? "border-destructive" : ""}`}
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-destructive">{formErrors.name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="insuranceCode">Código</Label>
                <Input
                  id="insuranceCode"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="Código interno (opcional)"
                  className="mt-1.5"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cadastrar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          Carregando convênios...
        </div>
      ) : insurances.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insurances.map((insurance) => (
            <Card key={insurance.id} className="card-hover">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">
                      {insurance.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {insurance.patient_count || 0} pacientes
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Editar</DropdownMenuItem>
                      <DropdownMenuItem>Ver pacientes</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        Desativar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Procedimentos</p>
                  <div className="flex flex-wrap gap-2">
                    {(insurance.procedures || ['Consulta', 'Retorno']).map((proc, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {proc}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="mb-4">Nenhum convênio cadastrado</p>
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar convênio
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
    </RoleGuard>
  );
}
