import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Smartphone, 
  Share, 
  Plus, 
  MoreVertical, 
  Home, 
  ArrowLeft, 
  Download, 
  CheckCircle2, 
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Copy
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Target clinic for the mobile app
const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

export default function MobileInstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [clinicName, setClinicName] = useState("Sindicato");
  const [clinicLogo, setClinicLogo] = useState<string | null>(null);
  
  // Device detection
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isChrome, setIsChrome] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect device and browser
    const ua = navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isSafariBrowser = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);
    const isChromeBrowser = /Chrome/.test(ua) || /CriOS/.test(ua);
    const isAndroidDevice = /Android/.test(ua);
    
    setIsIOS(isIOSDevice);
    setIsSafari(isSafariBrowser);
    setIsChrome(isChromeBrowser);
    setIsAndroid(isAndroidDevice);

    // Check if already installed as PWA
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

    // Load clinic data
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

  const appUrl = window.location.origin + '/app';

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-6 pb-12">
        <Link to="/app" className="inline-flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        
        <div className="text-center">
          {clinicLogo ? (
            <img 
              src={clinicLogo} 
              alt={clinicName} 
              className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white p-2 object-contain"
            />
          ) : (
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/10 flex items-center justify-center">
              <Smartphone className="h-10 w-10" />
            </div>
          )}
          <h1 className="text-2xl font-bold mb-2">
            Instale o App
          </h1>
          <p className="text-primary-foreground/80 text-sm">
            {clinicName} - App do Associado
          </p>
        </div>
      </div>

      <div className="px-4 -mt-6 pb-8 space-y-4">
        {/* iOS Safari Warning */}
        {isIOS && !isSafari && (
          <Card className="bg-amber-50 border-amber-300">
            <CardContent className="py-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-amber-800">Abra no Safari</p>
                    <p className="text-sm text-amber-700">
                      No iPhone/iPad, a instalação de apps só funciona pelo <strong>Safari</strong>. 
                      O Chrome, Firefox e outros navegadores não permitem instalar apps no iOS.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full border-amber-400 text-amber-700 hover:bg-amber-100"
                      onClick={handleCopyLink}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar link para Safari
                    </Button>
                    <p className="text-xs text-amber-600 text-center">
                      Copie e cole o link no Safari
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Installation Status */}
        {isInstalled ? (
          <Card className="bg-green-50 border-green-300">
            <CardContent className="flex items-center justify-center gap-3 py-6">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <span className="text-lg font-medium text-green-700">App instalado!</span>
            </CardContent>
          </Card>
        ) : canInstall ? (
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="py-6">
              <div className="text-center space-y-4">
                <p className="text-foreground font-medium">
                  Pronto para instalar!
                </p>
                <Button onClick={handleInstall} size="lg" className="gap-2 w-full">
                  <Download className="h-5 w-5" />
                  Instalar Agora
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Android Instructions */}
        {(isAndroid || (!isIOS && !isInstalled)) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <span className="text-green-600 font-bold text-sm">A</span>
                </div>
                Android (Chrome)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-xs">1</span>
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Toque nos 3 pontos</p>
                  <p className="text-xs text-muted-foreground">
                    <MoreVertical className="inline h-3 w-3" /> no canto superior direito
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-xs">2</span>
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">"Adicionar à tela inicial"</p>
                  <p className="text-xs text-muted-foreground">
                    Ou "Instalar aplicativo"
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-xs">3</span>
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Confirme a instalação</p>
                  <p className="text-xs text-muted-foreground">
                    O app aparecerá na sua tela inicial
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* iOS Instructions */}
        {(isIOS || (!isAndroid && !isInstalled)) && (
          <Card className={isIOS && isSafari ? 'ring-2 ring-primary' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <span className="text-lg">🍎</span>
                </div>
                iPhone / iPad
                {isIOS && isSafari && (
                  <span className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                    Use agora
                  </span>
                )}
              </CardTitle>
              {isIOS && !isSafari && (
                <CardDescription className="text-amber-600 font-medium">
                  ⚠️ Abra esta página no Safari primeiro
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-xs">1</span>
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Abra no Safari</p>
                  <p className="text-xs text-muted-foreground">
                    Obrigatório - outros navegadores não funcionam
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-xs">2</span>
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Toque em Compartilhar</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Share className="h-3 w-3" /> na barra inferior do Safari
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-xs">3</span>
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">"Adicionar à Tela de Início"</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Role para baixo se necessário
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-xs">4</span>
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">Toque em "Adicionar"</p>
                  <p className="text-xs text-muted-foreground">
                    Pronto! O app estará na tela inicial
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Benefits */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-primary text-base">
              <Home className="h-4 w-4" />
              Por que instalar?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Acesso rápido pela tela inicial
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Funciona sem internet (offline)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Tela cheia, como app nativo
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Carregamento mais rápido
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Force Update */}
        {isInstalled && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-orange-700 text-base">
                <RefreshCw className="h-4 w-4" />
                Atualizar App
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleForceUpdate} 
                variant="outline" 
                className="w-full gap-2 border-orange-300 text-orange-700 hover:bg-orange-100"
                disabled={isUpdating}
              >
                <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
                {isUpdating ? 'Atualizando...' : 'Forçar Atualização'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Back to App */}
        <div className="pt-2">
          <Button asChild className="w-full" size="lg">
            <Link to="/app">
              Acessar o App
            </Link>
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pt-4">
          Desenvolvido por Tecmax Tecnologia
        </p>
      </div>
    </div>
  );
}
