import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

// Card component for mobile/tablet view
interface ClinicCardProps {
  clinic: ClinicWithCounts;
  onAccess: (clinic: ClinicWithCounts) => void;
  onManagePlan: (clinic: ClinicWithCounts) => void;
  onBlock: (clinic: ClinicWithCounts) => void;
  onUnblock: (clinic: ClinicWithCounts) => void;
  onDelete: (clinic: ClinicWithCounts) => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

const ClinicCard = ({ 
  clinic, 
  onAccess, 
  onManagePlan, 
  onBlock, 
  onUnblock, 
  onDelete,
  getStatusBadge 
}: ClinicCardProps) => (
  <div className={`border rounded-lg p-4 space-y-4 ${clinic.is_blocked ? "bg-destructive/5 border-destructive/20" : ""}`}>
    {/* Header: Name + Status */}
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
          clinic.is_blocked ? "bg-destructive/10" : "bg-primary/10"
        }`}>
          {clinic.is_blocked ? (
            <Ban className="h-5 w-5 text-destructive" />
          ) : (
            <Building2 className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{clinic.name}</p>
          <code className="text-xs text-muted-foreground">/{clinic.slug}</code>
        </div>
      </div>
      {clinic.is_blocked ? (
        <Badge variant="destructive" className="gap-1 shrink-0">
          <Ban className="h-3 w-3" />
          Bloqueada
        </Badge>
      ) : (
        <Badge variant="outline" className="text-success border-success gap-1 shrink-0">
          <CheckCircle className="h-3 w-3" />
          Ativa
        </Badge>
      )}
    </div>
    
    {/* Metrics in 3-column grid */}
    <div className="grid grid-cols-3 gap-2 text-center bg-muted/50 rounded-lg p-3">
      <div>
        <Stethoscope className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
        <span className="text-sm font-medium block">
          {clinic.professionalsCount}
          {clinic.subscription && (
            <span className="text-muted-foreground">/{clinic.subscription.plan.max_professionals}</span>
          )}
        </span>
        <p className="text-xs text-muted-foreground">Profissionais</p>
      </div>
      <div>
        <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
        <span className="text-sm font-medium block">{clinic.patientsCount}</span>
        <p className="text-xs text-muted-foreground">Pacientes</p>
      </div>
      <div>
        <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
        <span className="text-sm font-medium block">{clinic.appointmentsCount}</span>
        <p className="text-xs text-muted-foreground">Agendamentos</p>
      </div>
    </div>
    
    {/* Plan + Date */}
    <div className="flex items-center justify-between text-sm flex-wrap gap-2">
      <div className="flex items-center gap-2">
        {clinic.subscription ? (
          <>
            <span className="font-medium">{clinic.subscription.plan.name}</span>
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
    <div className="flex items-center gap-2 pt-2 border-t">
      <Button 
        size="sm" 
        variant="outline" 
        className="flex-1"
        onClick={() => onManagePlan(clinic)}
      >
        <CreditCard className="h-4 w-4 mr-2" />
        Plano
      </Button>
      {clinic.is_blocked ? (
        <Button 
          size="sm" 
          variant="outline"
          className="text-success hover:text-success"
          onClick={() => onUnblock(clinic)}
        >
          <CheckCircle className="h-4 w-4" />
        </Button>
      ) : (
        <Button 
          size="sm" 
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => onBlock(clinic)}
        >
          <Ban className="h-4 w-4" />
        </Button>
      )}
      <Button 
        size="sm" 
        variant="outline"
        className="text-destructive hover:text-destructive"
        onClick={() => onDelete(clinic)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button 
        size="sm" 
        className="flex-1"
        onClick={() => onAccess(clinic)}
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        Acessar
      </Button>
    </div>
  </div>
);

export default function ClinicsManagement() {
  const [clinics, setClinics] = useState<ClinicWithCounts[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Block/Unblock dialogs
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<ClinicWithCounts | null>(null);
  const [blockReason, setBlockReason] = useState("");
  
  // Plan management dialog
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("trial");
  
  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmClinicName, setConfirmClinicName] = useState("");
  
  const [actionLoading, setActionLoading] = useState(false);
  const { setCurrentClinic, user } = useAuth();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchClinics();
    fetchPlans();
    logAction({ action: 'view_clinics_list', entityType: 'clinic' });
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, max_professionals, monthly_price')
        .eq('is_active', true)
        .order('monthly_price', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error("Error fetching plans:", error);
    }
  };

  const fetchClinics = async () => {
    try {
      const { data: clinicsData, error } = await supabase
        .from('clinics')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (clinicsData) {
        const clinicsWithCounts = await Promise.all(
          clinicsData.map(async (clinic) => {
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
              patientsCount: patientsRes.count || 0,
              appointmentsCount: appointmentsRes.count || 0,
              professionalsCount: professionalsRes.count || 0,
              subscription,
            };
          })
        );

        setClinics(clinicsWithCounts);
      }
    } catch (error) {
      console.error("Error fetching clinics:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as clínicas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
    });
    
    toast({
      title: "Clínica selecionada",
      description: `Você está acessando: ${clinic.name}`,
    });
    
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

  const handleBlockClinic = async () => {
    if (!selectedClinic || !user) return;
    
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from('clinics')
        .update({
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_reason: blockReason.trim() || "Inadimplência",
          blocked_by: user.id,
        })
        .eq('id', selectedClinic.id);

      if (error) throw error;

      await logAction({
        action: 'block_clinic',
        entityType: 'clinic',
        entityId: selectedClinic.id,
        details: { 
          clinic_name: selectedClinic.name,
          reason: blockReason.trim() || "Inadimplência" 
        }
      });

      toast({
        title: "Clínica bloqueada",
        description: `A clínica "${selectedClinic.name}" foi bloqueada.`,
      });

      setBlockDialogOpen(false);
      fetchClinics();
    } catch (error: any) {
      toast({
        title: "Erro ao bloquear",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblockClinic = async () => {
    if (!selectedClinic) return;
    
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from('clinics')
        .update({
          is_blocked: false,
          blocked_at: null,
          blocked_reason: null,
          blocked_by: null,
        })
        .eq('id', selectedClinic.id);

      if (error) throw error;

      await logAction({
        action: 'unblock_clinic',
        entityType: 'clinic',
        entityId: selectedClinic.id,
        details: { clinic_name: selectedClinic.name }
      });

      toast({
        title: "Clínica desbloqueada",
        description: `A clínica "${selectedClinic.name}" foi desbloqueada.`,
      });

      setUnblockDialogOpen(false);
      fetchClinics();
    } catch (error: any) {
      toast({
        title: "Erro ao desbloquear",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSavePlan = async () => {
    if (!selectedClinic || !selectedPlanId) return;
    
    setActionLoading(true);

    try {
      if (selectedClinic.subscription) {
        // Update existing subscription
        const { error } = await supabase
          .from('subscriptions')
          .update({
            plan_id: selectedPlanId,
            status: selectedStatus,
          })
          .eq('id', selectedClinic.subscription.id);

        if (error) throw error;
      } else {
        // Create new subscription
        const { error } = await supabase
          .from('subscriptions')
          .insert({
            clinic_id: selectedClinic.id,
            plan_id: selectedPlanId,
            status: selectedStatus,
            trial_ends_at: selectedStatus === 'trial' 
              ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() 
              : null,
          });

        if (error) throw error;
      }

      await logAction({
        action: 'manage_clinic_plan',
        entityType: 'subscription',
        entityId: selectedClinic.id,
        details: { 
          clinic_name: selectedClinic.name,
          plan_id: selectedPlanId,
          status: selectedStatus,
        }
      });

      toast({
        title: "Plano atualizado",
        description: `O plano da clínica "${selectedClinic.name}" foi atualizado.`,
      });

      setPlanDialogOpen(false);
      fetchClinics();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar plano",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClinic = async () => {
    if (!selectedClinic || confirmClinicName !== selectedClinic.name) return;
    
    setActionLoading(true);

    try {
      // Log before deletion
      await logAction({
        action: 'delete_clinic',
        entityType: 'clinic',
        entityId: selectedClinic.id,
        details: { 
          clinic_name: selectedClinic.name,
          patients_count: selectedClinic.patientsCount,
          appointments_count: selectedClinic.appointmentsCount,
          professionals_count: selectedClinic.professionalsCount,
        }
      });

      // Delete related data first (in case CASCADE is not set)
      await supabase.from('subscriptions').delete().eq('clinic_id', selectedClinic.id);
      await supabase.from('waiting_list').delete().eq('clinic_id', selectedClinic.id);
      await supabase.from('odontogram_records').delete().eq('clinic_id', selectedClinic.id);
      await supabase.from('medical_records').delete().eq('clinic_id', selectedClinic.id);
      await supabase.from('appointments').delete().eq('clinic_id', selectedClinic.id);
      await supabase.from('anamnesis').delete().eq('clinic_id', selectedClinic.id);
      await supabase.from('patients').delete().eq('clinic_id', selectedClinic.id);
      await supabase.from('professionals').delete().eq('clinic_id', selectedClinic.id);
      await supabase.from('insurance_plans').delete().eq('clinic_id', selectedClinic.id);
      await supabase.from('document_settings').delete().eq('clinic_id', selectedClinic.id);
      await supabase.from('evolution_configs').delete().eq('clinic_id', selectedClinic.id);
      await supabase.from('user_roles').delete().eq('clinic_id', selectedClinic.id);

      // Delete the clinic
      const { error } = await supabase
        .from('clinics')
        .delete()
        .eq('id', selectedClinic.id);

      if (error) throw error;

      toast({
        title: "Clínica excluída",
        description: `A clínica "${selectedClinic.name}" foi excluída permanentemente.`,
      });

      setDeleteDialogOpen(false);
      fetchClinics();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      trial: { label: "Trial", variant: "secondary" },
      active: { label: "Ativo", variant: "default" },
      suspended: { label: "Suspenso", variant: "destructive" },
      canceled: { label: "Cancelado", variant: "outline" },
    };
    const s = statusMap[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
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

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Gerenciar Clínicas</h1>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">
          Lista de todas as clínicas cadastradas no sistema
        </p>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, slug ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="secondary" className="text-sm justify-center">
              {filteredClinics.length} clínica{filteredClinics.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Clinics List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Clínicas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredClinics.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? "Nenhuma clínica encontrada" : "Nenhuma clínica cadastrada"}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop: Table View */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Clínica</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead className="text-center">Profissionais</TableHead>
                      <TableHead className="text-center">Pacientes</TableHead>
                      <TableHead className="text-center">Agendamentos</TableHead>
                      <TableHead>Criada em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClinics.map((clinic) => (
                      <TableRow key={clinic.id} className={clinic.is_blocked ? "bg-destructive/5" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                              clinic.is_blocked ? "bg-destructive/10" : "bg-primary/10"
                            }`}>
                              {clinic.is_blocked ? (
                                <Ban className="h-4 w-4 text-destructive" />
                              ) : (
                                <Building2 className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{clinic.name}</p>
                              <code className="text-xs text-muted-foreground">/{clinic.slug}</code>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {clinic.is_blocked ? (
                            <Badge variant="destructive" className="gap-1">
                              <Ban className="h-3 w-3" />
                              Bloqueada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-success border-success gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Ativa
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {clinic.subscription ? (
                            <div className="space-y-1">
                              <p className="text-sm font-medium">{clinic.subscription.plan.name}</p>
                              {getStatusBadge(clinic.subscription.status)}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Sem plano
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>
                              {clinic.professionalsCount}
                              {clinic.subscription && (
                                <span className="text-muted-foreground">
                                  /{clinic.subscription.plan.max_professionals}
                                </span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{clinic.patientsCount}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{clinic.appointmentsCount}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(clinic.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background">
                                <DropdownMenuItem onClick={() => handleOpenPlanDialog(clinic)}>
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  Gerenciar Plano
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
              </div>

              {/* Mobile/Tablet: Cards View */}
              <div className="lg:hidden space-y-4">
                {filteredClinics.map((clinic) => (
                  <ClinicCard
                    key={clinic.id}
                    clinic={clinic}
                    onAccess={handleAccessClinic}
                    onManagePlan={handleOpenPlanDialog}
                    onBlock={handleOpenBlockDialog}
                    onUnblock={handleOpenUnblockDialog}
                    onDelete={handleOpenDeleteDialog}
                    getStatusBadge={getStatusBadge}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Block Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Bloquear Clínica
            </DialogTitle>
            <DialogDescription>
              Esta ação irá bloquear o acesso de todos os usuários da clínica "{selectedClinic?.name}".
              Eles verão uma mensagem informando que o sistema está indisponível.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="blockReason">Motivo do bloqueio</Label>
              <Textarea
                id="blockReason"
                placeholder="Ex: Inadimplência, pagamento pendente..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBlockClinic}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Ban className="h-4 w-4 mr-2" />
              )}
              Confirmar Bloqueio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unblock Dialog */}
      <AlertDialog open={unblockDialogOpen} onOpenChange={setUnblockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desbloquear Clínica</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente desbloquear a clínica "{selectedClinic?.name}"?
              Todos os usuários terão acesso novamente ao sistema.
              {selectedClinic?.blocked_reason && (
                <span className="block mt-2 p-2 bg-muted rounded text-sm">
                  <strong>Motivo do bloqueio:</strong> {selectedClinic.blocked_reason}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleUnblockClinic}
              disabled={actionLoading}
              className="bg-success hover:bg-success/90"
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Plan Management Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Gerenciar Plano - {selectedClinic?.name}
            </DialogTitle>
            <DialogDescription>
              Vincule ou altere o plano de assinatura desta clínica.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Current Status */}
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium">Situação Atual:</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Plano: {selectedClinic?.subscription?.plan.name || "Sem plano"}</p>
                <p>• Status: {selectedClinic?.subscription?.status || "N/A"}</p>
                <p>• Profissionais ativos: {selectedClinic?.professionalsCount || 0}
                  {selectedClinic?.subscription && (
                    <span>/{selectedClinic.subscription.plan.max_professionals}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Plan Selection */}
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
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
                <SelectTrigger>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSavePlan}
              disabled={actionLoading || !selectedPlanId}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
              <Trash2 className="h-5 w-5" />
              Excluir Clínica Permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Esta ação é <strong>irreversível</strong> e excluirá todos os dados da clínica "{selectedClinic?.name}".
              </span>
              
              <span className="block p-3 bg-destructive/10 rounded-lg text-sm">
                <strong>Serão excluídos:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>{selectedClinic?.professionalsCount || 0} profissional(is)</li>
                  <li>{selectedClinic?.patientsCount || 0} paciente(s)</li>
                  <li>{selectedClinic?.appointmentsCount || 0} agendamento(s)</li>
                  <li>Todos os prontuários, odontogramas, anamneses e configurações</li>
                </ul>
              </span>

              <span className="block">
                Para confirmar, digite o nome da clínica: <strong>{selectedClinic?.name}</strong>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-2">
            <Input
              placeholder="Digite o nome da clínica para confirmar"
              value={confirmClinicName}
              onChange={(e) => setConfirmClinicName(e.target.value)}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteClinic}
              disabled={actionLoading || confirmClinicName !== selectedClinic?.name}
              className="bg-destructive hover:bg-destructive/90"
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
