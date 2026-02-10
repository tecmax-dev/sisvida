import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { PayslipImageViewer } from "@/components/patients/PayslipImageViewer";
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
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  'filho': 'Filho(a)',
  'conjuge': 'Cônjuge',
  'pai': 'Pai',
  'mae': 'Mãe',
};

export default function DependentApprovalsPage() {
  const { user, currentClinic } = useAuth();
  const { toast } = useToast();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Photo viewer dialog
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  
  // Approval dialog
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [approving, setApproving] = useState(false);
  
  // Rejection dialog
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const fetchApprovals = async () => {
    if (!currentClinic?.id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pending_dependent_approvals')
        .select(`
          *,
          dependent:patient_dependents(id, name, cpf, birth_date, relationship),
          patient:patients(id, name, cpf)
        `)
        .eq('clinic_id', currentClinic.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setApprovals(data || []);
    } catch (error) {
      console.error('Error fetching approvals:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar solicitações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentClinic?.id) return;
    
    fetchApprovals();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('clinic-dependent-approvals')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_dependent_approvals',
          filter: `clinic_id=eq.${currentClinic.id}`,
        },
        () => {
          fetchApprovals();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentClinic?.id]);

  const viewPhoto = async (photoUrl: string | null) => {
    if (!photoUrl) {
      toast({
        title: "Sem foto",
        description: "Nenhuma foto de CPF foi enviada",
        variant: "destructive",
      });
      return;
    }
    
    setLoadingPhoto(true);
    setPhotoDialogOpen(true);
    
    try {
      // If it's already a full URL (from dependent-documents public bucket), use directly
      if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
        setSelectedPhotoUrl(photoUrl);
      } else {
        // Try signed URL from dependent-cpf-photos bucket (legacy)
        const { data, error } = await supabase.storage
          .from('dependent-cpf-photos')
          .createSignedUrl(photoUrl, 300);
        
        if (error) {
          // Fallback: try dependent-documents bucket
          const { data: data2, error: error2 } = await supabase.storage
            .from('dependent-documents')
            .createSignedUrl(photoUrl, 300);
          
          if (error2) throw error2;
          setSelectedPhotoUrl(data2.signedUrl);
        } else {
          setSelectedPhotoUrl(data.signedUrl);
        }
      }
    } catch (error) {
      console.error('Error getting photo URL:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar foto",
        variant: "destructive",
      });
      setPhotoDialogOpen(false);
    } finally {
      setLoadingPhoto(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApproval || !user || !currentClinic) return;
    
    setApproving(true);
    try {
      // Update the approval status
      const { error: approvalError } = await supabase
        .from('pending_dependent_approvals')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedApproval.id);
      
      if (approvalError) throw approvalError;
      
      // Activate the dependent
      const { error: dependentError } = await supabase
        .from('patient_dependents')
        .update({
          is_active: true,
          pending_approval: false,
        })
        .eq('id', selectedApproval.dependent_id);
      
      if (dependentError) throw dependentError;

      // Auto-create digital card for the dependent inheriting titular's expiry date
      let cardNumber: string | null = null;
      try {
        const titularPatientId = selectedApproval.patient_id;

        // Get titular's active card to inherit expiry date
        const { data: titularCard } = await supabase
          .from('patient_cards')
          .select('expires_at')
          .eq('patient_id', titularPatientId)
          .eq('clinic_id', currentClinic.id)
          .eq('is_active', true)
          .maybeSingle();

        if (titularCard?.expires_at) {
          // Find the patient record created by the sync trigger for this dependent
          const dependentCpf = selectedApproval.dependent?.cpf;
          if (dependentCpf) {
            const cleanCpf = dependentCpf.replace(/\D/g, '');
            const { data: dependentPatient } = await supabase
              .from('patients')
              .select('id')
              .eq('clinic_id', currentClinic.id)
              .ilike('cpf', `%${cleanCpf}%`)
              .maybeSingle();

            if (dependentPatient) {
              // Generate card number
              const { data: generatedCardNumber } = await supabase.rpc('generate_card_number', {
                p_clinic_id: currentClinic.id,
                p_patient_id: dependentPatient.id,
              });
              cardNumber = generatedCardNumber;

              if (cardNumber) {
                // Check if card already exists
                const { data: existingCard } = await supabase
                  .from('patient_cards')
                  .select('id')
                  .eq('patient_id', dependentPatient.id)
                  .eq('clinic_id', currentClinic.id)
                  .eq('is_active', true)
                  .maybeSingle();

                if (!existingCard) {
                  await supabase.from('patient_cards').insert({
                    clinic_id: currentClinic.id,
                    patient_id: dependentPatient.id,
                    card_number: cardNumber,
                    issued_at: new Date().toISOString(),
                    expires_at: titularCard.expires_at,
                    is_active: true,
                  });

                  // Also update dependent record with card info
                  await supabase
                    .from('patient_dependents')
                    .update({
                      card_number: cardNumber,
                      card_expires_at: titularCard.expires_at,
                    })
                    .eq('id', selectedApproval.dependent_id);

                  console.log(`[Approval] Card created for dependent ${dependentCpf}: ${cardNumber}, expires: ${titularCard.expires_at}`);
                }
              }
            }
          }
        } else {
          console.warn('[Approval] Titular has no active card - dependent card not created');
        }
      } catch (cardError) {
        console.error('[Approval] Error creating dependent card:', cardError);
        // Don't fail the approval if card creation fails
      }
      
      // Send WhatsApp notification to requester
      if (selectedApproval.requester_phone) {
        const cardInfo = cardNumber ? `\n\n🪪 *Carteirinha Digital:* ${cardNumber}` : '';
        const message = `✅ *Cadastro Aprovado!*\n\nOlá! O cadastro do dependente *${selectedApproval.dependent?.name || 'seu dependente'}* foi *aprovado* com sucesso!${cardInfo}\n\nEle(a) já pode realizar agendamentos pelo WhatsApp ou pelo sistema.\n\nAtenciosamente,\n${currentClinic.name}`;

        const result = await sendWhatsAppMessage({
          phone: selectedApproval.requester_phone,
          message,
          clinicId: currentClinic.id,
          type: 'custom',
        });

        if (!result.success) {
          console.error('Failed to send approval notification:', result.error);
          toast({
            title: "Aprovado (WhatsApp não enviado)",
            description: result.error || "Falha ao enviar a notificação no WhatsApp.",
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Aprovado!",
        description: `Dependente ${selectedApproval.dependent?.name} foi ativado com sucesso e carteirinha emitida automaticamente.`,
      });

      setApprovalDialogOpen(false);
      setSelectedApproval(null);
      setStatusFilter('approved');
      fetchApprovals();
    } catch (error) {
      console.error('Error approving:', error);
      toast({
        title: "Erro",
        description: "Falha ao aprovar solicitação",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApproval || !user || !rejectionReason.trim() || !currentClinic) return;
    
    setRejecting(true);
    try {
      // Update the approval status
      const { error: approvalError } = await supabase
        .from('pending_dependent_approvals')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedApproval.id);
      
      if (approvalError) throw approvalError;
      
      // Keep dependent as inactive
      const { error: dependentError } = await supabase
        .from('patient_dependents')
        .update({
          pending_approval: false,
        })
        .eq('id', selectedApproval.dependent_id);
      
      if (dependentError) throw dependentError;
      
      // Send WhatsApp notification to requester
      if (selectedApproval.requester_phone) {
        const message = `❌ *Cadastro Não Aprovado*\n\nOlá! Infelizmente o cadastro do dependente *${selectedApproval.dependent?.name || 'seu dependente'}* não foi aprovado.\n\n*Motivo:* ${rejectionReason.trim()}\n\nPor favor, entre em contato conosco para mais informações.\n\nAtenciosamente,\n${currentClinic.name}`;

        const result = await sendWhatsAppMessage({
          phone: selectedApproval.requester_phone,
          message,
          clinicId: currentClinic.id,
          type: 'custom',
        });

        if (!result.success) {
          console.error('Failed to send rejection notification:', result.error);
          toast({
            title: "Rejeitado (WhatsApp não enviado)",
            description: result.error || "Falha ao enviar a notificação no WhatsApp.",
            variant: "destructive",
          });
        }
      }
      
      toast({
        title: "Rejeitado",
        description: `Solicitação de ${selectedApproval.dependent?.name} foi rejeitada`,
      });
      
      setRejectionDialogOpen(false);
      setRejectionReason("");
      setSelectedApproval(null);
      setStatusFilter('rejected');
      fetchApprovals();
    } catch (error) {
      console.error('Error rejecting:', error);
      toast({
        title: "Erro",
        description: "Falha ao rejeitar solicitação",
        variant: "destructive",
      });
    } finally {
      setRejecting(false);
    }
  };

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return '-';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 13) {
      return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    }
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    }
    return phone;
  };

  const filteredApprovals = approvals
    .filter((approval) => {
      if (statusFilter === 'all') return true;
      return approval.status === statusFilter;
    })
    .filter((approval) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        approval.dependent?.name?.toLowerCase().includes(search) ||
        approval.patient?.name?.toLowerCase().includes(search) ||
        approval.dependent?.cpf?.includes(search) ||
        approval.requester_phone?.includes(search)
      );
    });

  const pendingCount = approvals.filter(a => a.status === 'pending').length;
  const approvedCount = approvals.filter(a => a.status === 'approved').length;
  const rejectedCount = approvals.filter(a => a.status === 'rejected').length;

  if (!currentClinic) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Aprovação de Dependentes</h1>
          <p className="text-muted-foreground">
            Gerencie solicitações de cadastro de dependentes via WhatsApp
          </p>
        </div>
        <Button onClick={fetchApprovals} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{approvedCount}</p>
              <p className="text-sm text-muted-foreground">Aprovados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{rejectedCount}</p>
              <p className="text-sm text-muted-foreground">Rejeitados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Buscar por nome, CPF ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="approved">Aprovados</SelectItem>
                <SelectItem value="rejected">Rejeitados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Solicitações ({filteredApprovals.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma solicitação encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dependente</TableHead>
                    <TableHead>Titular</TableHead>
                    <TableHead>Parentesco</TableHead>
                    <TableHead>Idade</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApprovals.map((approval) => (
                    <TableRow key={approval.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{approval.dependent?.name || '-'}</p>
                          <p className="text-xs text-muted-foreground">
                            {approval.dependent?.cpf || 'CPF não informado'}
                          </p>
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
                        {approval.dependent?.relationship 
                          ? RELATIONSHIP_LABELS[approval.dependent.relationship] || approval.dependent.relationship
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {approval.dependent?.birth_date 
                          ? `${getAge(approval.dependent.birth_date)} anos`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(approval.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {approval.status === 'pending' && (
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                            <Clock className="h-3 w-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                        {approval.status === 'approved' && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Aprovado
                          </Badge>
                        )}
                        {approval.status === 'rejected' && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                            <XCircle className="h-3 w-3 mr-1" />
                            Rejeitado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => viewPhoto(approval.cpf_photo_url)}
                            disabled={!approval.cpf_photo_url}
                          >
                            <ImageIcon className="h-4 w-4" />
                          </Button>
                          {approval.status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600 hover:bg-green-50"
                                onClick={() => {
                                  setSelectedApproval(approval);
                                  setApprovalDialogOpen(true);
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  setSelectedApproval(approval);
                                  setRejectionDialogOpen(true);
                                }}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo Viewer Dialog */}
      <PayslipImageViewer
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
        imageUrl={selectedPhotoUrl}
        patientName="Documento do Dependente"
        loading={loadingPhoto}
      />

      {/* Approval Confirmation Dialog */}
      <AlertDialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Aprovação</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja aprovar o cadastro de <strong>{selectedApproval?.dependent?.name}</strong> como 
              dependente de <strong>{selectedApproval?.patient?.name}</strong>?
              <br /><br />
              O dependente será ativado e poderá realizar agendamentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={approving}
              className="bg-green-600 hover:bg-green-700"
            >
              {approving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Aprovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição do cadastro de {selectedApproval?.dependent?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Motivo da rejeição..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting || !rejectionReason.trim()}
            >
              {rejecting ? (
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
