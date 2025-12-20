import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowUpCircle,
  Check,
  X,
  Clock,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UpgradeRequest {
  id: string;
  clinic_id: string;
  current_plan_id: string | null;
  requested_plan_id: string;
  status: string;
  reason: string | null;
  admin_notes: string | null;
  created_at: string;
  processed_at: string | null;
  clinic: {
    name: string;
    email: string | null;
  };
  current_plan: {
    name: string;
  } | null;
  requested_plan: {
    name: string;
    monthly_price: number;
  };
}

export default function UpgradeRequestsPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<UpgradeRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('upgrade_requests')
        .select(`
          *,
          clinic:clinics(name, email),
          current_plan:subscription_plans!upgrade_requests_current_plan_id_fkey(name),
          requested_plan:subscription_plans!upgrade_requests_requested_plan_id_fkey(name, monthly_price)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar solicitações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (action: 'approved' | 'rejected') => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      // Update request status
      const { error: updateError } = await supabase
        .from('upgrade_requests')
        .update({
          status: action,
          admin_notes: adminNotes.trim() || null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      // If approved, update the subscription
      if (action === 'approved') {
        const { error: subError } = await supabase
          .from('subscriptions')
          .update({
            plan_id: selectedRequest.requested_plan_id,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('clinic_id', selectedRequest.clinic_id);

        if (subError) throw subError;
      }

      toast({
        title: action === 'approved' ? "Upgrade aprovado!" : "Solicitação rejeitada",
        description: action === 'approved'
          ? `O plano da clínica foi atualizado para ${selectedRequest.requested_plan.name}.`
          : "A clínica será notificada sobre a decisão.",
      });

      setSelectedRequest(null);
      setAdminNotes("");
      fetchRequests();
    } catch (error: any) {
      toast({
        title: "Erro ao processar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Pendente</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Aprovado</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredRequests = requests.filter(r => 
    filterStatus === "all" || r.status === filterStatus
  );

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ArrowUpCircle className="h-6 w-6 text-primary" />
            Solicitações de Upgrade
            {pendingCount > 0 && (
              <Badge className="bg-primary text-primary-foreground">
                {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground">
            Gerencie as solicitações de upgrade das clínicas
          </p>
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovadas</SelectItem>
            <SelectItem value="rejected">Rejeitadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requests.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {requests.filter(r => r.status === 'approved').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitadas</CardTitle>
            <X className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {requests.filter(r => r.status === 'rejected').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ArrowUpCircle className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhuma solicitação encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Plano Atual</TableHead>
                  <TableHead>Plano Solicitado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{request.clinic?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {request.clinic?.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {request.current_plan?.name || "Sem plano"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Badge className="bg-primary/10 text-primary">
                          {request.requested_plan?.name}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          R$ {request.requested_plan?.monthly_price}/mês
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(request.status)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">
                        {format(new Date(request.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(request.created_at), "HH:mm", { locale: ptBR })}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === 'pending' ? (
                        <Button
                          size="sm"
                          onClick={() => setSelectedRequest(request)}
                        >
                          Processar
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRequest(request)}
                        >
                          Ver detalhes
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Process Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedRequest?.status === 'pending' 
                ? 'Processar Solicitação' 
                : 'Detalhes da Solicitação'}
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Clínica</p>
                  <p className="font-medium">{selectedRequest.clinic?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedRequest.status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Plano Atual</p>
                  <p className="font-medium">
                    {selectedRequest.current_plan?.name || "Sem plano"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plano Solicitado</p>
                  <p className="font-medium">{selectedRequest.requested_plan?.name}</p>
                  <p className="text-sm text-primary">
                    R$ {selectedRequest.requested_plan?.monthly_price}/mês
                  </p>
                </div>
              </div>

              {selectedRequest.reason && (
                <div>
                  <p className="text-sm text-muted-foreground">Motivo da solicitação</p>
                  <p className="text-sm bg-muted p-3 rounded-lg mt-1">
                    {selectedRequest.reason}
                  </p>
                </div>
              )}

              {selectedRequest.status === 'pending' ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Notas do admin (opcional)</p>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Adicione observações sobre esta decisão..."
                    rows={3}
                  />
                </div>
              ) : (
                selectedRequest.admin_notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notas do admin</p>
                    <p className="text-sm bg-muted p-3 rounded-lg mt-1">
                      {selectedRequest.admin_notes}
                    </p>
                  </div>
                )
              )}

              {selectedRequest.status === 'pending' && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => handleProcess('rejected')}
                    disabled={processing}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Rejeitar
                  </Button>
                  <Button
                    onClick={() => handleProcess('approved')}
                    disabled={processing}
                  >
                    {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Check className="h-4 w-4 mr-2" />
                    Aprovar Upgrade
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
