import { useEffect, useState, ReactNode } from "react";
import { useTheme } from "next-themes";
import { Outlet, useLocation } from "react-router-dom";
import { usePWAInstallTracking } from "@/hooks/usePWAInstallTracking";
import { MobileSplashScreen } from "./MobileSplashScreen";

interface MobileAppLayoutProps {
  children?: ReactNode;
}

/**
 * Layout wrapper que força o modo claro para todas as rotas do app mobile,
 * independente da preferência do usuário no painel administrativo.
 * Também exibe splash screen na primeira abertura do app.
 */
export function MobileAppLayout({ children }: MobileAppLayoutProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const location = useLocation();
  const [showSplash, setShowSplash] = useState(() => {
    // Verificar se deve mostrar splash na inicialização
    // Funciona tanto no modo navegador quanto no PWA standalone
    const splashShown = sessionStorage.getItem("splash_shown");
    if (splashShown) return false;
    
    // Detectar modo PWA standalone
    const isStandalone = 
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    
    // Verificar se está em rota mobile
    const isMobileRoute = location.pathname.startsWith("/app");
    
    // Mostrar splash se: não foi mostrado ainda E (é PWA standalone OU está na raiz /app)
    const isAppRoot = location.pathname === "/app" || location.pathname === "/app/";
    return isMobileRoute && (isStandalone || isAppRoot);
  });
  
  // Rastrear instalação do PWA
  usePWAInstallTracking();

  const handleSplashComplete = () => {
    sessionStorage.setItem("splash_shown", "true");
    setShowSplash(false);
  };

  useEffect(() => {
    // Salva o tema atual para restaurar depois (se necessário)
    const savedTheme = localStorage.getItem("eclini-theme-backup");
    if (!savedTheme && resolvedTheme) {
      localStorage.setItem("eclini-theme-backup", resolvedTheme);
    }

    // Força modo claro no mobile app
    if (resolvedTheme !== "light") {
      setTheme("light");
    }

    // Cleanup: não restaura automaticamente para não conflitar com preferência do usuário
  }, [resolvedTheme, setTheme]);

  return (
    <>
      {showSplash && <MobileSplashScreen onComplete={handleSplashComplete} />}
      {children ? <>{children}</> : <Outlet />}
    </>
  );
}
