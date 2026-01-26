import { useEffect, ReactNode } from "react";
import { useTheme } from "next-themes";
import { Outlet } from "react-router-dom";
import { usePWAInstallTracking } from "@/hooks/usePWAInstallTracking";

interface MobileAppLayoutProps {
  children?: ReactNode;
}

/**
 * Layout wrapper que força o modo claro para todas as rotas do app mobile,
 * independente da preferência do usuário no painel administrativo
 */
export function MobileAppLayout({ children }: MobileAppLayoutProps) {
  const { setTheme, resolvedTheme } = useTheme();
  
  // Rastrear instalação do PWA
  usePWAInstallTracking();

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

  // Se children foi passado, renderiza children; senão usa Outlet para nested routes
  return children ? <>{children}</> : <Outlet />;
}
