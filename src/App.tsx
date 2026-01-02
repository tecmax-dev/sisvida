import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ModalProvider } from "@/contexts/ModalContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoadingFallback } from "@/components/ui/loading-fallback";
import { Button } from "./components/ui/button";
import { RedirectDoubleDashboard } from "@/components/routing/RedirectDoubleDashboard";

// Layouts (carregamento imediato - necessários para estrutura)
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { AdminLayout } from "./components/admin/AdminLayout";
import DocsLayout from "./pages/docs/DocsLayout";

// Landing page (carregamento imediato - primeira página)
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Documentation pages
import AjudaIndex from "./pages/docs/AjudaIndex";
import CategoryPage from "./pages/docs/CategoryPage";
import PrimeirosPassosArticle from "./pages/docs/articles/PrimeirosPassos";
import AgendaArticle from "./pages/docs/articles/AgendaArticles";
import PacientesArticle from "./pages/docs/articles/PacientesArticles";
import FinanceiroArticle from "./pages/docs/articles/FinanceiroArticles";
import AtendimentoArticle from "./pages/docs/articles/AtendimentoArticles";
import WhatsAppArticle from "./pages/docs/articles/WhatsAppArticles";
import ConfiguracoesArticle from "./pages/docs/articles/ConfiguracoesArticles";
import GenericArticle from "./pages/docs/articles/GenericArticle";

// Páginas com lazy loading - Auth & Setup
const Auth = lazy(() => import("./pages/Auth"));
const ProfessionalAuth = lazy(() => import("./pages/ProfessionalAuth"));
const ClinicSetup = lazy(() => import("./pages/ClinicSetup"));
const InstallPage = lazy(() => import("./pages/InstallPage"));

// Páginas públicas
const PublicBooking = lazy(() => import("./pages/PublicBooking"));
const PublicAnamnesis = lazy(() => import("./pages/PublicAnamnesis"));
const AppointmentConfirmation = lazy(() => import("./pages/AppointmentConfirmation"));
const PublicSignup = lazy(() => import("./pages/PublicSignup"));
const ProfessionalProfile = lazy(() => import("./pages/ProfessionalProfile"));
const TelemedicinePatient = lazy(() => import("./pages/TelemedicinePatient"));
const ConfirmEmail = lazy(() => import("./pages/ConfirmEmail"));
const AwaitingConfirmation = lazy(() => import("./pages/AwaitingConfirmation"));
const PublicPanel = lazy(() => import("./pages/PublicPanel"));
const PublicTotem = lazy(() => import("./pages/PublicTotem"));
const CardValidation = lazy(() => import("./pages/CardValidation"));

// Portal do Profissional
const ProfessionalDashboard = lazy(() => import("./pages/ProfessionalDashboard"));
const ProfessionalAppointment = lazy(() => import("./pages/ProfessionalAppointment"));

// Dashboard pages - carregamento imediato para evitar flicker
import DashboardOverview from "./pages/dashboard/DashboardOverview";
import CalendarPage from "./pages/dashboard/CalendarPage";
import PatientsPage from "./pages/dashboard/PatientsPage";
import PatientEditPage from "./pages/dashboard/PatientEditPage";
import ProfessionalsPage from "./pages/dashboard/ProfessionalsPage";
import ProfessionalEditPage from "./pages/dashboard/ProfessionalEditPage";
import AppointmentEditPage from "./pages/dashboard/AppointmentEditPage";
import InsurancePage from "./pages/dashboard/InsurancePage";
import MedicalRecordsPage from "./pages/dashboard/MedicalRecordsPage";
import AnamnesisPage from "./pages/dashboard/AnamnesisPage";
import AnamneseTemplatesPage from "./pages/dashboard/AnamneseTemplatesPage";
import DynamicAnamnesisPage from "./pages/dashboard/DynamicAnamnesisPage";
import WaitingListPage from "./pages/dashboard/WaitingListPage";
import ReportsPage from "./pages/dashboard/ReportsPage";
import SubscriptionPage from "./pages/dashboard/SubscriptionPage";
import PrescriptionPage from "./pages/dashboard/PrescriptionPage";
import FinancialsPage from "./pages/dashboard/FinancialsPage";
import ProceduresPage from "./pages/dashboard/ProceduresPage";
import ProcedureEditPage from "./pages/dashboard/ProcedureEditPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import UsersManagementPage from "./pages/dashboard/UsersManagementPage";
import PackagesPage from "./pages/dashboard/PackagesPage";
import PatientAttachmentsPage from "./pages/dashboard/PatientAttachmentsPage";
import StockPage from "./pages/dashboard/StockPage";
import CatalogPage from "./pages/dashboard/CatalogPage";
import QuotesPage from "./pages/dashboard/QuotesPage";
import RepassPage from "./pages/dashboard/RepassPage";
import QueueManagementPage from "./pages/dashboard/QueueManagementPage";
import MarketingPage from "./pages/dashboard/MarketingPage";
import TissPage from "./pages/dashboard/TissPage";
import HolidaysPage from "./pages/dashboard/HolidaysPage";
import PanelBannersPage from "./pages/dashboard/PanelBannersPage";
import DependentsPage from "./pages/dashboard/DependentsPage";
import AttendancePage from "./pages/dashboard/AttendancePageRedesign";
import PatientOdontogramPage from "./pages/dashboard/PatientOdontogramPage";
import ExamsPage from "./pages/dashboard/ExamsPage";
import EmployersPage from "./pages/dashboard/EmployersPage";
// Admin pages - carregamento imediato
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
import ClinicsManagement from "./pages/admin/ClinicsManagement";
import UsersManagement from "./pages/admin/UsersManagement";
import PlansManagement from "./pages/admin/PlansManagement";
import FeaturesManagement from "./pages/admin/FeaturesManagement";
import AccessGroupsPage from "./pages/admin/AccessGroupsPage";
import UpgradeRequestsPage from "./pages/admin/UpgradeRequestsPage";
import AuditLogsPage from "./pages/admin/AuditLogsPage";
import DataImportPage from "./pages/admin/DataImportPage";
import SmtpSettingsPage from "./pages/admin/SmtpSettingsPage";
import NotificationsPage from "./pages/admin/NotificationsPage";
import ChatSupportPage from "./pages/admin/ChatSupportPage";
import HeroSettingsPage from "./pages/admin/HeroSettingsPage";
import CarouselBannersPage from "./pages/admin/CarouselBannersPage";
import GlobalConfigPage from "./pages/admin/GlobalConfigPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

// ErrorBoundary global para evitar páginas em branco
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Erro capturado:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const showDetails =
        import.meta.env.DEV ||
        (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug"));

      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8 max-w-md">
            <h1 className="text-2xl font-bold text-foreground mb-4">Algo deu errado</h1>
            <p className="text-muted-foreground mb-6">
              Ocorreu um erro inesperado. Por favor, recarregue a página.
            </p>

            {showDetails && this.state.error && (
              <details className="text-left mb-6 rounded-md border bg-card p-4">
                <summary className="cursor-pointer text-sm font-medium text-foreground">
                  Ver detalhes do erro
                </summary>
                <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
{this.state.error?.stack || this.state.error?.message}
                </pre>
              </details>
            )}

            <div className="flex items-center justify-center gap-3">
              <Button onClick={() => window.location.reload()}>Recarregar página</Button>
              {showDetails && (
                <Button
                  variant="outline"
                  onClick={() => {
                    this.setState({ hasError: false, error: null });
                  }}
                >
                  Tentar novamente
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ModalProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/instalar" element={<InstallPage />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/cadastro" element={<PublicSignup />} />
                <Route path="/aguardando-confirmacao" element={<AwaitingConfirmation />} />
                {/* Documentation / Help Center */}
                <Route path="/ajuda" element={<DocsLayout />}>
                  <Route index element={<AjudaIndex />} />
                  <Route path="primeiros-passos" element={<CategoryPage />} />
                  <Route path="primeiros-passos/:articleSlug" element={<PrimeirosPassosArticle />} />
                  <Route path="agenda" element={<CategoryPage />} />
                  <Route path="agenda/:articleSlug" element={<AgendaArticle />} />
                  <Route path="pacientes" element={<CategoryPage />} />
                  <Route path="pacientes/:articleSlug" element={<PacientesArticle />} />
                  <Route path="financeiro" element={<CategoryPage />} />
                  <Route path="financeiro/:articleSlug" element={<FinanceiroArticle />} />
                  <Route path="atendimento" element={<CategoryPage />} />
                  <Route path="atendimento/:articleSlug" element={<AtendimentoArticle />} />
                  <Route path="whatsapp" element={<CategoryPage />} />
                  <Route path="whatsapp/:articleSlug" element={<WhatsAppArticle />} />
                  <Route path="configuracoes" element={<CategoryPage />} />
                  <Route path="configuracoes/:articleSlug" element={<ConfiguracoesArticle />} />
                  <Route path=":categoryId" element={<CategoryPage />} />
                  <Route path=":categoryId/:articleSlug" element={<GenericArticle />} />
                </Route>
                <Route path="/confirm-email" element={<ConfirmEmail />} />
                {/* Compat: corrige URLs duplicadas /dashboard/dashboard/... */}
                <Route path="/dashboard/dashboard/*" element={<RedirectDoubleDashboard />} />
                {/* Public booking (both legacy and current URLs) */}
                <Route path="/agendar/:clinicSlug" element={<PublicBooking />} />
                <Route path="/booking/:clinicSlug" element={<PublicBooking />} />
                {/* Professional public profile */}
                <Route path="/profissional/:clinicSlug/:professionalSlug" element={<ProfessionalProfile />} />
                {/* Public anamnesis form via token */}
                <Route path="/anamnese/:token" element={<PublicAnamnesis />} />
                {/* Appointment confirmation via token */}
                <Route path="/consulta/:token" element={<AppointmentConfirmation />} />
                {/* Telemedicine patient room */}
                <Route path="/telemedicina/:token" element={<TelemedicinePatient />} />
                {/* Professional Portal */}
                <Route path="/profissional" element={<ProfessionalAuth />} />
                <Route path="/profissional/painel" element={<ProfessionalDashboard />} />
                <Route path="/profissional/atendimento/:appointmentId" element={<ProfessionalAppointment />} />
                {/* Public Panel and Totem routes */}
                <Route path="/panel/:token" element={<PublicPanel />} />
                <Route path="/totem/:token" element={<PublicTotem />} />
                <Route path="/card/:token" element={<CardValidation />} />
                <Route
                  path="/clinic-setup"
                  element={
                    <ProtectedRoute>
                      <ClinicSetup />
                    </ProtectedRoute>
                  }
                />
                {/* Admin Routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireSuperAdmin>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<SuperAdminDashboard />} />
                  <Route path="clinics" element={<ClinicsManagement />} />
                  <Route path="users" element={<UsersManagement />} />
                  <Route path="plans" element={<PlansManagement />} />
                  <Route path="features" element={<FeaturesManagement />} />
                  <Route path="access-groups" element={<AccessGroupsPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="upgrades" element={<UpgradeRequestsPage />} />
                  <Route path="import" element={<DataImportPage />} />
                  <Route path="smtp" element={<SmtpSettingsPage />} />
                  <Route path="audit" element={<AuditLogsPage />} />
                  <Route path="chat" element={<ChatSupportPage />} />
                  <Route path="hero" element={<HeroSettingsPage />} />
                  <Route path="banners" element={<CarouselBannersPage />} />
                  <Route path="config" element={<GlobalConfigPage />} />
                </Route>
                {/* Dashboard Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardOverview />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="patients" element={<PatientsPage />} />
                  <Route path="patients/:id" element={<PatientEditPage />} />
                  <Route path="patients/:id/edit" element={<PatientEditPage />} />
                  <Route path="patients/:id/attachments" element={<PatientAttachmentsPage />} />
                  <Route path="patients/:id/odontograma" element={<PatientOdontogramPage />} />
                  <Route path="professionals" element={<ProfessionalsPage />} />
                  <Route path="professionals/new" element={<ProfessionalEditPage />} />
                  <Route path="professionals/:id/edit" element={<ProfessionalEditPage />} />
                  <Route path="appointments/:id/edit" element={<AppointmentEditPage />} />
                  <Route path="insurance" element={<InsurancePage />} />
                  <Route path="medical-records" element={<MedicalRecordsPage />} />
                  <Route path="anamnesis" element={<AnamnesisPage />} />
                  <Route path="anamnesis-templates" element={<AnamneseTemplatesPage />} />
                  <Route path="anamnesis-dynamic" element={<DynamicAnamnesisPage />} />
                  <Route path="waiting-list" element={<WaitingListPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="subscription" element={<SubscriptionPage />} />
                  <Route path="prescriptions" element={<PrescriptionPage />} />
                  <Route path="financials" element={<FinancialsPage />} />
                  <Route path="procedures" element={<ProceduresPage />} />
                  <Route path="procedures/new" element={<ProcedureEditPage />} />
                  <Route path="procedures/:id/edit" element={<ProcedureEditPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="users" element={<UsersManagementPage />} />
                  <Route path="packages" element={<PackagesPage />} />
                  <Route path="stock" element={<StockPage />} />
                  <Route path="catalog" element={<CatalogPage />} />
                  <Route path="quotes" element={<QuotesPage />} />
                  <Route path="repass" element={<RepassPage />} />
                  <Route path="queue" element={<QueueManagementPage />} />
                  <Route path="panel-banners" element={<PanelBannersPage />} />
                  <Route path="marketing" element={<MarketingPage />} />
                  <Route path="tiss" element={<TissPage />} />
                  <Route path="holidays" element={<HolidaysPage />} />
                  <Route path="dependents" element={<DependentsPage />} />
                  <Route path="atendimento/:appointmentId" element={<AttendancePage />} />
                  <Route path="exams" element={<ExamsPage />} />
                  <Route path="empresas" element={<EmployersPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
        </ModalProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
