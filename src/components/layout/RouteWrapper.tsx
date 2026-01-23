import { ReactNode } from "react";
import { GlobalBackButton } from "./GlobalBackButton";

interface RouteWrapperProps {
  children: ReactNode;
  showBackButton?: boolean;
}

/**
 * Wrapper para rotas que adiciona o botão voltar global
 * Use showBackButton={false} para desabilitar em rotas específicas
 */
export function RouteWrapper({ children, showBackButton = true }: RouteWrapperProps) {
  return (
    <>
      {showBackButton && <GlobalBackButton />}
      {children}
    </>
  );
}
