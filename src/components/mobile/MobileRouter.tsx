/**
 * ROUTER MOBILE COM BOOTSTRAP IMPERATIVO
 * 
 * Este componente renderiza as rotas mobile APENAS após
 * o bootstrap imperativo ter decidido a rota inicial.
 * 
 * NÃO usa useState/useEffect para decidir autenticação.
 * A decisão já foi feita ANTES do React renderizar.
 */

import { Suspense, lazy, useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { MobileAuthProvider } from "@/contexts/MobileAuthContext";
import { MobileAppLayout } from "@/components/mobile/MobileAppLayout";
import { mobileBootstrap, getBootstrapResult, BootstrapResult } from "@/mobileBootstrap";
import { Loader2 } from "lucide-react";

// Lazy load mobile pages
const MobileWelcomePage = lazy(() => import("@/pages/mobile/MobileWelcomePage"));
const MobileAuthPage = lazy(() => import("@/pages/mobile/MobileAuthPage"));
const MobileHomePage = lazy(() => import("@/pages/mobile/MobileHomePage"));
const MobilePublicHomePage = lazy(() => import("@/pages/mobile/MobilePublicHomePage"));
const MobileAppointmentsPage = lazy(() => import("@/pages/mobile/MobileAppointmentsPage"));
const MobileProfilePage = lazy(() => import("@/pages/mobile/MobileProfilePage"));
const MobileBookingPage = lazy(() => import("@/pages/mobile/MobileBookingPage"));
const MobilePasswordResetPage = lazy(() => import("@/pages/mobile/MobilePasswordResetPage"));
const MobileDependentsPage = lazy(() => import("@/pages/mobile/MobileDependentsPage"));
const MobileChangePasswordPage = lazy(() => import("@/pages/mobile/MobileChangePasswordPage"));
const MobileCardPage = lazy(() => import("@/pages/mobile/MobileCardPage"));
const MobileServicesPage = lazy(() => import("@/pages/mobile/MobileServicesPage"));
const MobileCommunicationPage = lazy(() => import("@/pages/mobile/MobileCommunicationPage"));
const MobileHelpPage = lazy(() => import("@/pages/mobile/MobileHelpPage"));
const MobileFirstAccessPage = lazy(() => import("@/pages/mobile/MobileFirstAccessPage"));
const MobileFAQPage = lazy(() => import("@/pages/mobile/MobileFAQPage"));
const MobileAboutPage = lazy(() => import("@/pages/mobile/MobileAboutPage"));
const MobileFiliacaoPage = lazy(() => import("@/pages/mobile/MobileFiliacaoPage"));
const MobileLegalBookingPage = lazy(() => import("@/pages/mobile/MobileLegalBookingPage"));
const MobileLegalAppointmentsPage = lazy(() => import("@/pages/mobile/MobileLegalAppointmentsPage"));
const MobileAuthorizationsPage = lazy(() => import("@/pages/mobile/MobileAuthorizationsPage"));
const MobileCardRenewalPage = lazy(() => import("@/pages/mobile/MobileCardRenewalPage"));
const MobileInstallPage = lazy(() => import("@/pages/mobile/MobileInstallPage"));

// Loading mínimo durante bootstrap (exibe por menos de 3 segundos garantido)
function BootstrapLoading() {
  return (
    <div className="min-h-screen bg-emerald-600 flex flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-white" />
    </div>
  );
}

/**
 * Componente que aplica a rota inicial do bootstrap
 */
function MobileRouterContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [bootstrapData, setBootstrapData] = useState<BootstrapResult | null>(null);

  useEffect(() => {
    // Verificar se já temos resultado do bootstrap
    const cached = getBootstrapResult();
    if (cached) {
      console.log("[MobileRouter] Usando bootstrap em cache:", cached.initialRoute);
      setBootstrapData(cached);
      setReady(true);
      return;
    }
    
    // Executar bootstrap se necessário
    mobileBootstrap().then((result) => {
      console.log("[MobileRouter] Bootstrap completo:", result.initialRoute);
      setBootstrapData(result);
      setReady(true);
      
      // Se estamos na raiz /app, navegar para a rota inicial
      if (location.pathname === "/app" || location.pathname === "/app/") {
        navigate(result.initialRoute, { replace: true });
      }
    });
  }, []);

  // Aguardar bootstrap completar
  if (!ready || !bootstrapData) {
    return <BootstrapLoading />;
  }

  return (
    <Suspense fallback={<BootstrapLoading />}>
      <Routes>
        {/* Rota index redireciona baseado no bootstrap */}
        <Route 
          index 
          element={<Navigate to={bootstrapData.initialRoute} replace />} 
        />
        
        {/* Rotas públicas (não requerem autenticação) */}
        <Route path="welcome" element={<MobileWelcomePage />} />
        <Route path="login" element={<MobileAuthPage />} />
        <Route path="recuperar-senha" element={<MobilePasswordResetPage />} />
        <Route path="primeiro-acesso" element={<MobileFirstAccessPage />} />
        <Route path="home-publico" element={<MobilePublicHomePage />} />
        <Route path="instalar" element={<MobileInstallPage />} />
        <Route path="faq" element={<MobileFAQPage />} />
        <Route path="sobre" element={<MobileAboutPage />} />
        <Route path="filiacao" element={<MobileFiliacaoPage />} />
        
        {/* Rotas autenticadas */}
        <Route path="home" element={<MobileHomePage />} />
        <Route path="agendamentos" element={<MobileAppointmentsPage />} />
        <Route path="agendamentos-juridicos" element={<MobileLegalAppointmentsPage />} />
        <Route path="agendar" element={<MobileBookingPage />} />
        <Route path="perfil" element={<MobileProfilePage />} />
        <Route path="dependentes" element={<MobileDependentsPage />} />
        <Route path="alterar-senha" element={<MobileChangePasswordPage />} />
        <Route path="carteirinha" element={<MobileCardPage />} />
        <Route path="servicos" element={<MobileServicesPage />} />
        <Route path="servicos/:serviceId" element={<MobileServicesPage />} />
        <Route path="comunicacao" element={<MobileCommunicationPage />} />
        <Route path="comunicacao/:mediaType" element={<MobileCommunicationPage />} />
        <Route path="ajuda" element={<MobileHelpPage />} />
        <Route path="agendar-juridico" element={<MobileLegalBookingPage />} />
        <Route path="autorizacoes" element={<MobileAuthorizationsPage />} />
        <Route path="atualizar-carteirinha" element={<MobileCardRenewalPage />} />
        <Route path="servicos/autorizacoes" element={<MobileAuthorizationsPage />} />
        <Route path="servicos/declaracoes" element={<MobileAuthorizationsPage />} />
        
        {/* Aliases e redirects */}
        <Route path="splash" element={<Navigate to={bootstrapData.initialRoute} replace />} />
        <Route path="agendamento-juridico" element={<Navigate to="/app/agendar-juridico" replace />} />
      </Routes>
    </Suspense>
  );
}

/**
 * Router principal do app mobile
 * Envolve as rotas com providers necessários
 */
export function MobileRouter() {
  return (
    <MobileAuthProvider>
      <MobileAppLayout>
        <MobileRouterContent />
      </MobileAppLayout>
    </MobileAuthProvider>
  );
}
