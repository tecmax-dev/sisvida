import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Smartphone, 
  Share, 
  Plus, 
  MoreVertical, 
  ArrowLeft, 
  Download, 
  CheckCircle2, 
  RefreshCw,
  AlertTriangle,
  Copy,
  Apple,
  Chrome,
  Zap,
  Shield,
  Wifi,
  Clock
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
  const [isAndroid, setIsAndroid] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("ios");

  // CRITICAL: Apply iOS PWA icon immediately on mount (before any async operations)
  // iOS captures the apple-touch-icon at the moment of "Add to Home Screen"
  // so we need to set it synchronously as early as possible
  useEffect(() => {
    // Immediately set the Sindicato icon for iOS PWA installation
    const sindicatoLogoUrl = "https://eahhszmbyxapxzilfdlo.supabase.co/storage/v1/object/public/clinic-assets/89e7585e-7bce-4e58-91fa-c37080d1170d/logo.png";
    
    // Update apple-touch-icon immediately (critical for iOS PWA icon)
    const updateAppleTouchIcon = (href: string) => {
      // Remove all existing apple-touch-icon links to prevent conflicts
      const existingIcons = document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]');
      existingIcons.forEach(icon => icon.remove());
      
      // Create new apple-touch-icon with highest priority
      const sizes = ['180x180', '152x152', '144x144', '120x120', '114x114', '76x76', '72x72', '60x60', '57x57'];
      sizes.forEach(size => {
        const link = document.createElement('link');
        link.rel = 'apple-touch-icon';
        link.setAttribute('sizes', size);
        link.href = href;
        document.head.insertBefore(link, document.head.firstChild);
      });
      
      // Also add one without sizes attribute (fallback)
      const fallbackLink = document.createElement('link');
      fallbackLink.rel = 'apple-touch-icon';
      fallbackLink.href = href;
      document.head.insertBefore(fallbackLink, document.head.firstChild);
      
      // Add precomposed version (prevents iOS from adding effects)
      const precomposedLink = document.createElement('link');
      precomposedLink.rel = 'apple-touch-icon-precomposed';
      precomposedLink.href = href;
      document.head.insertBefore(precomposedLink, document.head.firstChild);
    };
    
    // Apply immediately with known Sindicato logo
    updateAppleTouchIcon(sindicatoLogoUrl);
    
    // Also update regular favicon
    const faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (faviconLink) {
      faviconLink.href = sindicatoLogoUrl;
    }
    
    // Update document title for PWA name
    document.title = "Sindicato - Instalar App";
    
    // Update meta tags for iOS
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
    const isAndroidDevice = /Android/.test(ua);
    
    setIsIOS(isIOSDevice);
    setIsSafari(isSafariBrowser);
    setIsAndroid(isAndroidDevice);
    
    // Set default tab based on device
    if (isAndroidDevice) {
      setActiveTab("android");
    } else {
      setActiveTab("ios");
    }

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setIsInstalled(true);
      setCanInstall(false);
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

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setCanInstall(false);
        toast.success('App instalado com sucesso!');
      }
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Erro ao instalar PWA:', error);
      toast.error('Erro ao instalar. Tente as instruções manuais.');
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

  const handleCopyLink = () => {
    const url = window.location.origin + '/app';
    navigator.clipboard.writeText(url);
    toast.success('Link copiado! Cole no Safari para instalar.');
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
        {/* BOTÃO PRINCIPAL DE INSTALAÇÃO - SEMPRE VISÍVEL */}
        <Card className="border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg">
          <CardContent className="py-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-md">
                <Download className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="flex-1">
                {isInstalled ? (
                  <>
                    <p className="font-bold text-lg text-green-700">✓ App Instalado!</p>
                    <p className="text-sm text-muted-foreground">Acesse pela tela inicial do seu celular</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-lg text-foreground">Instalar Aplicativo</p>
                    <p className="text-sm text-muted-foreground">Acesso rápido na tela inicial</p>
                  </>
                )}
              </div>
            </div>
            
            {!isInstalled && (
              <div className="space-y-3">
                {/* Botão automático (quando disponível) */}
                {canInstall && (
                  <Button onClick={handleInstall} size="lg" className="w-full gap-2 h-12 text-base font-semibold">
                    <Download className="h-5 w-5" />
                    Instalar Agora
                  </Button>
                )}
                
                {/* Botão de copiar link - SEMPRE VISÍVEL */}
                <Button 
                  onClick={handleCopyLink} 
                  variant={canInstall ? "outline" : "default"}
                  size="lg" 
                  className={`w-full gap-2 h-12 text-base ${!canInstall ? 'font-semibold' : ''}`}
                >
                  <Copy className="h-5 w-5" />
                  {canInstall ? 'Copiar Link' : 'Copiar Link do App'}
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  {isIOS 
                    ? 'Cole no Safari e siga as instruções abaixo'
                    : 'Cole no Chrome e siga as instruções abaixo'
                  }
                </p>
              </div>
            )}
            
            {isInstalled && (
              <Button onClick={handleForceUpdate} variant="outline" size="lg" className="w-full gap-2" disabled={isUpdating}>
                <RefreshCw className={`h-5 w-5 ${isUpdating ? 'animate-spin' : ''}`} />
                {isUpdating ? 'Atualizando...' : 'Verificar Atualizações'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Push Notification Setup - disponível para usuários anônimos */}
        <PushNotificationSetup 
          patientId={null} 
          clinicId={null} 
          allowAnonymous={true}
        />

        {/* Aviso iOS fora do Safari */}
        {isIOS && !isSafari && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="py-5">
              <div className="flex gap-4">
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-amber-800">Use o Safari</p>
                    <p className="text-sm text-amber-700">
                      No iPhone e iPad, a instalação só funciona pelo navegador Safari.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-amber-400 text-amber-700 hover:bg-amber-100"
                    onClick={handleCopyLink}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Link
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instruções por plataforma */}
        {!isInstalled && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Como instalar
            </h2>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-12">
                <TabsTrigger 
                  value="ios" 
                  className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Apple className="h-4 w-4" />
                  iPhone / iPad
                </TabsTrigger>
                <TabsTrigger 
                  value="android" 
                  className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Chrome className="h-4 w-4" />
                  Android
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="ios" className="mt-4">
                <Card>
                  <CardContent className="py-6 space-y-6">
                    {isIOS && isSafari && (
                      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">Você está no Safari! Siga os passos:</span>
                      </div>
                    )}
                    
                    <StepItem 
                      number={1}
                      title="Abra no Safari"
                      description="Este é o navegador padrão da Apple, com ícone de bússola azul."
                      icon={Apple}
                    />
                    
                    <StepItem 
                      number={2}
                      title="Toque em Compartilhar"
                      description="Ícone de quadrado com seta para cima, na barra inferior."
                      icon={Share}
                    />
                    
                    <StepItem 
                      number={3}
                      title="Adicionar à Tela de Início"
                      description="Role as opções e encontre esta opção com ícone de +"
                      icon={Plus}
                    />
                    
                    <StepItem 
                      number={4}
                      title="Confirme em 'Adicionar'"
                      description="Pronto! O app aparecerá na sua tela inicial."
                      icon={CheckCircle2}
                    />

                    {isIOS && !isSafari && (
                      <Button 
                        variant="outline" 
                        className="w-full mt-4"
                        onClick={handleCopyLink}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar link para o Safari
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="android" className="mt-4">
                <Card>
                  <CardContent className="py-6 space-y-6">
                    {isAndroid && (
                      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">Você está no Android! Siga os passos:</span>
                      </div>
                    )}
                    
                    <StepItem 
                      number={1}
                      title="Abra no Chrome"
                      description="Use o navegador Google Chrome para melhor experiência."
                      icon={Chrome}
                    />
                    
                    <StepItem 
                      number={2}
                      title="Toque no menu"
                      description="Ícone de três pontos verticais no canto superior direito."
                      icon={MoreVertical}
                    />
                    
                    <StepItem 
                      number={3}
                      title="Adicionar à tela inicial"
                      description="Ou 'Instalar aplicativo' se aparecer esta opção."
                      icon={Plus}
                    />
                    
                    <StepItem 
                      number={4}
                      title="Confirme a instalação"
                      description="Pronto! O app aparecerá na sua tela inicial."
                      icon={CheckCircle2}
                    />

                    {canInstall && (
                      <Button onClick={handleInstall} className="w-full mt-4 gap-2">
                        <Download className="h-4 w-4" />
                        Instalar Automaticamente
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

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

        {/* Atualização forçada */}
        {isInstalled && (
          <Card className="border-muted">
            <CardContent className="py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Atualizar App</p>
                  <p className="text-sm text-muted-foreground">Força download da versão mais recente</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleForceUpdate}
                  disabled={isUpdating}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
                  {isUpdating ? 'Atualizando...' : 'Atualizar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
