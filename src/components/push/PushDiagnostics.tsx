import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Loader2,
  Copy,
  Bug
} from 'lucide-react';
import { 
  initializeOneSignal, 
  getPlayerId, 
  isSubscribed as checkIsSubscribed,
} from '@/lib/onesignal';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

interface DiagnosticResult {
  name: string;
  status: 'success' | 'warning' | 'error' | 'pending';
  message: string;
  details?: string;
}

interface PushDiagnosticsProps {
  patientId: string | null;
  clinicId: string | null;
}

export function PushDiagnostics({ patientId, clinicId }: PushDiagnosticsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    
    const diagnostics: DiagnosticResult[] = [];

    // 1. Check platform
    const isNative = Capacitor.isNativePlatform();
    diagnostics.push({
      name: 'Plataforma',
      status: 'success',
      message: isNative ? `Nativo (${Capacitor.getPlatform()})` : 'Web/PWA',
      details: `UserAgent: ${navigator.userAgent.substring(0, 50)}...`
    });
    setResults([...diagnostics]);

    // 2. Check browser support
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    const hasNotification = 'Notification' in window;
    
    diagnostics.push({
      name: 'Suporte do Navegador',
      status: hasServiceWorker && hasPushManager && hasNotification ? 'success' : 'error',
      message: hasServiceWorker && hasPushManager && hasNotification 
        ? 'Todas APIs suportadas' 
        : 'Navegador não suporta push',
      details: `SW: ${hasServiceWorker}, PM: ${hasPushManager}, N: ${hasNotification}`
    });
    setResults([...diagnostics]);

    // 3. Check notification permission
    const permission = Notification.permission;
    diagnostics.push({
      name: 'Permissão do Navegador',
      status: permission === 'granted' ? 'success' : permission === 'denied' ? 'error' : 'warning',
      message: permission === 'granted' ? 'Concedida' : permission === 'denied' ? 'Negada' : 'Não solicitada',
      details: permission === 'denied' ? 'Acesse configurações do navegador para permitir' : undefined
    });
    setResults([...diagnostics]);

    // 4. Check Service Worker registration
    let swInfo: {
      appSW: ServiceWorkerRegistration | undefined;
      appScope: string | null;
      appOk: boolean;
      appHasPushManager: boolean;
      registrations: readonly ServiceWorkerRegistration[];
    } | null = null;

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();

      // Detect PWA SW (vite-plugin-pwa generates /sw.js by default)
      const appSW = registrations.find((r) => r.active?.scriptURL?.endsWith('/sw.js')) ||
        registrations.find((r) => r.active?.scriptURL);

      const appScope = appSW?.scope || null;
      const appOk = !!appSW && (appScope?.endsWith('/') ?? false);
      const appHasPushManager = !!appSW?.pushManager;

      swInfo = { appSW, appScope, appOk, appHasPushManager, registrations };

      const getFile = (r: ServiceWorkerRegistration | undefined) =>
        r?.active?.scriptURL?.split('/').pop() || null;

      if (!appOk) {
        diagnostics.push({
          name: 'Service Worker',
          status: 'error',
          message: 'SW do app não encontrado ou escopo incorreto.',
          details: `regs=${registrations.length}`,
        });
      } else if (!appHasPushManager) {
        diagnostics.push({
          name: 'Service Worker',
          status: 'error',
          message: 'SW do app sem PushManager (push indisponível).',
          details: `sw=${getFile(appSW)}`,
        });
      } else {
        // Preliminary - will be updated after OneSignal check
        diagnostics.push({
          name: 'Service Worker',
          status: 'pending',
          message: 'SW encontrado, verificando OneSignal...',
          details: `sw=${getFile(appSW)} | scope=${appScope}`,
        });
      }
      setResults([...diagnostics]);
    } catch (err) {
      diagnostics.push({
        name: 'Service Worker',
        status: 'error',
        message: 'Erro ao verificar SW',
        details: String(err),
      });
      setResults([...diagnostics]);
    }

    // 5. Initialize OneSignal and check subscription
    let oneSignalStatus: DiagnosticResult = {
      name: 'OneSignal SDK',
      status: 'pending',
      message: 'Inicializando...'
    };
    
    let isFullySubscribed = false;
    let currentPlayerId: string | null = null;
    
    try {
      const initialized = await initializeOneSignal();
      if (!initialized) {
        oneSignalStatus = {
          name: 'OneSignal SDK',
          status: 'error',
          message: 'Falha na inicialização',
          details: 'Verifique console para mais detalhes'
        };
      } else {
        const subscribed = await checkIsSubscribed();
        currentPlayerId = await getPlayerId();
        
        isFullySubscribed = !!(subscribed && currentPlayerId);
        
        oneSignalStatus = {
          name: 'OneSignal SDK',
          status: isFullySubscribed ? 'success' : 'warning',
          message: subscribed ? 'Inscrito' : 'Não inscrito',
          details: currentPlayerId ? `Player ID: ${currentPlayerId.substring(0, 12)}...` : 'Sem Player ID'
        };
      }
    } catch (err) {
      oneSignalStatus = {
        name: 'OneSignal SDK',
        status: 'error',
        message: 'Erro no SDK',
        details: String(err)
      };
    }
    
    diagnostics.push(oneSignalStatus);
    
    // Update SW status based on OneSignal result
    if (swInfo?.appOk && swInfo?.appHasPushManager) {
      const swIndex = diagnostics.findIndex(d => d.name === 'Service Worker');
      if (swIndex !== -1) {
        const getFile = (r: ServiceWorkerRegistration | undefined) =>
          r?.active?.scriptURL?.split('/').pop() || null;
          
        if (isFullySubscribed) {
          diagnostics[swIndex] = {
            name: 'Service Worker',
            status: 'success',
            message: 'SW OK com push ativo via OneSignal.',
            details: `sw=${getFile(swInfo.appSW)} | scope=${swInfo.appScope}`,
          };
        } else {
          diagnostics[swIndex] = {
            name: 'Service Worker',
            status: 'warning',
            message: 'SW OK. Clique "Ativar Notificações" para completar.',
            details: `sw=${getFile(swInfo.appSW)} | scope=${swInfo.appScope}`,
          };
        }
      }
    }
    
    setResults([...diagnostics]);

    // 6. Check database registration
    let dbStatus: DiagnosticResult = {
      name: 'Registro no Banco',
      status: 'pending',
      message: 'Verificando...'
    };
    if (clinicId) {
      try {
        // Build query to find token for this device
        let query = supabase
          .from('push_notification_tokens')
          .select('id, token, is_active, updated_at, device_info')
          .eq('clinic_id', clinicId)
          .eq('platform', 'web')
          .eq('is_active', true);

        // If we have a player ID, search by token
        if (currentPlayerId) {
          query = query.eq('token', currentPlayerId);
        } else {
          // Fallback: search by userAgent
          query = query.eq('device_info->>userAgent', navigator.userAgent);
        }

        if (patientId) {
          query = query.eq('patient_id', patientId);
        }

        const { data, error } = await query.order('updated_at', { ascending: false }).limit(1);

        if (error) {
          dbStatus = {
            name: 'Registro no Banco',
            status: 'error',
            message: 'Erro na consulta',
            details: error.message
          };
        } else if (data && data.length > 0) {
          const record = data[0];
          const updatedAt = new Date(record.updated_at);
          const hoursAgo = Math.round((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60));
          
          dbStatus = {
            name: 'Registro no Banco',
            status: 'success',
            message: 'Token registrado',
            details: `Atualizado há ${hoursAgo}h - Token: ${record.token.substring(0, 12)}...`
          };
        } else {
          dbStatus = {
            name: 'Registro no Banco',
            status: 'warning',
            message: 'Token não encontrado',
            details: 'Clique em "Ativar Notificações" para registrar'
          };
        }
      } catch (err) {
        dbStatus = {
          name: 'Registro no Banco',
          status: 'error',
          message: 'Exceção',
          details: String(err)
        };
      }
    } else {
      dbStatus = {
        name: 'Registro no Banco',
        status: 'warning',
        message: 'Sem clinic_id',
        details: 'Usuário não autenticado'
      };
    }
    diagnostics.push(dbStatus);
    setResults([...diagnostics]);

    setIsRunning(false);
  };

  const copyDiagnostics = () => {
    const text = results.map(r => 
      `${r.status === 'success' ? '✓' : r.status === 'error' ? '✗' : '⚠'} ${r.name}: ${r.message}${r.details ? ` (${r.details})` : ''}`
    ).join('\n');
    
    navigator.clipboard.writeText(text);
    toast.success('Diagnóstico copiado para área de transferência');
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-700">OK</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700">Erro</Badge>;
      case 'warning':
        return <Badge className="bg-amber-100 text-amber-700">Alerta</Badge>;
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-700">...</Badge>;
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground text-xs"
        onClick={() => {
          setIsOpen(true);
          runDiagnostics();
        }}
      >
        <Bug className="h-3 w-3 mr-1" />
        Diagnóstico
      </Button>
    );
  }

  return (
    <Card className="mt-4 border-dashed">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Diagnóstico de Notificações
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={runDiagnostics}
              disabled={isRunning}
            >
              <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyDiagnostics}
              disabled={results.length === 0}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {results.map((result, index) => (
            <div key={index} className="flex items-start gap-2 text-sm">
              {getStatusIcon(result.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{result.name}</span>
                  {getStatusBadge(result.status)}
                </div>
                <p className="text-muted-foreground">{result.message}</p>
                {result.details && (
                  <p className="text-xs text-muted-foreground/70 truncate">{result.details}</p>
                )}
              </div>
            </div>
          ))}
          
          {results.length === 0 && !isRunning && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Clique em executar para iniciar o diagnóstico
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
