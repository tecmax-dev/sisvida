import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Smartphone, 
  Share, 
  Plus, 
  ArrowLeft, 
  Download, 
  CheckCircle2, 
  RefreshCw,
  Apple,
  Zap,
  Shield,
  Wifi,
  Clock,
  ExternalLink
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PushNotificationSetup } from "@/components/union/PushNotificationSetup";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function MobileInstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [clinicName, setClinicName] = useState("Sindicato dos Comerciários");
  const [clinicLogo, setClinicLogo] = useState<string | null>(null);
  
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  // CRITICAL: Apply iOS PWA icon immediately on mount
  useEffect(() => {
    const sindicatoLogoUrl = "https://eahhszmbyxapxzilfdlo.supabase.co/storage/v1/object/public/clinic-assets/89e7585e-7bce-4e58-91fa-c37080d1170d/logo.png";
    
    const updateAppleTouchIcon = (href: string) => {
      const existingIcons = document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]');
      existingIcons.forEach(icon => icon.remove());
      
      const sizes = ['180x180', '152x152', '144x144', '120x120', '114x114', '76x76', '72x72', '60x60', '57x57'];
      sizes.forEach(size => {
        const link = document.createElement('link');
        link.rel = 'apple-touch-icon';
        link.setAttribute('sizes', size);
        link.href = href;
        document.head.insertBefore(link, document.head.firstChild);
      });
      
      const fallbackLink = document.createElement('link');
      fallbackLink.rel = 'apple-touch-icon';
      fallbackLink.href = href;
      document.head.insertBefore(fallbackLink, document.head.firstChild);
      
      const precomposedLink = document.createElement('link');
      precomposedLink.rel = 'apple-touch-icon-precomposed';
      precomposedLink.href = href;
      document.head.insertBefore(precomposedLink, document.head.firstChild);
    };
    
    updateAppleTouchIcon(sindicatoLogoUrl);
    
    const faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (faviconLink) {
      faviconLink.href = sindicatoLogoUrl;
    }
    
    document.title = "Sindicato - Instalar App";
    
    const updateMeta = (name: string, content: string) => {
      let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (meta) {
        meta.content = content;
      } else {
        meta = document.createElement('meta');
        meta.name = name;
        meta.content = content;
        document.head.appendChild(meta);
      }
    };
    
    updateMeta('apple-mobile-web-app-title', 'Sindicato');
    updateMeta('application-name', 'Sindicato');
  }, []);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isSafariBrowser = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);
    
    setIsIOS(isIOSDevice);
    setIsSafari(isSafariBrowser);

    // Detectar se já está instalado (modo standalone)
    const checkStandalone = () => {
      return window.matchMedia('(display-mode: standalone)').matches ||
             (window.navigator as any).standalone === true;
    };

    if (checkStandalone()) {
      setIsInstalled(true);
      return;
    }

    // Capturar evento beforeinstallprompt para Chrome/Edge/Android
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
      console.log('[PWA] beforeinstallprompt capturado');
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Detectar quando o app foi instalado
    const installedHandler = () => {
      console.log('[PWA] App instalado com sucesso');
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    loadClinicData();

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const loadClinicData = async () => {
    try {
      const { data } = await supabase
        .from("clinics")
        .select("name, logo_url")
        .eq("id", SINDICATO_CLINIC_ID)
        .single();

      if (data) {
        setClinicName(data.name);
        setClinicLogo(data.logo_url);
      }
    } catch (error) {
      console.error("Error loading clinic data:", error);
    }
  };

  // Instalação via prompt nativo do navegador
  const handleInstall = async () => {
    if (!deferredPrompt) {
      console.error('[PWA] Prompt de instalação não disponível');
      return;
    }

    try {
      console.log('[PWA] Disparando prompt de instalação nativo...');
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log('[PWA] Resultado da instalação:', outcome);
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setCanInstall(false);
        toast.success('App instalado com sucesso!');
      } else {
        toast.info('Instalação cancelada. Você pode tentar novamente.');
      }
      setDeferredPrompt(null);
    } catch (error) {
      console.error('[PWA] Erro ao instalar:', error);
      toast.error('Erro ao instalar. Tente recarregar a página.');
    }
  };

  const handleForceUpdate = async () => {
    setIsUpdating(true);
    toast.info('Atualizando aplicativo...');
    
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.update().catch(() => undefined)));
      }
      
      toast.success('Atualização aplicada! Recarregando...');
      
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      toast.error('Erro ao atualizar. Tente recarregar a página manualmente.');
      setIsUpdating(false);
    }
  };

  const openApp = () => {
    window.location.href = '/app';
  };

  const StepItem = ({ number, title, description, icon: Icon }: { 
    number: number; 
    title: string; 
    description: string;
    icon?: React.ElementType;
  }) => (
    <div className="flex gap-4 items-start">
      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shrink-0 shadow-md">
        {number}
      </div>
      <div className="flex-1 pt-1">
        <p className="font-semibold text-foreground flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-primary" />}
          {title}
        </p>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header com identidade visual */}
      <header className="bg-primary text-primary-foreground">
        <div className="px-4 py-3">
          <Link 
            to="/app" 
            className="inline-flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao App
          </Link>
        </div>
        
        <div className="px-6 pb-8 pt-2">
          <div className="flex items-center gap-4">
            {clinicLogo ? (
              <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-lg">
                <img 
                  src={clinicLogo} 
                  alt={clinicName} 
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                <Smartphone className="h-8 w-8" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">Instalar Aplicativo</h1>
              <p className="text-primary-foreground/80 text-sm">{clinicName}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        
        {/* === ESTADO: APP JÁ INSTALADO === */}
        {isInstalled && (
          <Card className="border-green-500 bg-gradient-to-br from-green-50 to-green-100 shadow-lg">
            <CardContent className="py-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-green-500 flex items-center justify-center shadow-md">
                  <CheckCircle2 className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg text-green-800">App Instalado!</p>
                  <p className="text-sm text-green-700">O aplicativo está na sua tela inicial</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <Button onClick={openApp} size="lg" className="w-full gap-2 h-12 text-base font-semibold bg-green-600 hover:bg-green-700">
                  <ExternalLink className="h-5 w-5" />
                  Abrir App
                </Button>
                
                <Button onClick={handleForceUpdate} variant="outline" size="lg" className="w-full gap-2" disabled={isUpdating}>
                  <RefreshCw className={`h-5 w-5 ${isUpdating ? 'animate-spin' : ''}`} />
                  {isUpdating ? 'Atualizando...' : 'Verificar Atualizações'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* === ESTADO: PODE INSTALAR VIA PROMPT NATIVO (Chrome/Edge/Android) === */}
        {!isInstalled && canInstall && (
          <Card className="border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg">
            <CardContent className="py-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-md">
                  <Download className="h-7 w-7 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg text-foreground">Instalar Aplicativo</p>
                  <p className="text-sm text-muted-foreground">Adicione à sua tela inicial</p>
                </div>
              </div>
              
              <Button 
                onClick={handleInstall} 
                size="lg" 
                className="w-full gap-2 h-14 text-lg font-bold"
              >
                <Download className="h-6 w-6" />
                INSTALAR APP
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                O diálogo nativo do navegador será aberto
              </p>
            </CardContent>
          </Card>
        )}

        {/* === ESTADO: iOS (Safari) - Instruções manuais === */}
        {!isInstalled && !canInstall && isIOS && (
          <Card className="border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg">
            <CardContent className="py-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-md">
                  <Apple className="h-7 w-7 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg text-foreground">Instalar no iPhone/iPad</p>
                  <p className="text-sm text-muted-foreground">
                    {isSafari ? 'Você está no Safari! Siga os passos:' : 'Abra no Safari para instalar'}
                  </p>
                </div>
              </div>
              
              {isSafari ? (
                <div className="space-y-4 pt-2">
                  <StepItem 
                    number={1}
                    title="Toque em Compartilhar"
                    description="Ícone de quadrado com seta para cima, na barra inferior."
                    icon={Share}
                  />
                  
                  <StepItem 
                    number={2}
                    title="Adicionar à Tela de Início"
                    description="Role as opções e encontre esta opção com ícone de +"
                    icon={Plus}
                  />
                  
                  <StepItem 
                    number={3}
                    title="Confirme em 'Adicionar'"
                    description="Pronto! O app aparecerá na sua tela inicial."
                    icon={CheckCircle2}
                  />
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-amber-800 font-medium text-sm">
                    ⚠️ Para instalar no iPhone/iPad, é necessário abrir esta página no Safari (navegador padrão da Apple).
                  </p>
                  <p className="text-amber-700 text-sm mt-2">
                    Copie o endereço desta página e cole no Safari.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* === ESTADO: Navegador sem suporte (Desktop ou navegador antigo) === */}
        {!isInstalled && !canInstall && !isIOS && (
          <Card className="border-muted bg-muted/30 shadow-lg">
            <CardContent className="py-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center shadow-md">
                  <Smartphone className="h-7 w-7 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg text-foreground">Instalação não disponível</p>
                  <p className="text-sm text-muted-foreground">
                    Seu navegador não suporta instalação de PWA
                  </p>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <p className="text-blue-800 font-medium text-sm">
                  💡 Para instalar o app:
                </p>
                <ul className="text-blue-700 text-sm space-y-1 list-disc list-inside">
                  <li><strong>Android:</strong> Abra no Google Chrome</li>
                  <li><strong>iPhone/iPad:</strong> Abra no Safari</li>
                  <li><strong>Desktop:</strong> Use Chrome ou Edge</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Push Notification Setup */}
        <PushNotificationSetup 
          patientId={null} 
          clinicId={null} 
          allowAnonymous={true}
        />

        {/* Benefícios */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Vantagens do App
          </h2>
          
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-card">
              <CardContent className="py-4 flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium">Acesso Rápido</p>
                <p className="text-xs text-muted-foreground">Direto da tela inicial</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card">
              <CardContent className="py-4 flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wifi className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium">Offline</p>
                <p className="text-xs text-muted-foreground">Funciona sem internet</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card">
              <CardContent className="py-4 flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium">Mais Rápido</p>
                <p className="text-xs text-muted-foreground">Carrega instantâneo</p>
              </CardContent>
            </Card>
            
            <Card className="bg-card">
              <CardContent className="py-4 flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium">Seguro</p>
                <p className="text-xs text-muted-foreground">Conexão protegida</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Botão voltar */}
        <Button asChild variant="outline" className="w-full" size="lg">
          <Link to="/app">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao App
          </Link>
        </Button>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pt-2 pb-4">
          © {new Date().getFullYear()} {clinicName} • Tecmax Tecnologia
        </p>
      </main>
    </div>
  );
}
