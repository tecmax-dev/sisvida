import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Share, Plus, MoreVertical, Home, ArrowLeft, Download, CheckCircle2, RefreshCw, Monitor } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Detectar se é desktop
    setIsDesktop(window.innerWidth >= 1024);
    // Verificar se já está instalado como PWA
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

    // Verificar se foi instalado
    const installedHandler = () => {
      setIsInstalled(true);
      setCanInstall(false);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setCanInstall(false);
      }
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Erro ao instalar PWA:', error);
    }
  };

  const handleForceUpdate = async () => {
    setIsUpdating(true);
    toast.info('Atualizando aplicativo...');
    
    try {
      // Limpar todos os caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('Caches limpos:', cacheNames);
      }
      
      // Desregistrar Service Workers antigos
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
        console.log('Service Workers desregistrados');
      }
      
      toast.success('Cache limpo! Recarregando...');
      
      // Pequeno delay para mostrar o toast
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      toast.error('Erro ao atualizar. Tente recarregar a página manualmente.');
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>

        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Instale o Eclini
          </h1>
          <p className="text-muted-foreground">
            Tenha acesso rápido ao sistema diretamente da sua tela inicial
          </p>
        </div>

        <div className="space-y-6">
          {/* Botão de Instalação Programática */}
          {isInstalled ? (
            <Card className="bg-green-500/10 border-green-500/30">
              <CardContent className="flex items-center justify-center gap-3 py-6">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <span className="text-lg font-medium text-green-700">App instalado com sucesso!</span>
              </CardContent>
            </Card>
          ) : canInstall ? (
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="py-6">
                <div className="text-center space-y-4">
                  <p className="text-foreground font-medium">
                    Instale o Eclini diretamente no seu dispositivo
                  </p>
                  <Button onClick={handleInstall} size="lg" className="gap-2">
                    <Download className="h-5 w-5" />
                    Instalar Agora
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-muted/50 border-muted">
              <CardContent className="py-6">
                <p className="text-center text-muted-foreground text-sm">
                  O botão de instalação rápida aparecerá automaticamente quando disponível.
                  <br />
                  Enquanto isso, siga as instruções abaixo para o seu dispositivo.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Android Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <span className="text-green-600 font-bold text-sm">A</span>
                </div>
                Android (Chrome)
              </CardTitle>
              <CardDescription>
                Siga os passos abaixo para instalar no seu dispositivo Android
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">1</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Abra o menu do navegador</p>
                  <p className="text-sm text-muted-foreground">
                    Toque nos três pontos <MoreVertical className="inline h-4 w-4" /> no canto superior direito
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">2</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Selecione "Adicionar à tela inicial"</p>
                  <p className="text-sm text-muted-foreground">
                    Ou "Instalar aplicativo" se disponível
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">3</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Confirme a instalação</p>
                  <p className="text-sm text-muted-foreground">
                    O ícone do Eclini aparecerá na sua tela inicial
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Desktop Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Monitor className="h-4 w-4 text-blue-600" />
                </div>
                Desktop (Chrome/Edge)
              </CardTitle>
              <CardDescription>
                Siga os passos abaixo para instalar no seu computador
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">1</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Procure o ícone de instalação</p>
                  <p className="text-sm text-muted-foreground">
                    Na barra de endereços, procure por um ícone de <Download className="inline h-4 w-4" /> ou ícone de computador
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">2</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Se não aparecer, use o menu</p>
                  <p className="text-sm text-muted-foreground">
                    Clique nos três pontos <MoreVertical className="inline h-4 w-4" /> → "Instalar Eclini" ou "Mais ferramentas" → "Criar atalho"
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">3</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Marque "Abrir como janela"</p>
                  <p className="text-sm text-muted-foreground">
                    Isso faz o app abrir em sua própria janela, como um app nativo
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* iOS Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center">
                  <span className="text-gray-600 font-bold text-sm">🍎</span>
                </div>
                iPhone / iPad (Safari)
              </CardTitle>
              <CardDescription>
                Siga os passos abaixo para instalar no seu dispositivo iOS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">1</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Abra no Safari</p>
                  <p className="text-sm text-muted-foreground">
                    A instalação funciona apenas no navegador Safari
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">2</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Toque no botão Compartilhar</p>
                  <p className="text-sm text-muted-foreground">
                    O ícone <Share className="inline h-4 w-4" /> na barra inferior do Safari
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">3</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Selecione "Adicionar à Tela de Início"</p>
                  <p className="text-sm text-muted-foreground">
                    Role para baixo se necessário para encontrar a opção <Plus className="inline h-4 w-4" />
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">4</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Confirme tocando em "Adicionar"</p>
                  <p className="text-sm text-muted-foreground">
                    O ícone do Eclini aparecerá na sua tela inicial
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Benefits */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Home className="h-5 w-5" />
                Benefícios do App
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Acesso rápido pela tela inicial
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Experiência em tela cheia, sem barra do navegador
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Carregamento mais rápido com cache offline
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Funciona como um aplicativo nativo
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Botão de Atualização */}
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <RefreshCw className="h-5 w-5" />
                Atualizar Aplicativo
              </CardTitle>
              <CardDescription>
                Limpe o cache e force o download da versão mais recente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleForceUpdate} 
                variant="outline" 
                className="w-full gap-2 border-orange-500/50 text-orange-600 hover:bg-orange-500/10"
                disabled={isUpdating}
              >
                <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
                {isUpdating ? 'Atualizando...' : 'Forçar Atualização'}
              </Button>
            </CardContent>
          </Card>

          <div className="text-center">
            <Button asChild size="lg">
              <Link to="/auth">
                Acessar o Sistema
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
