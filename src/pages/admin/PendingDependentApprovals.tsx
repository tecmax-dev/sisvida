import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  CheckCircle2, 
  XCircle, 
  Eye, 
  Clock, 
  User, 
  Phone, 
  Calendar,
  Loader2,
  Users,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingApproval {
  id: string;
  clinic_id: string;
  patient_id: string;
  dependent_id: string;
  requester_phone: string;
  cpf_photo_url: string | null;
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  dependent?: {
    id: string;
    name: string;
    cpf: string | null;
    birth_date: string | null;
    relationship: string | null;
  };
  patient?: {
    id: string;
    name: string;
    cpf: string | null;
  };
  clinic?: {
    id: string;
    name: string;
  };
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  'filho': 'Filho(a)',
  'conjuge': 'Cônjuge',
  'pai': 'Pai',
  'mae': 'Mãe',
};

export default function PendingDependentApprovals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  
  // Photo viewer
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  
  // Rejection dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processing, setProcessing] = useState(false);
  
  // Approval confirmation
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);

  useEffect(() => {
    fetchApprovals();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('pending-dependent-approvals')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_dependent_approvals',
        },
        () => {
          fetchApprovals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter]);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('pending_dependent_approvals')
        .select(`
          *,
          dependent:patient_dependents(id, name, cpf, birth_date, relationship),
          patient:patients(id, name, cpf),
          clinic:clinics(id, name)
        `)
        .order('created_at', { ascending: false });
      
      if (statusFilter !== "all") {
        query = query.eq('status', statusFilter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setApprovals((data as unknown as PendingApproval[]) || []);
    } catch (error) {
      console.error('Error fetching approvals:', error);
      toast({
        title: "Erro ao carregar solicitações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const viewPhoto = async (photoUrl: string) => {
    setPhotoLoading(true);
    setPhotoDialogOpen(true);
    
    try {
      // Get signed URL for private bucket
      const { data, error } = await supabase.storage
        .from('dependent-cpf-photos')
        .createSignedUrl(photoUrl, 300); // 5 min expiry
      
      if (error) throw error;
      setSelectedPhoto(data.signedUrl);
    } catch (error) {
      console.error('Error getting photo URL:', error);
      toast({
        title: "Erro ao carregar foto",
        variant: "destructive",
      });
      setPhotoDialogOpen(false);
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApproval) return;
    setProcessing(true);
    
    try {
      // 1. Activate the dependent
      const { error: dependentError } = await supabase
        .from('patient_dependents')
        .update({ 
          is_active: true, 
          pending_approval: false 
        })
        .eq('id', selectedApproval.dependent_id);
      
      if (dependentError) throw dependentError;
      
      // 2. Update approval record
      const { error: approvalError } = await supabase
        .from('pending_dependent_approvals')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedApproval.id);
      
      if (approvalError) throw approvalError;
      
      // 3. TODO: Send WhatsApp notification to requester
      // This would call an edge function to notify the titular
      
      toast({
        title: "Dependente aprovado!",
        description: `${selectedApproval.dependent?.name} foi ativado com sucesso.`,
      });
      
      setApproveDialogOpen(false);
      setSelectedApproval(null);
      fetchApprovals();
    } catch (error) {
      console.error('Error approving:', error);
      toast({
        title: "Erro ao aprovar",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApproval || !rejectionReason.trim()) {
      toast({
        title: "Informe o motivo da rejeição",
        variant: "destructive",
      });
      return;
    }
    
    setProcessing(true);
    
    try {
      // 1. Delete the dependent record
      const { error: dependentError } = await supabase
        .from('patient_dependents')
        .delete()
        .eq('id', selectedApproval.dependent_id);
      
      if (dependentError) throw dependentError;
      
      // 2. Update approval record
      const { error: approvalError } = await supabase
        .from('pending_dependent_approvals')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedApproval.id);
      
      if (approvalError) throw approvalError;
      
      // 3. TODO: Send WhatsApp notification to requester with rejection reason
      
      toast({
        title: "Solicitação rejeitada",
        description: `O cadastro de ${selectedApproval.dependent?.name} foi recusado.`,
      });
      
      setRejectDialogOpen(false);
      setSelectedApproval(null);
      setRejectionReason("");
      fetchApprovals();
    } catch (error) {
      console.error('Error rejecting:', error);
      toast({
        title: "Erro ao rejeitar",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate + 'T12:00:00');
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  const pendingCount = approvals.filter(a => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Aprovações de Dependentes
          </h1>
          <p className="text-muted-foreground">
            Gerencie as solicitações de cadastro de dependentes via WhatsApp
          </p>
        </div>
        <Button variant="outline" onClick={fetchApprovals}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-full">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-full">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {approvals.filter(a => a.status === 'approved').length}
                </p>
                <p className="text-sm text-muted-foreground">Aprovados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-100 rounded-full">
                <XCircle className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {approvals.filter(a => a.status === 'rejected').length}
                </p>
                <p className="text-sm text-muted-foreground">Rejeitados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Solicitações</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="approved">Aprovados</SelectItem>
                <SelectItem value="rejected">Rejeitados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : approvals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma solicitação encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dependente</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead>Parentesco</TableHead>
                  <TableHead>Idade</TableHead>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Solicitado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.map((approval) => {
                  const age = getAge(approval.dependent?.birth_date || null);
                  
                  return (
                    <TableRow key={approval.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{approval.dependent?.name || '-'}</p>
                            <p className="text-xs text-muted-foreground">
                              CPF: {approval.dependent?.cpf || 'Não informado'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{approval.patient?.name || '-'}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {formatPhone(approval.requester_phone)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {RELATIONSHIP_LABELS[approval.dependent?.relationship || ''] || 
                          approval.dependent?.relationship || '-'}
                      </TableCell>
                      <TableCell>
                        {age !== null ? `${age} anos` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{approval.clinic?.name || '-'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {format(new Date(approval.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {approval.status === 'pending' && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            <Clock className="h-3 w-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                        {approval.status === 'approved' && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Aprovado
                          </Badge>
                        )}
                        {approval.status === 'rejected' && (
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                            <XCircle className="h-3 w-3 mr-1" />
                            Rejeitado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {approval.cpf_photo_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => viewPhoto(approval.cpf_photo_url!)}
                            >
                              <ImageIcon className="h-4 w-4" />
                            </Button>
                          )}
                          {approval.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => {
                                  setSelectedApproval(approval);
                                  setApproveDialogOpen(true);
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => {
                                  setSelectedApproval(approval);
                                  setRejectDialogOpen(true);
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Photo Viewer Dialog */}
      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Foto do CPF</DialogTitle>
            <DialogDescription>
              Verifique se o CPF está legível e corresponde aos dados informados
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[300px] bg-muted rounded-lg">
            {photoLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : selectedPhoto ? (
              <img 
                src={selectedPhoto} 
                alt="Foto do CPF" 
                className="max-w-full max-h-[500px] object-contain rounded-lg"
              />
            ) : (
              <p className="text-muted-foreground">Foto não disponível</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar cadastro de dependente?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a aprovar o cadastro de{" "}
              <strong>{selectedApproval?.dependent?.name}</strong> como dependente de{" "}
              <strong>{selectedApproval?.patient?.name}</strong>.
              <br /><br />
              O dependente será ativado e poderá realizar agendamentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={processing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Aprovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar cadastro de dependente</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. O titular será notificado via WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Dependente: <strong>{selectedApproval?.dependent?.name}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Titular: <strong>{selectedApproval?.patient?.name}</strong>
              </p>
            </div>
            <Textarea
              placeholder="Motivo da rejeição (obrigatório)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectionReason("");
              }}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={processing || !rejectionReason.trim()}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}