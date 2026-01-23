import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileImage, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileCheck,
  Loader2,
  Calendar,
  Search,
  User,
  CreditCard,
  Filter,
  RefreshCw,
  MoreVertical,
  History,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePayslipRequests, PayslipRequest } from '@/hooks/usePayslipRequests';
import { PayslipImageViewer } from '@/components/patients/PayslipImageViewer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { savePayslipHistory } from '@/hooks/usePatientPayslipHistory';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function UnionPayslipApprovalsPage() {
  const { currentClinic } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { requests, isLoading, reviewRequest, isReviewing, getAttachmentUrl, refetch } = usePayslipRequests(
    currentClinic?.id
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
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
    setViewingPatientName(request.patients?.name || 'Sócio');
    setViewerOpen(true);

    const url = await getAttachmentUrl(request.attachment_path);
    setViewingImageUrl(url);
    setLoadingImage(false);
  };

  const openReviewDialog = (request: PayslipRequest) => {
    setSelectedRequest(request);
    setReviewNotes('');
    const defaultExpiry = new Date();
    defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);
    setNewExpiresAt(defaultExpiry.toISOString().split('T')[0]);
    setReviewDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest || !currentClinic) return;
    
    if (selectedRequest.attachment_path) {
      await savePayslipHistory({
        clinicId: currentClinic.id,
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
    if (!selectedRequest || !currentClinic) return;
    
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
      if (selectedRequest.attachment_path) {
        await savePayslipHistory({
          clinicId: currentClinic.id,
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

      reviewRequest({
        requestId: selectedRequest.id,
        status: 'rejected',
        notes: reviewNotes,
      });

      if (selectedRequest.patients?.phone) {
        await supabase.functions.invoke('send-payslip-rejection', {
          body: {
            clinic_id: currentClinic.id,
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
        description: "O sócio foi notificado e uma nova solicitação foi criada.",
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
        return <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"><FileCheck className="h-3 w-3" /> Recebido</Badge>;
      case 'approved':
        return <Badge className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" /> Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filtering
  const filteredRequests = (requests || []).filter(request => {
    const matchesSearch = !searchTerm || 
      request.patients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.patient_cards?.card_number?.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRequests = filteredRequests.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  // Stats
  const pendingCount = (requests || []).filter(r => r.status === 'pending').length;
  const receivedCount = (requests || []).filter(r => r.status === 'received').length;
  const approvedCount = (requests || []).filter(r => r.status === 'approved').length;
  const rejectedCount = (requests || []).filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileCheck className="h-6 w-6 text-primary" />
            Aprovação de Contracheques
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as solicitações de validação de contracheques dos sócios
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-muted-foreground/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aguardando</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Para Revisar</p>
                <p className="text-2xl font-bold text-amber-600">{receivedCount}</p>
              </div>
              <FileCheck className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aprovados</p>
                <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejeitados</p>
                <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou carteirinha..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Aguardando</SelectItem>
                  <SelectItem value="received">Recebido</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="rejected">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Solicitações de Contracheque</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <FileImage className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Nenhuma solicitação encontrada com os filtros aplicados.'
                  : 'Nenhuma solicitação de contracheque encontrada.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sócio</TableHead>
                    <TableHead>Carteirinha</TableHead>
                    <TableHead>Solicitado</TableHead>
                    <TableHead>Recebido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRequests.map((request) => (
                    <TableRow key={request.id} className={request.status === 'received' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}>
                      <TableCell>
                        <button 
                          onClick={() => navigate(`/union/socios/${request.patient_id}`)}
                          className="flex items-center gap-2 hover:text-primary transition-colors text-left"
                        >
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{request.patients?.name || 'N/A'}</span>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          {request.patient_cards?.card_number || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.requested_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {request.received_at 
                          ? format(new Date(request.received_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(request.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {request.status === 'received' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => openReviewDialog(request)}
                              className="gap-1"
                            >
                              <FileCheck className="h-4 w-4" />
                              Avaliar
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-popover border shadow-md z-50">
                              {request.attachment_path && (
                                <DropdownMenuItem onClick={() => handleViewImage(request)} className="cursor-pointer">
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver Contracheque
                                </DropdownMenuItem>
                              )}
                              {request.status === 'received' && (
                                <DropdownMenuItem onClick={() => openReviewDialog(request)} className="cursor-pointer text-primary">
                                  <FileCheck className="h-4 w-4 mr-2" />
                                  Avaliar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => navigate(`/union/socios/${request.patient_id}`)}
                                className="cursor-pointer"
                              >
                                <User className="h-4 w-4 mr-2" />
                                Ver Sócio
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => navigate(`/dashboard/patients/${request.patient_id}/contracheques`)}
                                className="cursor-pointer"
                              >
                                <History className="h-4 w-4 mr-2" />
                                Histórico de Validações
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Exibindo {startIndex + 1}-{Math.min(endIndex, filteredRequests.length)} de {filteredRequests.length} registros
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="gap-1"
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
              <p><strong>Sócio:</strong> {selectedRequest?.patients?.name}</p>
              <p><strong>Carteirinha:</strong> {selectedRequest?.patient_cards?.card_number}</p>
              <p><strong>Validade atual:</strong> {selectedRequest?.patient_cards?.expires_at 
                ? format(new Date(selectedRequest.patient_cards.expires_at), "dd/MM/yyyy", { locale: ptBR })
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
              <Label htmlFor="review-notes">Observações (obrigatório para rejeição)</Label>
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
    </div>
  );
}
