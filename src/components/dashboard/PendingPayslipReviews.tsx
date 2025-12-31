import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileCheck, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock,
  ArrowRight,
  User,
  CreditCard,
  RefreshCw,
  ImageIcon,
  Calendar,
  Users
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow, addYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

interface PayslipRequest {
  id: string;
  patient_id: string;
  card_id: string;
  status: string;
  attachment_path: string | null;
  received_at: string | null;
  notes: string | null;
  patient: {
    name: string;
    cpf: string | null;
  };
  card: {
    card_number: string;
    expires_at: string | null;
  } | null;
}

export default function PendingPayslipReviews() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<PayslipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PayslipRequest | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [newExpiryDate, setNewExpiryDate] = useState("");
  const [dependentsCount, setDependentsCount] = useState(0);

  useEffect(() => {
    if (currentClinic) {
      fetchPendingRequests();
    }
  }, [currentClinic]);

  const fetchPendingRequests = async () => {
    if (!currentClinic) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payslip_requests')
        .select(`
          id,
          patient_id,
          card_id,
          status,
          attachment_path,
          received_at,
          notes,
          patient:patients (
            name,
            cpf
          ),
          card:patient_cards (
            card_number,
            expires_at
          )
        `)
        .eq('clinic_id', currentClinic.id)
        .eq('status', 'received')
        .order('received_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as unknown as PayslipRequest[]);
    } catch (error) {
      console.error('Error fetching payslip requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const openReview = async (request: PayslipRequest) => {
    setSelectedRequest(request);
    setReviewNotes(request.notes || "");
    
    // Set default expiry date to 1 year from now
    const defaultExpiry = addYears(new Date(), 1);
    setNewExpiryDate(format(defaultExpiry, "yyyy-MM-dd"));
    
    // Fetch dependents count
    const { count } = await supabase
      .from('patient_dependents')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', request.patient_id)
      .eq('is_active', true);
    
    setDependentsCount(count || 0);
    
    if (request.attachment_path) {
      const { data } = await supabase.storage
        .from('contra-cheques')
        .createSignedUrl(request.attachment_path, 300);
      
      if (data?.signedUrl) {
        setPreviewUrl(data.signedUrl);
      }
    }
  };

  const closeReview = () => {
    setSelectedRequest(null);
    setPreviewUrl(null);
    setReviewNotes("");
    setNewExpiryDate("");
    setDependentsCount(0);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    if (!newExpiryDate) {
      toast({
        variant: "destructive",
        title: "Data obrigatória",
        description: "Informe a nova data de validade da carteirinha.",
      });
      return;
    }
    
    setProcessing(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const expiryTimestamp = new Date(newExpiryDate).toISOString();
      
      // Update payslip request status
      const { error: requestError } = await supabase
        .from('payslip_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
          notes: reviewNotes || null,
        })
        .eq('id', selectedRequest.id);

      if (requestError) throw requestError;

      // Update patient's card expiry
      const { error: cardError } = await supabase
        .from('patient_cards')
        .update({ expires_at: expiryTimestamp })
        .eq('id', selectedRequest.card_id);

      if (cardError) throw cardError;

      // Update all active dependents' card expiry for this patient
      const { error: dependentsError } = await supabase
        .from('patient_dependents')
        .update({ card_expires_at: expiryTimestamp })
        .eq('patient_id', selectedRequest.patient_id)
        .eq('is_active', true);

      if (dependentsError) throw dependentsError;

      const dependentMsg = dependentsCount > 0 
        ? ` A validade de ${dependentsCount} dependente(s) também foi atualizada.`
        : '';

      toast({
        title: "Contracheque aprovado",
        description: `Carteirinha de ${selectedRequest.patient.name} atualizada até ${format(new Date(newExpiryDate), "dd/MM/yyyy")}.${dependentMsg}`,
      });

      closeReview();
      fetchPendingRequests();
    } catch (error) {
      console.error('Error approving payslip:', error);
      toast({
        variant: "destructive",
        title: "Erro ao aprovar",
        description: "Não foi possível aprovar o contracheque.",
      });
    } finally {
      setProcessing(false);
    }
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

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('payslip_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          notes: reviewNotes,
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast({
        title: "Contracheque rejeitado",
        description: `O contracheque de ${selectedRequest.patient.name} foi rejeitado.`,
      });

      closeReview();
      fetchPendingRequests();
    } catch (error) {
      console.error('Error rejecting payslip:', error);
      toast({
        variant: "destructive",
        title: "Erro ao rejeitar",
        description: "Não foi possível rejeitar o contracheque.",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (requests.length === 0 && !loading) {
    return null;
  }

  return (
    <>
      <Card className="border-0 bg-card shadow-md overflow-hidden border-l-4 border-l-warning">
        <CardHeader className="flex flex-row items-center justify-between pb-3 bg-gradient-to-r from-warning/10 to-transparent border-b border-border/30">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-warning" />
              Contracheques Aguardando Avaliação
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {requests.length} {requests.length === 1 ? 'documento pendente' : 'documentos pendentes'}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={fetchPendingRequests}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {requests.slice(0, 5).map((request) => (
                <div 
                  key={request.id} 
                  className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-warning" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">
                        {request.patient.name}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CreditCard className="h-3 w-3" />
                        <span>{request.card?.card_number || 'Sem carteirinha'}</span>
                        {request.received_at && (
                          <>
                            <span className="opacity-50">•</span>
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(new Date(request.received_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openReview(request)}
                    className="flex-shrink-0"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Avaliar
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          {requests.length > 5 && (
            <div className="p-3 border-t border-border bg-muted/20">
              <Button variant="ghost" size="sm" className="w-full text-primary">
                Ver todos os {requests.length} pendentes
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => closeReview()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-warning" />
              Avaliar Contracheque
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {/* Patient Info */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedRequest.patient.name}</span>
                </div>
                {selectedRequest.patient.cpf && (
                  <p className="text-sm text-muted-foreground">
                    CPF: {selectedRequest.patient.cpf}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedRequest.card?.card_number || 'N/A'}</span>
                  </div>
                  {selectedRequest.card?.expires_at && (
                    <Badge variant="outline">
                      Expira: {format(new Date(selectedRequest.card.expires_at), "dd/MM/yyyy")}
                    </Badge>
                  )}
                </div>
                {selectedRequest.received_at && (
                  <p className="text-xs text-muted-foreground">
                    Recebido em: {format(new Date(selectedRequest.received_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>

              {/* Image Preview */}
              <div className="space-y-2">
                <Label>Imagem do Contracheque</Label>
                {previewUrl ? (
                  <ScrollArea className="h-[300px] rounded-lg border bg-muted/20">
                    <div className="p-2">
                      <img 
                        src={previewUrl} 
                        alt="Contracheque" 
                        className="w-full rounded-lg object-contain"
                      />
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-[200px] rounded-lg border bg-muted/20 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Imagem não disponível</p>
                    </div>
                  </div>
                )}
              </div>

              {/* New Expiry Date */}
              <div className="space-y-2">
                <Label htmlFor="expiry-date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Nova Data de Validade
                </Label>
                <Input
                  id="expiry-date"
                  type="date"
                  value={newExpiryDate}
                  onChange={(e) => setNewExpiryDate(e.target.value)}
                  className="max-w-[200px]"
                />
                {dependentsCount > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                    <Users className="h-4 w-4" />
                    <span>
                      A nova validade será aplicada também para <strong>{dependentsCount}</strong> dependente(s) vinculado(s).
                    </span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Adicione observações sobre a avaliação (obrigatório para rejeição)..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={closeReview}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={processing}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Rejeitar
            </Button>
            <Button 
              onClick={handleApprove}
              disabled={processing}
              className="bg-success hover:bg-success/90"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
