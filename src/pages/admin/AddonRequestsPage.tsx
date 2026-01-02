import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Loader2, 
  Check, 
  X, 
  MessageSquare, 
  Plug, 
  Clock, 
  Building2,
  Search,
} from "lucide-react";
import { useAddonRequestsAdmin } from "@/hooks/useClinicAddons";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const addonIcons: Record<string, any> = {
  whatsapp_advanced: MessageSquare,
  api_access: Plug,
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
};

export default function AddonRequestsPage() {
  const { 
    allRequests, 
    pendingCount, 
    isLoading, 
    approveRequest, 
    rejectRequest,
    isApproving,
    isRejecting,
  } = useAddonRequestsAdmin();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const filteredRequests = allRequests?.filter(req => {
    const search = searchQuery.toLowerCase();
    return (
      req.clinic?.name?.toLowerCase().includes(search) ||
      req.addon?.name?.toLowerCase().includes(search)
    );
  });

  const pendingRequests = filteredRequests?.filter(r => r.status === 'pending') || [];
  const processedRequests = filteredRequests?.filter(r => r.status !== 'pending') || [];

  const handleAction = () => {
    if (!selectedRequest || !actionType) return;

    if (actionType === 'approve') {
      approveRequest({ requestId: selectedRequest.id, notes: adminNotes });
    } else {
      rejectRequest({ requestId: selectedRequest.id, notes: adminNotes });
    }

    setSelectedRequest(null);
    setActionType(null);
    setAdminNotes("");
  };

  const openActionDialog = (request: any, type: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(type);
    setAdminNotes("");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Solicitações de Add-ons</h1>
          <p className="text-muted-foreground">Gerencie as solicitações de produtos adicionais</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Solicitações de Add-ons</h1>
        <p className="text-muted-foreground">Gerencie as solicitações de produtos adicionais</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
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
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                <Check className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {allRequests?.filter(r => r.status === 'approved').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Aprovadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                <X className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {allRequests?.filter(r => r.status === 'rejected').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Rejeitadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por clínica ou add-on..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            Pendentes
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="processed">Processadas</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Add-on</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma solicitação pendente
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingRequests.map((request) => {
                    const Icon = addonIcons[request.addon?.key || ''] || Plug;
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{request.clinic?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-primary" />
                            <span>{request.addon?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-primary">
                            R$ {request.addon?.monthly_price?.toFixed(2)}/mês
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="text-sm text-muted-foreground truncate block">
                            {request.request_reason || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {format(new Date(request.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => openActionDialog(request, 'approve')}
                              className="bg-success hover:bg-success/90"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openActionDialog(request, 'reject')}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Rejeitar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="processed" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Add-on</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma solicitação processada
                    </TableCell>
                  </TableRow>
                ) : (
                  processedRequests.map((request) => {
                    const Icon = addonIcons[request.addon?.key || ''] || Plug;
                    const status = statusConfig[request.status];
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{request.clinic?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-primary" />
                            <span>{request.addon?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status?.variant}>{status?.label}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="text-sm text-muted-foreground truncate block">
                            {request.admin_notes || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {request.reviewed_at
                            ? format(new Date(request.reviewed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={!!selectedRequest && !!actionType} onOpenChange={() => {
        setSelectedRequest(null);
        setActionType(null);
        setAdminNotes("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Aprovar Solicitação' : 'Rejeitar Solicitação'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p><strong>Clínica:</strong> {selectedRequest?.clinic?.name}</p>
              <p><strong>Add-on:</strong> {selectedRequest?.addon?.name}</p>
              <p><strong>Valor:</strong> R$ {selectedRequest?.addon?.monthly_price?.toFixed(2)}/mês</p>
              {selectedRequest?.request_reason && (
                <p><strong>Motivo:</strong> {selectedRequest.request_reason}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Observações (opcional)</label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Adicione observações sobre esta decisão..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setSelectedRequest(null);
              setActionType(null);
            }}>
              Cancelar
            </Button>
            <Button
              variant={actionType === 'approve' ? 'default' : 'destructive'}
              onClick={handleAction}
              disabled={isApproving || isRejecting}
              className={actionType === 'approve' ? 'bg-success hover:bg-success/90' : ''}
            >
              {(isApproving || isRejecting) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === 'approve' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}