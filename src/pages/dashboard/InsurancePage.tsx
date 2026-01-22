import { useEffect, useState } from "react";
import { 
  Plus, 
  MoreVertical,
  Users,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { cn } from "@/lib/utils";

interface InsurancePlan {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
  procedures: string[] | null;
  is_active: boolean;
  patient_count?: number;
}

const PRESET_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#6366F1', // indigo
  '#84CC16', // lime
];

const insuranceSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  code: z.string().optional(),
});

export default function InsurancePage() {
  const { currentClinic } = useAuth();
  const { hasPermission } = usePermissions();
  const canManageInsurance = hasPermission("insurance_plans");
  const { toast } = useToast();
  const [insurances, setInsurances] = useState<InsurancePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formColor, setFormColor] = useState("#3B82F6");
  const [formErrors, setFormErrors] = useState<{ name?: string }>({});
  
  // Edit mode
  const [editingInsurance, setEditingInsurance] = useState<InsurancePlan | null>(null);

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

  const handleOpenDialog = (insurance?: InsurancePlan) => {
    if (insurance) {
      setEditingInsurance(insurance);
      setFormName(insurance.name);
      setFormCode(insurance.code || "");
      setFormColor(insurance.color || "#3B82F6");
    } else {
      setEditingInsurance(null);
      setFormName("");
      setFormCode("");
      setFormColor("#3B82F6");
    }
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingInsurance(null);
    setFormName("");
    setFormCode("");
    setFormColor("#3B82F6");
    setFormErrors({});
  };

  const handleSaveInsurance = async (e: React.FormEvent) => {
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
      if (editingInsurance) {
        // Update existing
        const { error } = await supabase
          .from('insurance_plans')
          .update({
            name: formName.trim(),
            code: formCode.trim() || null,
            color: formColor,
          })
          .eq('id', editingInsurance.id);

        if (error) throw error;

        toast({
          title: "Convênio atualizado",
          description: "As alterações foram salvas com sucesso.",
        });
      } else {
        // Create new
        const { error } = await supabase
          .from('insurance_plans')
          .insert({
            clinic_id: currentClinic.id,
            name: formName.trim(),
            code: formCode.trim() || null,
            color: formColor,
            procedures: ['Consulta', 'Retorno'],
          });

        if (error) throw error;

        toast({
          title: "Convênio cadastrado",
          description: "O convênio foi adicionado com sucesso.",
        });
      }

      handleCloseDialog();
      fetchInsurances();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (insurance: InsurancePlan) => {
    setTogglingId(insurance.id);

    try {
      const { error } = await supabase
        .from('insurance_plans')
        .update({ is_active: !insurance.is_active })
        .eq('id', insurance.id);

      if (error) throw error;

      toast({
        title: insurance.is_active ? "Convênio desativado" : "Convênio ativado",
        description: insurance.is_active 
          ? "O convênio não aparecerá mais para seleção." 
          : "O convênio está disponível novamente.",
      });

      fetchInsurances();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <RoleGuard permission="insurance_plans">
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Convênios</h1>
          <p className="text-muted-foreground">
            Gerencie os convênios aceitos pela clínica
          </p>
        </div>
        {canManageInsurance && (
          <Button variant="hero" onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Convênio
          </Button>
        )}
      </div>

      {/* Dialog for Create/Edit */}
      <PopupBase open={dialogOpen} onClose={handleCloseDialog}>
        <PopupHeader>
          <PopupTitle>
            {editingInsurance ? "Editar Convênio" : "Cadastrar Convênio"}
          </PopupTitle>
        </PopupHeader>
        <form onSubmit={handleSaveInsurance} className="space-y-4">
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
          <div>
            <Label>Cor do convênio</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormColor(color)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                    formColor === color 
                      ? "border-foreground ring-2 ring-offset-2 ring-offset-background" 
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
          <PopupFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseDialog}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingInsurance ? "Salvar" : "Cadastrar"}
            </Button>
          </PopupFooter>
        </form>
      </PopupBase>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          Carregando convênios...
        </div>
      ) : insurances.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insurances.map((insurance) => (
            <Card 
              key={insurance.id} 
              className={cn(
                "card-hover",
                !insurance.is_active && "opacity-60"
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: insurance.color || '#3B82F6' }}
                      />
                      <h3 className="font-semibold text-foreground text-lg">
                        {insurance.name}
                      </h3>
                      {!insurance.is_active && (
                        <Badge variant="secondary" className="text-xs">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {insurance.patient_count || 0} pacientes
                    </div>
                  </div>
                  {canManageInsurance && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenDialog(insurance)}>
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleToggleActive(insurance)}
                          disabled={togglingId === insurance.id}
                        >
                          {togglingId === insurance.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : insurance.is_active ? (
                            <XCircle className="h-4 w-4 mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          {insurance.is_active ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {insurance.code && (
                  <p className="text-sm text-muted-foreground mb-2">
                    Código: {insurance.code}
                  </p>
                )}

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
            {canManageInsurance && (
              <Button variant="outline" onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar convênio
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
    </RoleGuard>
  );
}
