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

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

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
        .eq("id", TARGET_CLINIC_ID)
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
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
      
      toast.success('Cache limpo! Recarregando...');
      
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
        {/* Status de instalação */}
        {isInstalled ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex items-center gap-4 py-5">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-800">App Instalado!</p>
                <p className="text-sm text-green-600">Acesse pela sua tela inicial</p>
              </div>
            </CardContent>
          </Card>
        ) : canInstall ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Pronto para instalar!</p>
                  <p className="text-sm text-muted-foreground">Clique no botão abaixo</p>
                </div>
              </div>
              <Button onClick={handleInstall} size="lg" className="w-full gap-2">
                <Download className="h-5 w-5" />
                Instalar Agora
              </Button>
            </CardContent>
          </Card>
        ) : null}

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
