import { useState } from "react";
import { useClinicAddons } from "@/hooks/useClinicAddons";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  MessageSquare,
  Code,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Package,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const addonIcons: Record<string, React.ReactNode> = {
  whatsapp_advanced: <MessageSquare className="h-5 w-5" />,
  api_access: <Code className="h-5 w-5" />,
};

export function ClinicAddonsSection() {
  const { availableAddons: addons, clinicAddons, pendingRequests: requests, isLoading: loading } = useClinicAddons();
  const { currentClinic, user } = useAuth();
  const { toast } = useToast();
  
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedAddon, setSelectedAddon] = useState<typeof addons[0] | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const getAddonStatus = (addonKey: string) => {
    const clinicAddon = clinicAddons.find(ca => ca.addon?.key === addonKey);
    if (clinicAddon) {
      return clinicAddon.status;
    }
    
    const pendingRequest = requests.find(
      r => r.addon?.key === addonKey && r.status === 'pending'
    );
    if (pendingRequest) {
      return 'pending_request';
    }
    
    return 'not_contracted';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"><CheckCircle className="h-3 w-3 mr-1" />Ativo</Badge>;
      case 'suspended':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"><XCircle className="h-3 w-3 mr-1" />Suspenso</Badge>;
      case 'pending_request':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"><Clock className="h-3 w-3 mr-1" />Aguardando Aprovação</Badge>;
      case 'not_contracted':
        return <Badge variant="outline">Não Contratado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleOpenRequestDialog = (addon: typeof addons[0]) => {
    setSelectedAddon(addon);
    setRequestReason("");
    setRequestDialogOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!selectedAddon || !currentClinic || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('addon_requests').insert({
        clinic_id: currentClinic.id,
        addon_id: selectedAddon.id,
        requested_by: user.id,
        request_reason: requestReason.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "Solicitação enviada!",
        description: "Sua solicitação será analisada e você será notificado.",
      });

      setRequestDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao enviar solicitação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const activeAddons = clinicAddons.filter(ca => ca.status === 'active');

  return (
    <div className="space-y-6">
      {activeAddons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Package className="h-5 w-5" />
              Add-ons Contratados ({activeAddons.length})
            </CardTitle>
            <CardDescription>
              Recursos adicionais ativos na sua clínica
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {activeAddons.map((clinicAddon) => (
                <div
                  key={clinicAddon.id}
                  className="p-4 rounded-lg border border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900 text-green-600">
                      {addonIcons[clinicAddon.addon?.key || ''] || <Package className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium truncate">{clinicAddon.addon?.name}</h4>
                        {getStatusBadge('active')}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {clinicAddon.addon?.description}
                      </p>
                      {clinicAddon.addon?.monthly_price && clinicAddon.addon.monthly_price > 0 && (
                        <p className="text-sm font-medium text-green-600 mt-2">
                          {formatPrice(clinicAddon.addon.monthly_price)}/mês
                        </p>
                      )}
                      {clinicAddon.activated_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Ativo desde {format(new Date(clinicAddon.activated_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Add-ons Disponíveis
          </CardTitle>
          <CardDescription>
            Contrate recursos adicionais para expandir as funcionalidades da sua clínica
          </CardDescription>
        </CardHeader>
        <CardContent>
          {addons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum add-on disponível no momento.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {addons.map((addon) => {
                const status = getAddonStatus(addon.key);
                const isActive = status === 'active';
                const isPending = status === 'pending_request';
                
                return (
                  <div
                    key={addon.id}
                    className={`p-4 rounded-lg border transition-all ${
                      isActive 
                        ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30' 
                        : isPending
                          ? 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/30'
                          : 'hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        isActive 
                          ? 'bg-green-100 dark:bg-green-900 text-green-600'
                          : isPending
                            ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600'
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {addonIcons[addon.key] || <Package className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-medium truncate">{addon.name}</h4>
                          {getStatusBadge(status)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {addon.description}
                        </p>
                        
                        {addon.features && addon.features.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {(addon.features as string[]).slice(0, 3).map((feature, idx) => (
                              <li key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <CheckCircle className="h-3 w-3 text-green-600" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        )}
                        
                        <div className="flex items-center justify-between mt-3">
                          {addon.monthly_price > 0 ? (
                            <span className="text-lg font-semibold text-primary">
                              {formatPrice(addon.monthly_price)}
                              <span className="text-xs font-normal text-muted-foreground">/mês</span>
                            </span>
                          ) : (
                            <span className="text-lg font-semibold text-green-600">Grátis</span>
                          )}
                          
                          {!isActive && !isPending && (
                            <Button
                              size="sm"
                              onClick={() => handleOpenRequestDialog(addon)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Solicitar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {requests.filter(r => r.status === 'pending').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <Clock className="h-5 w-5" />
              Solicitações Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {requests.filter(r => r.status === 'pending').map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{request.addon?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Solicitado em {format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  {getStatusBadge('pending_request')}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <PopupBase open={requestDialogOpen} onClose={() => setRequestDialogOpen(false)}>
        <PopupHeader>
          <PopupTitle className="flex items-center gap-2">
            {selectedAddon && addonIcons[selectedAddon.key]}
            Solicitar {selectedAddon?.name}
          </PopupTitle>
          <PopupDescription>
            Sua solicitação será analisada pela nossa equipe
          </PopupDescription>
        </PopupHeader>

        {selectedAddon && (
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-sm">{selectedAddon.description}</p>
              {selectedAddon.monthly_price > 0 && (
                <p className="text-lg font-semibold text-primary mt-2">
                  {formatPrice(selectedAddon.monthly_price)}/mês
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo da solicitação (opcional)</label>
              <Textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="Descreva por que precisa deste recurso..."
                rows={3}
              />
            </div>
          </div>
        )}

        <PopupFooter>
          <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmitRequest} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar Solicitação
          </Button>
        </PopupFooter>
      </PopupBase>
    </div>
  );
}
