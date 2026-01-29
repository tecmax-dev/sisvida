import { Bell, BellOff, Loader2, Smartphone, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationSetupProps {
  patientId: string | null;
  clinicId: string | null;
}

export function PushNotificationSetup({ patientId, clinicId }: PushNotificationSetupProps) {
  const {
    isNative,
    isWebPushSupported,
    isWebPushSubscribed,
    isWebPushLoading,
    subscribeToWebPush,
  } = usePushNotifications({ patientId, clinicId });

  // Don't show if not supported
  if (isNative) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-green-600" />
            <CardTitle className="text-base">Notificações Nativas</CardTitle>
            <Badge variant="outline" className="bg-green-100 text-green-700">Ativo</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Notificações push nativas estão ativas no seu dispositivo.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isWebPushSupported) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BellOff className="h-5 w-5 text-yellow-600" />
            <CardTitle className="text-base">Notificações Push</CardTitle>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-700">Não Suportado</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Seu navegador não suporta notificações push. Tente usar Chrome, Firefox ou Edge.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isWebPushSubscribed) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-green-600" />
            <CardTitle className="text-base">Notificações Push</CardTitle>
            <Badge variant="outline" className="bg-green-100 text-green-700">Ativo</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Você receberá notificações importantes do sindicato diretamente no seu navegador.
          </p>
          <Button
            onClick={subscribeToWebPush}
            disabled={isWebPushLoading || !clinicId}
            variant="outline"
            className="mt-4 w-full"
          >
            {isWebPushLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reconfigurando...
              </>
            ) : (
              <>
                <Bell className="mr-2 h-4 w-4" />
                Reconfigurar notificações
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Ativar Notificações Push</CardTitle>
        </div>
        <CardDescription>
          Receba avisos importantes do sindicato diretamente no seu dispositivo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={subscribeToWebPush} 
          disabled={isWebPushLoading || !clinicId}
          className="w-full"
        >
          {isWebPushLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Ativando...
            </>
          ) : (
            <>
              <Bell className="mr-2 h-4 w-4" />
              Ativar Notificações
            </>
          )}
        </Button>
        {!clinicId && (
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Faça login para ativar as notificações
          </p>
        )}
      </CardContent>
    </Card>
  );
}
