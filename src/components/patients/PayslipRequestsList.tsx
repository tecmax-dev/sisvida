import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileImage, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileCheck,
  Loader2,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { usePayslipRequests, PayslipRequest } from '@/hooks/usePayslipRequests';
import { PayslipImageViewer } from './PayslipImageViewer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { savePayslipHistory } from '@/hooks/usePatientPayslipHistory';

interface PayslipRequestsListProps {
  clinicId: string;
  patientId?: string;
}

export function PayslipRequestsList({ clinicId, patientId }: PayslipRequestsListProps) {
  const { requests, isLoading, reviewRequest, isReviewing, getAttachmentUrl, refetch } = usePayslipRequests(
    clinicId,
    patientId
  );
  const { toast } = useToast();

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [viewingPatientName, setViewingPatientName] = useState('');
  const [loadingImage, setLoadingImage] = useState(false);

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PayslipRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [newExpiresAt, setNewExpiresAt] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const handleViewImage = async (request: PayslipRequest) => {
    if (!request.attachment_path) return;

    setLoadingImage(true);
    setViewingPatientName(request.patients?.name || 'Paciente');
    setViewerOpen(true);

    const url = await getAttachmentUrl(request.attachment_path);
    setViewingImageUrl(url);
    setLoadingImage(false);
  };

  const openReviewDialog = (request: PayslipRequest) => {
    setSelectedRequest(request);
    setReviewNotes('');
    // Default to 1 year from now
    const defaultExpiry = new Date();
    defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);
    setNewExpiresAt(defaultExpiry.toISOString().split('T')[0]);
    setReviewDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    // Save to payslip history
    if (selectedRequest.attachment_path) {
      await savePayslipHistory({
        clinicId,
        patientId: selectedRequest.patient_id,
        payslipRequestId: selectedRequest.id,
        cardId: selectedRequest.card_id,
        attachmentPath: selectedRequest.attachment_path,
        validationStatus: 'approved',
        validationNotes: reviewNotes || undefined,
        previousCardExpiry: selectedRequest.patient_cards?.expires_at || null,
        newCardExpiry: newExpiresAt,
      });
    }
    
    reviewRequest({
      requestId: selectedRequest.id,
      status: 'approved',
      notes: reviewNotes || undefined,
      newExpiresAt: newExpiresAt,
    }, {
      onSuccess: () => setReviewDialogOpen(false),
    });
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    
    if (!reviewNotes.trim()) {
      toast({
        variant: "destructive",
        title: "Motivo obrigatório",
        description: "Informe o motivo da rejeição nas observações.",
      });
      return;
    }

    setIsRejecting(true);
    try {
      // Save to payslip history
      if (selectedRequest.attachment_path) {
        await savePayslipHistory({
          clinicId,
          patientId: selectedRequest.patient_id,
          payslipRequestId: selectedRequest.id,
          cardId: selectedRequest.card_id,
          attachmentPath: selectedRequest.attachment_path,
          validationStatus: 'rejected',
          validationNotes: reviewNotes,
          previousCardExpiry: selectedRequest.patient_cards?.expires_at || null,
          newCardExpiry: null,
        });
      }

      // Update the request status
      reviewRequest({
        requestId: selectedRequest.id,
        status: 'rejected',
        notes: reviewNotes,
      });

      // Then send rejection notification and create new pending request
      if (selectedRequest.patients?.phone) {
        await supabase.functions.invoke('send-payslip-rejection', {
          body: {
            clinic_id: clinicId,
            patient_id: selectedRequest.patient_id,
            patient_name: selectedRequest.patients.name,
            patient_phone: selectedRequest.patients.phone,
            card_id: selectedRequest.card_id,
            rejection_reason: reviewNotes
          }
        });
      }

      toast({
        title: "Contracheque rejeitado",
        description: "O paciente foi notificado e uma nova solicitação foi criada.",
      });

      setReviewDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Error rejecting payslip:', error);
      toast({
        variant: "destructive",
        title: "Erro ao rejeitar",
        description: "Não foi possível enviar a notificação.",
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Aguardando</Badge>;
      case 'received':
        return <Badge variant="secondary" className="gap-1"><FileCheck className="h-3 w-3" /> Recebido</Badge>;
      case 'approved':
        return <Badge className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" /> Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-12">
        <FileImage className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">
          Nenhuma solicitação de contracheque encontrada.
        </p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="max-h-[50vh]">
        <div className="space-y-3 pr-4">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-card"
            >
              <div className="flex-1 space-y-1">
                {!patientId && (
                  <p className="font-medium">{request.patients?.name}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    Carteirinha: {request.patient_cards?.card_number || 'N/A'}
                  </span>
                  <span>
                    Solicitado: {format(new Date(request.requested_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  {request.received_at && (
                    <span>
                      Recebido: {format(new Date(request.received_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
                {request.notes && (
                  <p className="text-sm text-muted-foreground italic mt-1">
                    {request.notes}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                {getStatusBadge(request.status)}
                
                {request.attachment_path && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewImage(request)}
                    className="gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    Ver
                  </Button>
                )}

                {request.status === 'received' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => openReviewDialog(request)}
                    className="gap-1"
                  >
                    <FileCheck className="h-4 w-4" />
                    Revisar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Image Viewer Modal */}
      <PayslipImageViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        imageUrl={viewingImageUrl}
        patientName={viewingPatientName}
        loading={loadingImage}
      />

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revisar Contracheque</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p><strong>Paciente:</strong> {selectedRequest?.patients?.name}</p>
              <p><strong>Carteirinha:</strong> {selectedRequest?.patient_cards?.card_number}</p>
              <p><strong>Validade atual:</strong> {selectedRequest?.patient_cards?.expires_at 
                ? format(parseISO(selectedRequest.patient_cards.expires_at), "dd/MM/yyyy", { locale: ptBR })
                : 'N/A'}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-expiry" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Nova validade (se aprovar)
              </Label>
              <Input
                id="new-expiry"
                type="date"
                value={newExpiresAt}
                onChange={(e) => setNewExpiresAt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="review-notes">Observações (opcional)</Label>
              <Textarea
                id="review-notes"
                placeholder="Adicione observações sobre a análise..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isReviewing || isRejecting}
              className="gap-1"
            >
              {isRejecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Rejeitar
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isReviewing || isRejecting || !newExpiresAt}
              className="gap-1"
            >
              {isReviewing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Aprovar e Renovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
