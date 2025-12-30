import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Building2, 
  Search, 
  ExternalLink,
  Users,
  Calendar,
  Ban,
  CheckCircle,
  AlertTriangle,
  Loader2,
  CreditCard,
  Trash2,
  Stethoscope,
  MoreHorizontal,
  TrendingUp,
  Activity,
  RefreshCw,
  Wrench,
  Settings,
  DollarSign,
  Clock,
  Mail,
  ShieldCheck,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SendWelcomeDialog } from "@/components/admin/SendWelcomeDialog";
import { Switch } from "@/components/ui/switch";
import { MercadoPagoPaymentDialog } from "@/components/payments/MercadoPagoPaymentDialog";

interface Clinic {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  cnpj: string | null;
  created_at: string;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_reason: string | null;
  blocked_by: string | null;
  is_maintenance: boolean;
  maintenance_at: string | null;
  maintenance_reason: string | null;
  maintenance_by: string | null;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  max_professionals: number;
  monthly_price: number;
}

interface ClinicSubscription {
  id: string;
  status: string;
  plan_id: string;
  plan: SubscriptionPlan;
}

interface ClinicWithCounts extends Clinic {
  patientsCount: number;
  appointmentsCount: number;
  professionalsCount: number;
  subscription?: ClinicSubscription | null;
}

// Stats Card Component
const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  color: string 
}) => (
  <div className={`relative overflow-hidden rounded-xl p-5 ${color} transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}>
    <div className="stat-decoration" />
    <div className="relative z-10">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-white/20">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-sm text-white/80 mt-1">{label}</p>
    </div>
  </div>
);

// Clinic Card Component
interface ClinicCardProps {
  clinic: ClinicWithCounts;
  onAccess: (clinic: ClinicWithCounts) => void;
  onManagePlan: (clinic: ClinicWithCounts) => void;
  onBlock: (clinic: ClinicWithCounts) => void;
  onUnblock: (clinic: ClinicWithCounts) => void;
  onMaintenance: (clinic: ClinicWithCounts) => void;
  onRemoveMaintenance: (clinic: ClinicWithCounts) => void;
  onDelete: (clinic: ClinicWithCounts) => void;
  onSendWelcome: (clinic: ClinicWithCounts) => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

const ClinicCard = ({ 
  clinic, 
  onAccess, 
  onManagePlan, 
  onBlock, 
  onUnblock,
  onMaintenance,
  onRemoveMaintenance,
  onDelete,
  onSendWelcome,
  getStatusBadge 
}: ClinicCardProps) => {
  const getClinicStatus = () => {
    if (clinic.is_blocked) return 'blocked';
    if (clinic.is_maintenance) return 'maintenance';
    return 'active';
  };

  const status = getClinicStatus();

  return (
    <div className={`group relative overflow-hidden rounded-xl border p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
      status === 'blocked' 
        ? "bg-destructive/5 border-destructive/30" 
        : status === 'maintenance'
        ? "bg-warning/5 border-warning/30"
        : "bg-card border-border hover:border-primary/30"
    }`}>
      {/* Decorative gradient */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${
        status === 'blocked' 
          ? "bg-destructive" 
          : status === 'maintenance' 
          ? "bg-warning" 
          : "bg-gradient-to-r from-primary to-primary-glow"
      }`} />
      
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
            status === 'blocked'
              ? "bg-destructive/10 text-destructive"
              : status === 'maintenance' 
              ? "bg-warning/10 text-warning" 
              : "bg-gradient-to-br from-primary/20 to-primary/10 text-primary"
          }`}>
            {status === 'blocked' ? (
              <Ban className="h-6 w-6" />
            ) : status === 'maintenance' ? (
              <Wrench className="h-6 w-6" />
            ) : (
              <Building2 className="h-6 w-6" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{clinic.name}</p>
            <code className="text-xs text-muted-foreground font-mono">/{clinic.slug}</code>
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end shrink-0">
          {status === 'blocked' ? (
            <Badge variant="destructive" className="gap-1.5">
              <Ban className="h-3 w-3" />
              Bloqueada
            </Badge>
          ) : status === 'maintenance' ? (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1.5">
              <Wrench className="h-3 w-3" />
              Manutenção
            </Badge>
          ) : (
            <Badge className="bg-success/10 text-success border-success/20 gap-1.5">
              <CheckCircle className="h-3 w-3" />
              Ativa
            </Badge>
          )}
        </div>
      </div>
    
    {/* Metrics */}
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="text-center p-3 rounded-lg bg-muted/50 border border-border/50">
        <Stethoscope className="h-4 w-4 mx-auto mb-1.5 text-primary" />
        <span className="text-lg font-bold block text-foreground">
          {clinic.professionalsCount}
          {clinic.subscription && (
            <span className="text-muted-foreground text-sm font-normal">/{clinic.subscription.plan.max_professionals}</span>
          )}
        </span>
        <p className="text-xs text-muted-foreground">Profissionais</p>
      </div>
      <div className="text-center p-3 rounded-lg bg-muted/50 border border-border/50">
        <Users className="h-4 w-4 mx-auto mb-1.5 text-info" />
        <span className="text-lg font-bold block text-foreground">{clinic.patientsCount}</span>
        <p className="text-xs text-muted-foreground">Pacientes</p>
      </div>
      <div className="text-center p-3 rounded-lg bg-muted/50 border border-border/50">
        <Calendar className="h-4 w-4 mx-auto mb-1.5 text-warning" />
        <span className="text-lg font-bold block text-foreground">{clinic.appointmentsCount}</span>
        <p className="text-xs text-muted-foreground">Agendamentos</p>
      </div>
    </div>
    
    {/* Plan & Date */}
    <div className="flex items-center justify-between text-sm flex-wrap gap-2 mb-4 pb-4 border-b border-border/50">
      <div className="flex items-center gap-2">
        {clinic.subscription ? (
          <>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              {clinic.subscription.plan.name}
            </Badge>
            {getStatusBadge(clinic.subscription.status)}
          </>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Sem plano</Badge>
        )}
      </div>
      <span className="text-muted-foreground text-xs">
        Criada em {new Date(clinic.created_at).toLocaleDateString('pt-BR')}
      </span>
    </div>
    
      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button 
          size="sm" 
          variant="outline" 
          className="flex-1 hover:bg-primary/5 hover:text-primary hover:border-primary/30"
          onClick={() => onManagePlan(clinic)}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Plano
        </Button>
        
        {/* Maintenance toggle */}
        {clinic.is_maintenance ? (
          <Button 
            size="sm" 
            variant="outline"
            className="text-success hover:bg-success/10 hover:border-success/30"
            onClick={() => onRemoveMaintenance(clinic)}
            title="Desativar manutenção"
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
        ) : (
          <Button 
            size="sm" 
            variant="outline"
            className="text-warning hover:bg-warning/10 hover:border-warning/30"
            onClick={() => onMaintenance(clinic)}
            title="Ativar manutenção"
            disabled={clinic.is_blocked}
          >
            <Wrench className="h-4 w-4" />
          </Button>
        )}
        
        {/* Block toggle */}
        {clinic.is_blocked ? (
          <Button 
            size="sm" 
            variant="outline"
            className="text-success hover:bg-success/10 hover:border-success/30"
            onClick={() => onUnblock(clinic)}
            title="Desbloquear"
          >
            <Ban className="h-4 w-4" />
          </Button>
        ) : (
          <Button 
            size="sm" 
            variant="outline"
            className="text-destructive hover:bg-destructive/10 hover:border-destructive/30"
            onClick={() => onBlock(clinic)}
            title="Bloquear (inadimplência)"
          >
            <Ban className="h-4 w-4" />
          </Button>
        )}
        
        <Button 
          size="sm" 
          variant="outline"
          className="text-info hover:bg-info/10 hover:border-info/30"
          onClick={() => onSendWelcome(clinic)}
          title="Enviar boas-vindas"
        >
          <Mail className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          variant="outline"
          className="text-destructive hover:bg-destructive/10 hover:border-destructive/30"
          onClick={() => onDelete(clinic)}
          title="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button 
          size="sm" 
          className="flex-1 bg-primary hover:bg-primary/90"
          onClick={() => onAccess(clinic)}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Acessar
        </Button>
      </div>
    </div>
  );
};

export default function ClinicsManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Block/Unblock dialogs (inadimplência - bloqueia totalmente)
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<ClinicWithCounts | null>(null);
  const [blockReason, setBlockReason] = useState("");
  
  // Maintenance dialogs (manutenção - apenas aviso)
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [maintenanceReason, setMaintenanceReason] = useState("");
  
  // Plan management dialog
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("trial");
  
  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmClinicName, setConfirmClinicName] = useState("");
  
  // Welcome dialog
  const [welcomeDialogOpen, setWelcomeDialogOpen] = useState(false);
  
  // Settings dialog
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [maxCpfAppointments, setMaxCpfAppointments] = useState<number | null>(null);
  
  // Payment dialog
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  
  const { setCurrentClinic, user } = useAuth();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();

  // Fetch plans with React Query
  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, max_professionals, monthly_price')
        .eq('is_active', true)
        .order('monthly_price', { ascending: true });

      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  // Fetch clinics with React Query
  const { data: clinics = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-clinics"],
    queryFn: async () => {
      const { data: clinicsData, error } = await supabase
        .from('clinics')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const clinicsWithCounts = await Promise.all(
        (clinicsData || []).map(async (clinic) => {
          const [patientsRes, appointmentsRes, professionalsRes, subscriptionRes] = await Promise.all([
            supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic.id),
            supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic.id),
            supabase.from('professionals').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic.id).eq('is_active', true),
            supabase.from('subscriptions').select('id, status, plan_id, subscription_plans(id, name, max_professionals, monthly_price)').eq('clinic_id', clinic.id).maybeSingle(),
          ]);

          let subscription: ClinicSubscription | null = null;
          if (subscriptionRes.data && subscriptionRes.data.subscription_plans) {
            const planData = subscriptionRes.data.subscription_plans as unknown as SubscriptionPlan;
            subscription = {
              id: subscriptionRes.data.id,
              status: subscriptionRes.data.status,
              plan_id: subscriptionRes.data.plan_id,
              plan: planData,
            };
          }

          return {
            ...clinic,
            is_blocked: clinic.is_blocked || false,
            is_maintenance: clinic.is_maintenance || false,
            patientsCount: patientsRes.count || 0,
            appointmentsCount: appointmentsRes.count || 0,
            professionalsCount: professionalsRes.count || 0,
            subscription,
          };
        })
      );

      return clinicsWithCounts;
    },
    staleTime: 30000,
  });

  // Block mutation
  const blockMutation = useMutation({
    mutationFn: async ({ clinicId, reason }: { clinicId: string; reason: string }) => {
      const { error } = await supabase
        .from('clinics')
        .update({
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_reason: reason || "Inadimplência",
          blocked_by: user?.id,
        })
        .eq('id', clinicId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
      toast.success("Clínica bloqueada com sucesso");
      setBlockDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao bloquear: ${error.message}`);
    },
  });

  // Unblock mutation
  const unblockMutation = useMutation({
    mutationFn: async (clinicId: string) => {
      const { error } = await supabase
        .from('clinics')
        .update({
          is_blocked: false,
          blocked_at: null,
          blocked_reason: null,
          blocked_by: null,
        })
        .eq('id', clinicId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
      toast.success("Clínica desbloqueada com sucesso");
      setUnblockDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao desbloquear: ${error.message}`);
    },
  });

  // Maintenance mutation (ativar manutenção)
  const maintenanceMutation = useMutation({
    mutationFn: async ({ clinicId, reason }: { clinicId: string; reason: string }) => {
      const { error } = await supabase
        .from('clinics')
        .update({
          is_maintenance: true,
          maintenance_at: new Date().toISOString(),
          maintenance_reason: reason || "Manutenção em andamento",
          maintenance_by: user?.id,
        })
        .eq('id', clinicId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
      toast.success("Modo manutenção ativado");
      setMaintenanceDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao ativar manutenção: ${error.message}`);
    },
  });

  // Remove maintenance mutation
  const removeMaintenanceMutation = useMutation({
    mutationFn: async (clinicId: string) => {
      const { error } = await supabase
        .from('clinics')
        .update({
          is_maintenance: false,
          maintenance_at: null,
          maintenance_reason: null,
          maintenance_by: null,
        })
        .eq('id', clinicId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
      toast.success("Modo manutenção desativado");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao desativar manutenção: ${error.message}`);
    },
  });

  // Save plan mutation
  const savePlanMutation = useMutation({
    mutationFn: async ({ clinic, planId, status }: { clinic: ClinicWithCounts; planId: string; status: string }) => {
      if (clinic.subscription) {
        const { error } = await supabase
          .from('subscriptions')
          .update({ plan_id: planId, status })
          .eq('id', clinic.subscription.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('subscriptions')
          .insert({
            clinic_id: clinic.id,
            plan_id: planId,
            status,
            trial_ends_at: status === 'trial' 
              ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() 
              : null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
      toast.success("Plano atualizado com sucesso");
      setPlanDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar plano: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (clinic: ClinicWithCounts) => {
      await logAction({
        action: 'delete_clinic',
        entityType: 'clinic',
        entityId: clinic.id,
        details: { clinic_name: clinic.name },
      });

      // Delete related data
      await supabase.from('subscriptions').delete().eq('clinic_id', clinic.id);
      await supabase.from('waiting_list').delete().eq('clinic_id', clinic.id);
      await supabase.from('odontogram_records').delete().eq('clinic_id', clinic.id);
      await supabase.from('medical_records').delete().eq('clinic_id', clinic.id);
      await supabase.from('appointments').delete().eq('clinic_id', clinic.id);
      await supabase.from('anamnesis').delete().eq('clinic_id', clinic.id);
      await supabase.from('patients').delete().eq('clinic_id', clinic.id);
      await supabase.from('professionals').delete().eq('clinic_id', clinic.id);
      await supabase.from('insurance_plans').delete().eq('clinic_id', clinic.id);
      await supabase.from('document_settings').delete().eq('clinic_id', clinic.id);
      await supabase.from('evolution_configs').delete().eq('clinic_id', clinic.id);
      await supabase.from('user_roles').delete().eq('clinic_id', clinic.id);

      const { error } = await supabase.from('clinics').delete().eq('id', clinic.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
      toast.success("Clínica excluída permanentemente");
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  // Settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async ({ clinicId, maxAppointments }: { clinicId: string; maxAppointments: number | null }) => {
      const { error } = await supabase
        .from('clinics')
        .update({
          max_appointments_per_cpf_month: maxAppointments,
        })
        .eq('id', clinicId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
      toast.success("Configurações salvas");
      setSettingsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar configurações: ${error.message}`);
    },
  });

  const handleAccessClinic = (clinic: Clinic) => {
    logAction({ 
      action: 'access_clinic', 
      entityType: 'clinic', 
      entityId: clinic.id,
      details: { clinic_name: clinic.name }
    });
    
    setCurrentClinic({
      id: clinic.id,
      name: clinic.name,
      slug: clinic.slug,
      address: clinic.address,
      phone: clinic.phone,
      cnpj: clinic.cnpj,
      logo_url: null,
      is_blocked: clinic.is_blocked,
      blocked_reason: clinic.blocked_reason,
      is_maintenance: clinic.is_maintenance,
      maintenance_reason: clinic.maintenance_reason,
    });
    
    toast.success(`Acessando: ${clinic.name}`);
    navigate("/dashboard");
  };

  const handleOpenBlockDialog = (clinic: ClinicWithCounts) => {
    setSelectedClinic(clinic);
    setBlockReason("");
    setBlockDialogOpen(true);
  };

  const handleOpenUnblockDialog = (clinic: ClinicWithCounts) => {
    setSelectedClinic(clinic);
    setUnblockDialogOpen(true);
  };

  const handleOpenPlanDialog = (clinic: ClinicWithCounts) => {
    setSelectedClinic(clinic);
    setSelectedPlanId(clinic.subscription?.plan_id || "");
    setSelectedStatus(clinic.subscription?.status || "trial");
    setPlanDialogOpen(true);
  };

  const handleOpenDeleteDialog = (clinic: ClinicWithCounts) => {
    setSelectedClinic(clinic);
    setConfirmClinicName("");
    setDeleteDialogOpen(true);
  };

  const handleOpenMaintenanceDialog = (clinic: ClinicWithCounts) => {
    setSelectedClinic(clinic);
    setMaintenanceReason("");
    setMaintenanceDialogOpen(true);
  };

  const handleOpenWelcomeDialog = (clinic: ClinicWithCounts) => {
    setSelectedClinic(clinic);
    setWelcomeDialogOpen(true);
  };

  const handleOpenSettingsDialog = async (clinic: ClinicWithCounts) => {
    setSelectedClinic(clinic);
    // Fetch current settings
    const { data } = await supabase
      .from('clinics')
      .select('max_appointments_per_cpf_month')
      .eq('id', clinic.id)
      .single();
    
    setMaxCpfAppointments(data?.max_appointments_per_cpf_month || null);
    setSettingsDialogOpen(true);
  };

  const handleSaveSettings = () => {
    if (!selectedClinic) return;
    saveSettingsMutation.mutate({ clinicId: selectedClinic.id, maxAppointments: maxCpfAppointments });
  };

  const handleBlockClinic = () => {
    if (!selectedClinic) return;
    blockMutation.mutate({ clinicId: selectedClinic.id, reason: blockReason });
  };

  const handleUnblockClinic = () => {
    if (!selectedClinic) return;
    unblockMutation.mutate(selectedClinic.id);
  };

  const handleMaintenanceClinic = () => {
    if (!selectedClinic) return;
    maintenanceMutation.mutate({ clinicId: selectedClinic.id, reason: maintenanceReason });
  };

  const handleRemoveMaintenance = (clinic: ClinicWithCounts) => {
    removeMaintenanceMutation.mutate(clinic.id);
  };

  const handleSavePlan = () => {
    if (!selectedClinic || !selectedPlanId) return;
    savePlanMutation.mutate({ clinic: selectedClinic, planId: selectedPlanId, status: selectedStatus });
  };

  const handleDeleteClinic = () => {
    if (!selectedClinic || confirmClinicName !== selectedClinic.name) return;
    deleteMutation.mutate(selectedClinic);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      trial: { label: "Trial", className: "bg-info/10 text-info border-info/20" },
      active: { label: "Ativo", className: "bg-success/10 text-success border-success/20" },
      suspended: { label: "Suspenso", className: "bg-warning/10 text-warning border-warning/20" },
      canceled: { label: "Cancelado", className: "bg-destructive/10 text-destructive border-destructive/20" },
    };
    const s = statusMap[status] || { label: status, className: "" };
    return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
  };

  const filteredClinics = clinics.filter((clinic) =>
    clinic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    clinic.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (clinic.cnpj && clinic.cnpj.includes(searchTerm))
  );

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const isProfessionalLimitExceeded = selectedClinic && selectedPlan 
    ? selectedClinic.professionalsCount > selectedPlan.max_professionals 
    : false;

  // Calculate totals
  const totalPatients = clinics.reduce((sum, c) => sum + c.patientsCount, 0);
  const totalProfessionals = clinics.reduce((sum, c) => sum + c.professionalsCount, 0);
  const totalAppointments = clinics.reduce((sum, c) => sum + c.appointmentsCount, 0);
  const activeClinics = clinics.filter(c => !c.is_blocked && !c.is_maintenance).length;

  const isLoaderVisible = blockMutation.isPending || unblockMutation.isPending || maintenanceMutation.isPending || removeMaintenanceMutation.isPending || savePlanMutation.isPending || deleteMutation.isPending;

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            Gerenciar Clínicas
          </h1>
          <p className="text-muted-foreground mt-2">
            Administre todas as clínicas cadastradas no sistema
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Building2} 
          label="Clínicas Ativas" 
          value={activeClinics}
          color="bg-gradient-to-br from-primary to-primary-dark"
        />
        <StatCard 
          icon={Stethoscope} 
          label="Total Profissionais" 
          value={totalProfessionals}
          color="bg-gradient-to-br from-info to-info/80"
        />
        <StatCard 
          icon={Users} 
          label="Total Pacientes" 
          value={totalPatients}
          color="bg-gradient-to-br from-success to-success/80"
        />
        <StatCard 
          icon={Calendar} 
          label="Total Agendamentos" 
          value={totalAppointments}
          color="bg-gradient-to-br from-warning to-warning/80"
        />
      </div>

      {/* Search Card */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, slug ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-muted/30 border-border/50 focus:bg-background"
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm px-3 py-1.5">
                <Activity className="h-3.5 w-3.5 mr-1.5" />
                {filteredClinics.length} clínica{filteredClinics.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinics List */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/50">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            Lista de Clínicas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredClinics.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="inline-flex p-4 rounded-full bg-muted/50 mb-4">
                <Building2 className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-foreground mb-1">
                {searchTerm ? "Nenhuma clínica encontrada" : "Nenhuma clínica cadastrada"}
              </p>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Tente buscar por outro termo" : "As clínicas aparecerão aqui quando cadastradas"}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop: Table View */}
              <div className="hidden lg:block">
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="font-semibold">Clínica</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Plano</TableHead>
                        <TableHead className="text-center font-semibold">Profissionais</TableHead>
                        <TableHead className="text-center font-semibold">Pacientes</TableHead>
                        <TableHead className="text-center font-semibold">Agendamentos</TableHead>
                        <TableHead className="font-semibold">Criada em</TableHead>
                        <TableHead className="text-right font-semibold">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClinics.map((clinic) => (
                        <TableRow 
                          key={clinic.id} 
                          className={`transition-colors ${
                            clinic.is_blocked 
                              ? "bg-destructive/5 hover:bg-destructive/10" 
                              : clinic.is_maintenance 
                                ? "bg-warning/5 hover:bg-warning/10" 
                                : "hover:bg-muted/30"
                          }`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                                clinic.is_blocked 
                                  ? "bg-destructive/10 text-destructive" 
                                  : clinic.is_maintenance
                                    ? "bg-warning/10 text-warning"
                                    : "bg-gradient-to-br from-primary/20 to-primary/10 text-primary"
                              }`}>
                                {clinic.is_blocked ? (
                                  <Ban className="h-5 w-5" />
                                ) : clinic.is_maintenance ? (
                                  <Wrench className="h-5 w-5" />
                                ) : (
                                  <Building2 className="h-5 w-5" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{clinic.name}</p>
                                <code className="text-xs text-muted-foreground font-mono">/{clinic.slug}</code>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {clinic.is_blocked ? (
                              <Badge variant="destructive" className="gap-1.5">
                                <Ban className="h-3 w-3" />
                                Bloqueada
                              </Badge>
                            ) : clinic.is_maintenance ? (
                              <Badge className="bg-warning/10 text-warning border-warning/20 gap-1.5">
                                <Wrench className="h-3 w-3" />
                                Manutenção
                              </Badge>
                            ) : (
                              <Badge className="bg-success/10 text-success border-success/20 gap-1.5">
                                <CheckCircle className="h-3 w-3" />
                                Ativa
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {clinic.subscription ? (
                              <div className="space-y-1.5">
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                                  {clinic.subscription.plan.name}
                                </Badge>
                                {getStatusBadge(clinic.subscription.status)}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Sem plano
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50">
                              <Stethoscope className="h-3.5 w-3.5 text-primary" />
                              <span className="font-medium">
                                {clinic.professionalsCount}
                                {clinic.subscription && (
                                  <span className="text-muted-foreground font-normal">
                                    /{clinic.subscription.plan.max_professionals}
                                  </span>
                                )}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50">
                              <Users className="h-3.5 w-3.5 text-info" />
                              <span className="font-medium">{clinic.patientsCount}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50">
                              <Calendar className="h-3.5 w-3.5 text-warning" />
                              <span className="font-medium">{clinic.appointmentsCount}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(clinic.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="hover:bg-muted">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => handleOpenPlanDialog(clinic)}>
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Gerenciar Plano
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenSettingsDialog(clinic)}>
                                    <Settings className="h-4 w-4 mr-2" />
                                    Configurações
                                  </DropdownMenuItem>
                                  {clinic.is_blocked ? (
                                    <DropdownMenuItem 
                                      onClick={() => handleOpenUnblockDialog(clinic)}
                                      className="text-success focus:text-success"
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Desbloquear
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem 
                                      onClick={() => handleOpenBlockDialog(clinic)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Ban className="h-4 w-4 mr-2" />
                                      Bloquear
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  {clinic.is_maintenance ? (
                                    <DropdownMenuItem 
                                      onClick={() => handleRemoveMaintenance(clinic)}
                                      className="text-success focus:text-success"
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Desativar Manutenção
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem 
                                      onClick={() => handleOpenMaintenanceDialog(clinic)}
                                      className="text-warning focus:text-warning"
                                      disabled={clinic.is_blocked}
                                    >
                                      <Wrench className="h-4 w-4 mr-2" />
                                      Ativar Manutenção
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleOpenWelcomeDialog(clinic)}
                                    className="text-info focus:text-info"
                                  >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Enviar Boas-vindas
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleOpenDeleteDialog(clinic)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Button
                                size="sm"
                                onClick={() => handleAccessClinic(clinic)}
                                className="bg-primary hover:bg-primary/90"
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                Acessar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {/* Mobile/Tablet: Cards View */}
              <div className="lg:hidden p-4 space-y-4">
                {filteredClinics.map((clinic) => (
                  <ClinicCard
                    key={clinic.id}
                    clinic={clinic}
                    onAccess={handleAccessClinic}
                    onManagePlan={handleOpenPlanDialog}
                    onBlock={handleOpenBlockDialog}
                    onUnblock={handleOpenUnblockDialog}
                    onMaintenance={handleOpenMaintenanceDialog}
                    onRemoveMaintenance={handleRemoveMaintenance}
                    onDelete={handleOpenDeleteDialog}
                    onSendWelcome={handleOpenWelcomeDialog}
                    getStatusBadge={getStatusBadge}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Block Dialog (Inadimplência - Bloqueia totalmente) */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Ban className="h-5 w-5" />
              </div>
              Bloquear Clínica
            </DialogTitle>
            <DialogDescription>
              Esta ação irá <strong>bloquear totalmente</strong> o acesso de todos os usuários da clínica "{selectedClinic?.name}".
              Use para casos de inadimplência ou violação de termos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="blockReason">Motivo do bloqueio</Label>
              <Textarea
                id="blockReason"
                placeholder="Ex: Inadimplência, pagamento pendente há 30 dias..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={handleBlockClinic}
              disabled={blockMutation.isPending}
            >
              {blockMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Ban className="h-4 w-4 mr-2" />
              )}
              Bloquear Clínica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance Dialog (Manutenção - Apenas aviso) */}
      <Dialog open={maintenanceDialogOpen} onOpenChange={setMaintenanceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <div className="p-2 rounded-lg bg-warning/10">
                <Wrench className="h-5 w-5" />
              </div>
              Modo Manutenção
            </DialogTitle>
            <DialogDescription>
              Esta ação exibirá um <strong>aviso amigável</strong> no sistema, mas os usuários continuarão tendo acesso.
              Ideal para ajustes corretivos ou atualizações.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Predefined reasons */}
            <div className="space-y-2">
              <Label>Selecione o motivo</Label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { icon: Settings, label: "Ajustes no sistema", value: "Estamos realizando ajustes para melhorar sua experiência." },
                  { icon: Wrench, label: "Manutenção corretiva", value: "Manutenção corretiva em andamento." },
                  { icon: Clock, label: "Atualização programada", value: "Atualização programada do sistema." },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMaintenanceReason(option.value)}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      maintenanceReason === option.value 
                        ? "border-warning bg-warning/5 text-warning" 
                        : "border-border hover:border-warning/50 hover:bg-muted/50"
                    }`}
                  >
                    <option.icon className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Custom reason */}
            <div className="space-y-2">
              <Label htmlFor="maintenanceReason">Ou digite uma mensagem personalizada</Label>
              <Textarea
                id="maintenanceReason"
                placeholder="Mensagem para os usuários..."
                value={maintenanceReason}
                onChange={(e) => setMaintenanceReason(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setMaintenanceDialogOpen(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button 
              variant="default"
              className="w-full sm:w-auto bg-warning hover:bg-warning/90 text-warning-foreground"
              onClick={handleMaintenanceClinic}
              disabled={maintenanceMutation.isPending}
            >
              {maintenanceMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wrench className="h-4 w-4 mr-2" />
              )}
              Ativar Manutenção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unblock Dialog */}
      <AlertDialog open={unblockDialogOpen} onOpenChange={setUnblockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              Desbloquear Clínica
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span>Deseja realmente desbloquear a clínica "{selectedClinic?.name}"?</span>
              {selectedClinic?.blocked_reason && (
                <span className="block mt-2 p-3 bg-muted rounded-lg text-sm">
                  <strong>Motivo do bloqueio:</strong> {selectedClinic.blocked_reason}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleUnblockClinic}
              disabled={unblockMutation.isPending}
              className="bg-success hover:bg-success/90"
            >
              {unblockMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Plan Management Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              Gerenciar Plano
            </DialogTitle>
            <DialogDescription>
              {selectedClinic?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Current Status */}
            <div className="p-4 bg-muted/50 rounded-xl border border-border/50 space-y-2">
              <p className="text-sm font-medium text-foreground">Situação Atual:</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Plano: <span className="font-medium text-foreground">{selectedClinic?.subscription?.plan.name || "Sem plano"}</span></p>
                <p>• Status: <span className="font-medium text-foreground">{selectedClinic?.subscription?.status || "N/A"}</span></p>
                <p>• Profissionais ativos: <span className="font-medium text-foreground">{selectedClinic?.professionalsCount || 0}</span>
                  {selectedClinic?.subscription && (
                    <span className="text-muted-foreground">/{selectedClinic.subscription.plan.max_professionals}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Plan Selection */}
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger className="bg-muted/30">
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {plan.max_professionals} prof. - R$ {plan.monthly_price.toFixed(2)}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Selection */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="bg-muted/30">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                  <SelectItem value="canceled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Warning for professional limit */}
            {isProfessionalLimitExceeded && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  O plano selecionado permite apenas {selectedPlan?.max_professionals} profissional(is), 
                  mas a clínica possui {selectedClinic?.professionalsCount}. Novas criações serão bloqueadas.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Cancelar
            </Button>
            {selectedClinic?.subscription && selectedPlan && (
              <Button 
                variant="secondary"
                onClick={() => setPaymentDialogOpen(true)}
              >
                <QrCode className="h-4 w-4 mr-2" />
                Gerar PIX/Boleto
              </Button>
            )}
            <Button 
              onClick={handleSavePlan}
              disabled={savePlanMutation.isPending || !selectedPlanId}
            >
              {savePlanMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Trash2 className="h-5 w-5" />
              </div>
              Excluir Clínica Permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Esta ação é <strong>irreversível</strong> e excluirá todos os dados da clínica "{selectedClinic?.name}".
              </span>
              
              <span className="block p-4 bg-destructive/10 rounded-xl text-sm border border-destructive/20">
                <strong className="text-destructive">Serão excluídos:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                  <li>{selectedClinic?.professionalsCount || 0} profissional(is)</li>
                  <li>{selectedClinic?.patientsCount || 0} paciente(s)</li>
                  <li>{selectedClinic?.appointmentsCount || 0} agendamento(s)</li>
                  <li>Todos os prontuários, odontogramas e configurações</li>
                </ul>
              </span>

              <span className="block">
                Para confirmar, digite o nome da clínica: <strong className="text-foreground">{selectedClinic?.name}</strong>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-2">
            <Input
              placeholder="Digite o nome da clínica para confirmar"
              value={confirmClinicName}
              onChange={(e) => setConfirmClinicName(e.target.value)}
              className="bg-muted/30"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteClinic}
              disabled={deleteMutation.isPending || confirmClinicName !== selectedClinic?.name}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Welcome Email Dialog */}
      <SendWelcomeDialog
        open={welcomeDialogOpen}
        onClose={() => setWelcomeDialogOpen(false)}
        clinicName={selectedClinic?.name || ""}
        clinicId={selectedClinic?.id || ""}
      />

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              Configurações da Clínica
            </DialogTitle>
            <DialogDescription>
              {selectedClinic?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* CPF Restriction Setting */}
            <div className="p-4 bg-muted/50 rounded-xl border border-border/50 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Limite de agendamentos por CPF</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Define o número máximo de agendamentos que um paciente (por CPF) pode ter 
                  com o mesmo profissional no mesmo mês. Deixe vazio para ilimitado.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  placeholder="Ilimitado"
                  value={maxCpfAppointments ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMaxCpfAppointments(val === "" ? null : parseInt(val, 10));
                  }}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">
                  agendamento(s) por mês
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveSettings}
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mercado Pago Payment Dialog for Plan Subscription */}
      {selectedClinic && selectedPlan && (
        <MercadoPagoPaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          clinicId={selectedClinic.id}
          amount={selectedPlan.monthly_price}
          description={`Assinatura do plano ${selectedPlan.name} - ${selectedClinic.name}`}
          source="subscription"
          sourceId={selectedClinic.subscription?.id || selectedClinic.id}
          payerName={selectedClinic.name}
          payerEmail={selectedClinic.email || ""}
          payerCpf={selectedClinic.cnpj || ""}
        />
      )}
    </div>
  );
}
