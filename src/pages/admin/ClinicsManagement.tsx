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
  Building2, 
  Search, 
  ExternalLink,
  Users,
  Calendar,
  Ban,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

interface ClinicWithCounts extends Clinic {
  patientsCount: number;
  appointmentsCount: number;
}

export default function ClinicsManagement() {
  const [clinics, setClinics] = useState<ClinicWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<ClinicWithCounts | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const { setCurrentClinic, user } = useAuth();
  const { logAction } = useAuditLog();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchClinics();
    logAction({ action: 'view_clinics_list', entityType: 'clinic' });
  }, []);

  const fetchClinics = async () => {
    try {
      const { data: clinicsData, error } = await supabase
        .from('clinics')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (clinicsData) {
        // Fetch counts for each clinic
        const clinicsWithCounts = await Promise.all(
          clinicsData.map(async (clinic) => {
            const [patientsRes, appointmentsRes] = await Promise.all([
              supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic.id),
              supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic.id),
            ]);

            return {
              ...clinic,
              is_blocked: clinic.is_blocked || false,
              patientsCount: patientsRes.count || 0,
              appointmentsCount: appointmentsRes.count || 0,
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

  const filteredClinics = clinics.filter((clinic) =>
    clinic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    clinic.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (clinic.cnpj && clinic.cnpj.includes(searchTerm))
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gerenciar Clínicas</h1>
        <p className="text-muted-foreground mt-1">
          Lista de todas as clínicas cadastradas no sistema
        </p>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, slug ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="secondary" className="text-sm">
              {filteredClinics.length} clínica{filteredClinics.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Clinics Table */}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Status</TableHead>
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
                      <div className="flex items-center justify-end gap-2">
                        {clinic.is_blocked ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-success border-success hover:bg-success/10"
                            onClick={() => handleOpenUnblockDialog(clinic)}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                            Desbloquear
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive hover:bg-destructive/10"
                            onClick={() => handleOpenBlockDialog(clinic)}
                          >
                            <Ban className="h-3.5 w-3.5 mr-1.5" />
                            Bloquear
                          </Button>
                        )}
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
    </div>
  );
}
