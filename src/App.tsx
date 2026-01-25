import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ModalProvider } from "@/contexts/ModalContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoadingFallback } from "@/components/ui/loading-fallback";
import { Button } from "./components/ui/button";
import { RedirectDoubleDashboard } from "@/components/routing/RedirectDoubleDashboard";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { UnionBudgetLegacyRedirect } from "@/components/routing/UnionBudgetLegacyRedirect";
import { GlobalBackButton } from "@/components/layout/GlobalBackButton";

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
const PublicNPS = lazy(() => import("./pages/PublicNPS"));
const AppointmentConfirmation = lazy(() => import("./pages/AppointmentConfirmation"));
const PublicSignup = lazy(() => import("./pages/PublicSignup"));
const ProfessionalProfile = lazy(() => import("./pages/ProfessionalProfile"));
const TelemedicinePatient = lazy(() => import("./pages/TelemedicinePatient"));
const ConfirmEmail = lazy(() => import("./pages/ConfirmEmail"));
const AwaitingConfirmation = lazy(() => import("./pages/AwaitingConfirmation"));

// Landing Page - Sistema Sindical (página pública independente)
const SindicalLandingPage = lazy(() => import("./pages/SindicalLandingPage"));
const SindicalFiliacaoPage = lazy(() => import("./pages/SindicalFiliacaoPage"));
const PublicPanel = lazy(() => import("./pages/PublicPanel"));
const PublicTotem = lazy(() => import("./pages/PublicTotem"));
const CardValidation = lazy(() => import("./pages/CardValidation"));
const LgpdPolicy = lazy(() => import("./pages/LgpdPolicy"));
const EmployerPortal = lazy(() => import("./pages/EmployerPortal"));
const AccountingOfficePortal = lazy(() => import("./pages/AccountingOfficePortal"));
const HomologacaoPublicBooking = lazy(() => import("./pages/HomologacaoPublicBooking"));
const HomologacaoClinicBooking = lazy(() => import("./pages/HomologacaoClinicBooking"));
const HomologacaoProtocolValidation = lazy(() => import("./pages/HomologacaoProtocolValidation"));
const PublicContributionValue = lazy(() => import("./pages/PublicContributionValue"));
const PortalAccessPage = lazy(() => import("./pages/public/PortalAccessPage"));
const PresentationPage = lazy(() => import("./pages/public/PresentationPage"));
const ClinicPresentationPage = lazy(() => import("./pages/public/ClinicPresentationPage"));
const NegotiationPreviewPage = lazy(() => import("./pages/public/NegotiationPreviewPage"));
const ApresentacaoEcliniPage = lazy(() => import("./pages/ApresentacaoEcliniPage"));
const TutorialSindicatoPage = lazy(() => import("./pages/TutorialSindicatoPage"));
const MemberPortal = lazy(() => import("./pages/MemberPortal"));


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
import NewTransactionPage from "./pages/dashboard/NewTransactionPage";
import ProceduresPage from "./pages/dashboard/ProceduresPage";
import ProcedureEditPage from "./pages/dashboard/ProcedureEditPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import UsersManagementPage from "./pages/dashboard/UsersManagementPage";
import PackagesPage from "./pages/dashboard/PackagesPage";
import PatientAttachmentsPage from "./pages/dashboard/PatientAttachmentsPage";
import PatientPayslipHistoryPage from "./pages/dashboard/PatientPayslipHistoryPage";
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
import ExamResultsPage from "./pages/dashboard/ExamResultsPage";
import NPSDashboardPage from "./pages/dashboard/NPSDashboardPage";
import ProductivityReportPage from "./pages/dashboard/ProductivityReportPage";
import NoShowReportPage from "./pages/dashboard/NoShowReportPage";
import InactivePatientsPage from "./pages/dashboard/InactivePatientsPage";
import EmployersPage from "./pages/dashboard/EmployersPage";
import EmployerDetailPage from "./pages/dashboard/EmployerDetailPage";
import ContributionsPage from "./pages/dashboard/ContributionsPage";
import NegotiationsPage from "./pages/dashboard/NegotiationsPage";
import AccountingOfficesPage from "./pages/dashboard/AccountingOfficesPage";
import DependentApprovalsPage from "./pages/dashboard/DependentApprovalsPage";
// Homologação module pages (agora no Módulo Sindical)
import HomologacaoAgendaPage from "./pages/dashboard/homologacao/HomologacaoAgendaPage";
import HomologacaoProfissionaisPage from "./pages/dashboard/homologacao/HomologacaoProfissionaisPage";
import HomologacaoServicosPage from "./pages/dashboard/homologacao/HomologacaoServicosPage";
import HomologacaoBloqueiosPage from "./pages/dashboard/homologacao/HomologacaoBloqueiosPage";
import HomologacaoConfigPage from "./pages/dashboard/homologacao/HomologacaoConfigPage";
// Union Module pages
import { UnionModuleLayout } from "./components/union/UnionModuleLayout";
// Mobile App Layout (força modo claro)
import { MobileAppLayout } from "./components/mobile/MobileAppLayout";
import UnionDashboard from "./pages/union/UnionDashboard";
import UnionBudgetPage from "./pages/union/budget/UnionBudgetPage";
import UnionBudgetDetailPage from "./pages/union/budget/UnionBudgetDetailPage";
import UnionPlansPage from "./pages/union/UnionPlansPage";
import UnionEmployersPage from "./pages/union/UnionEmployersPage";
import UnionAccountingOfficesPage from "./pages/union/UnionAccountingOfficesPage";
import UnionMembersListPage from "./pages/union/UnionMembersListPage";
import UnionMemberDetailPage from "./pages/union/UnionMemberDetailPage";
import UnionContributionsPage from "./pages/union/UnionContributionsPage";
import UnionFinancialsPage from "./pages/union/UnionFinancialsPage";
import UnionExpensesPage from "./pages/union/UnionExpensesPage";
import UnionIncomePage from "./pages/union/UnionIncomePage";
import UnionCashFlowPage from "./pages/union/UnionCashFlowPage";
import UnionStatementPage from "./pages/union/UnionStatementPage";
import UnionReconciliationPage from "./pages/union/UnionReconciliationPage";
import UnionBankReconciliationPage from "./pages/union/UnionBankReconciliationPage";
import UnionCashRegistersPage from "./pages/union/UnionCashRegistersPage";
import UnionSuppliersPage from "./pages/union/UnionSuppliersPage";
import UnionNegotiationsPage from "./pages/union/UnionNegotiationsPage";
import UnionReportsPage from "./pages/union/UnionReportsPage";
import UnionLytexReportsPage from "./pages/union/UnionLytexReportsPage";
import UnionCategoriesPage from "./pages/union/UnionCategoriesPage";
import UnionChartOfAccountsPage from "./pages/union/UnionChartOfAccountsPage";
import UnionAssociadosPage from "./pages/union/UnionAssociadosPage";
import UnionPaymentHistoryPage from "./pages/union/UnionPaymentHistoryPage";
import UnionAppContentPage from "./pages/union/UnionAppContentPage";
import UnionFiliacoesPage from "./pages/union/UnionFiliacoesPage";
import UnionConfigPage from "./pages/union/UnionConfigPage";
import UnionBenefitsPage from "./pages/union/UnionBenefitsPage";
import UnionAuthorizationsPage from "./pages/union/UnionAuthorizationsPage";
import UnionPayslipApprovalsPage from "./pages/union/UnionPayslipApprovalsPage";
// Legal Module pages
import UnionLegalDashboardPage from "./pages/union/legal/UnionLegalDashboardPage";
import UnionLegalCasesPage from "./pages/union/legal/UnionLegalCasesPage";
import UnionLegalCaseFormPage from "./pages/union/legal/UnionLegalCaseFormPage";
import UnionLawyersPage from "./pages/union/legal/UnionLawyersPage";
import UnionLawFirmsPage from "./pages/union/legal/UnionLawFirmsPage";
import UnionLegalDeadlinesPage from "./pages/union/legal/UnionLegalDeadlinesPage";
import UnionLegalDeadlineFormPage from "./pages/union/legal/UnionLegalDeadlineFormPage";
import UnionLegalExpensesPage from "./pages/union/legal/UnionLegalExpensesPage";
const AuthorizationValidationPage = lazy(() => import("./pages/AuthorizationValidationPage"));
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
import AddonRequestsPage from "./pages/admin/AddonRequestsPage";
import AddonsManagementPage from "./pages/admin/AddonsManagementPage";
import PendingDependentApprovals from "./pages/admin/PendingDependentApprovals";
import UnionEntitiesPage from "./pages/admin/UnionEntitiesPage";

// Login exclusivo para entidades sindicais
const UnionEntityLoginPage = lazy(() => import("./pages/UnionEntityLoginPage"));

// Mobile App Pages
const MobileWelcomePage = lazy(() => import("./pages/mobile/MobileWelcomePage"));
const MobileAuthPage = lazy(() => import("./pages/mobile/MobileAuthPage"));
const MobileHomePage = lazy(() => import("./pages/mobile/MobileHomePage"));
const MobilePublicHomePage = lazy(() => import("./pages/mobile/MobilePublicHomePage"));
const MobileAppointmentsPage = lazy(() => import("./pages/mobile/MobileAppointmentsPage"));
const MobileProfilePage = lazy(() => import("./pages/mobile/MobileProfilePage"));
const MobileBookingPage = lazy(() => import("./pages/mobile/MobileBookingPage"));
const MobilePasswordResetPage = lazy(() => import("./pages/mobile/MobilePasswordResetPage"));
const MobileDependentsPage = lazy(() => import("./pages/mobile/MobileDependentsPage"));
const MobileChangePasswordPage = lazy(() => import("./pages/mobile/MobileChangePasswordPage"));
const MobileCardPage = lazy(() => import("./pages/mobile/MobileCardPage"));
const MobileServicesPage = lazy(() => import("./pages/mobile/MobileServicesPage"));
const MobileCommunicationPage = lazy(() => import("./pages/mobile/MobileCommunicationPage"));
const MobileHelpPage = lazy(() => import("./pages/mobile/MobileHelpPage"));
const MobileFirstAccessPage = lazy(() => import("./pages/mobile/MobileFirstAccessPage"));
const MobileFAQPage = lazy(() => import("./pages/mobile/MobileFAQPage"));
const MobileAboutPage = lazy(() => import("./pages/mobile/MobileAboutPage"));
const MobileFiliacaoPage = lazy(() => import("./pages/mobile/MobileFiliacaoPage"));
const MobileLegalBookingPage = lazy(() => import("./pages/mobile/MobileLegalBookingPage"));
const MobileLegalAppointmentsPage = lazy(() => import("./pages/mobile/MobileLegalAppointmentsPage"));
const MobileAuthorizationsPage = lazy(() => import("./pages/mobile/MobileAuthorizationsPage"));
const MobileCardRenewalPage = lazy(() => import("./pages/mobile/MobileCardRenewalPage"));
const MobileInstallPage = lazy(() => import("./pages/mobile/MobileInstallPage"));
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
    <ThemeProvider defaultTheme="system" storageKey="eclini-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ModalProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <GlobalBackButton />
                <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                {/* Aliases para evitar 404 por URLs antigas/alternativas */}
                <Route path="/agendar-juridico" element={<Navigate to="/app/agendar-juridico" replace />} />
                <Route path="/agendamento-juridico" element={<Navigate to="/app/agendar-juridico" replace />} />
                <Route path="/sindical" element={<SindicalLandingPage />} />
                <Route path="/sistema-sindical" element={<SindicalLandingPage />} />
                <Route path="/sindical/filiacao/:sindicatoSlug" element={<SindicalFiliacaoPage />} />
                <Route path="/sindicato/seja-socio/:sindicatoSlug" element={<SindicalFiliacaoPage />} />
                <Route path="/sindicato/instalar" element={<MobileInstallPage />} />
                <Route path="/entidade-sindical" element={<UnionEntityLoginPage />} />
                <Route path="/login-sindical" element={<UnionEntityLoginPage />} />
                <Route path="/acessos" element={<PortalAccessPage />} />
                <Route path="/portais" element={<PortalAccessPage />} />
                <Route path="/apresentacao" element={<PresentationPage />} />
                <Route path="/apresentacao-clinica" element={<ClinicPresentationPage />} />
                <Route path="/apresentacao-eclini" element={<ApresentacaoEcliniPage />} />
                <Route path="/tutorial-sindicato" element={<TutorialSindicatoPage />} />
                <Route path="/tutorial-sindical" element={<TutorialSindicatoPage />} />
                <Route path="/negociacao-espelho/:token" element={<NegotiationPreviewPage />} />
                <Route path="/lgpd" element={<LgpdPolicy />} />
                <Route path="/privacidade" element={<LgpdPolicy />} />
                <Route path="/instalar" element={<InstallPage />} />
                <Route path="/install" element={<InstallPage />} />
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
                {/* Rotas alias para agenda - redireciona para a rota correta */}
                <Route path="/calendar" element={<Navigate to="/dashboard/calendar" replace />} />
                <Route path="/agenda" element={<Navigate to="/dashboard/calendar" replace />} />
                {/* Public booking (both legacy and current URLs) */}
                <Route path="/agendar/:clinicSlug" element={<PublicBooking />} />
                <Route path="/booking/:clinicSlug" element={<PublicBooking />} />
                {/* Professional public profile */}
                <Route path="/profissional/:clinicSlug/:professionalSlug" element={<ProfessionalProfile />} />
                {/* Public anamnesis form via token */}
                <Route path="/anamnese/:token" element={<PublicAnamnesis />} />
                {/* Public NPS survey */}
                <Route path="/nps/:token" element={<PublicNPS />} />
                {/* Appointment confirmation via token */}
                <Route path="/consulta/:token" element={<AppointmentConfirmation />} />
                {/* Telemedicine patient room */}
                <Route path="/telemedicina/:token" element={<TelemedicinePatient />} />
                {/* Professional Portal */}
                <Route path="/profissional" element={<ProfessionalAuth />} />
                <Route path="/profissional/painel" element={<ProfessionalDashboard />} />
                <Route path="/profissional/atendimento/:appointmentId" element={<ProfessionalAppointment />} />
                {/* Public Panel and Totem routes */}
                <Route path="/portal-empresa" element={<EmployerPortal />} />
                <Route path="/portal-empresa/:clinicSlug" element={<EmployerPortal />} />
                <Route path="/portal-contador" element={<AccountingOfficePortal />} />
                <Route path="/portal-contador/:clinicSlug" element={<AccountingOfficePortal />} />
                <Route path="/portal-socio" element={<MemberPortal />} />
                <Route path="/portal-socio/:clinicSlug" element={<MemberPortal />} />
                <Route path="/panel/:token" element={<PublicPanel />} />
                <Route path="/totem/:token" element={<PublicTotem />} />
                <Route path="/card/:token" element={<CardValidation />} />
                {/* Public Contribution Value */}
                <Route path="/contribuicao/:token" element={<PublicContributionValue />} />
                {/* Homologação Public Routes */}
                <Route path="/agendamento/profissional/:slug" element={<HomologacaoPublicBooking />} />
                <Route path="/homologacao/:slug" element={<HomologacaoClinicBooking />} />
                <Route path="/protocolo/:token" element={<HomologacaoProtocolValidation />} />
                {/* Authorization Validation - Public */}
                <Route path="/autorizacao/:slug/:hash" element={<AuthorizationValidationPage />} />
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
                  <Route path="addons" element={<AddonsManagementPage />} />
                  <Route path="features" element={<FeaturesManagement />} />
                  <Route path="access-groups" element={<AccessGroupsPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="upgrades" element={<UpgradeRequestsPage />} />
                  <Route path="addon-requests" element={<AddonRequestsPage />} />
                  <Route path="import" element={<DataImportPage />} />
                  <Route path="smtp" element={<SmtpSettingsPage />} />
                  <Route path="audit" element={<AuditLogsPage />} />
                  <Route path="chat" element={<ChatSupportPage />} />
                  <Route path="hero" element={<HeroSettingsPage />} />
                  <Route path="banners" element={<CarouselBannersPage />} />
                  <Route path="config" element={<GlobalConfigPage />} />
                  <Route path="dependent-approvals" element={<PendingDependentApprovals />} />
                  <Route path="union-entities" element={<UnionEntitiesPage />} />
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
                  <Route path="patients/:id/contracheques" element={<PatientPayslipHistoryPage />} />
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
                  <Route path="financials/new" element={<NewTransactionPage />} />
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
                  <Route path="dependent-approvals" element={<DependentApprovalsPage />} />
                  <Route path="atendimento/:appointmentId" element={<AttendancePage />} />
                  <Route path="exams" element={<ExamsPage />} />
                  <Route path="exam-results" element={<ExamResultsPage />} />
                  <Route path="nps" element={<NPSDashboardPage />} />
                  <Route path="productivity" element={<ProductivityReportPage />} />
                  <Route path="no-show" element={<NoShowReportPage />} />
                  <Route path="inactive-patients" element={<InactivePatientsPage />} />
                  <Route path="empresas" element={<EmployersPage />} />
                  <Route path="empresas/:id" element={<EmployerDetailPage />} />
                  <Route path="contribuicoes" element={<ContributionsPage />} />
                  <Route path="negociacoes" element={<NegotiationsPage />} />
                  <Route path="escritorios" element={<AccountingOfficesPage />} />
                </Route>
                {/* Union Module Routes - Módulo Sindical Independente */}
                <Route
                  path="/union"
                  element={
                    <ProtectedRoute>
                      <UnionModuleLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<UnionDashboard />} />
                  {/* Alias de rotas antigas (evita 404 em links legados) */}
                  <Route path="orcamento" element={<Navigate to="/union/financeiro/orcamento" replace />} />
                  <Route path="orcamento/:id" element={<UnionBudgetLegacyRedirect />} />
                  <Route path="planos" element={<UnionPlansPage />} />
                  <Route path="empresas" element={<UnionEmployersPage />} />
                  <Route path="escritorios" element={<UnionAccountingOfficesPage />} />
                  <Route path="socios" element={<UnionMembersListPage />} />
                  <Route path="socios/novo" element={<PatientEditPage />} />
                  <Route path="socios/contracheques" element={<UnionPayslipApprovalsPage />} />
                  <Route path="socios/:id" element={<UnionMemberDetailPage />} />
                  <Route path="contribuicoes" element={<UnionContributionsPage />} />
                  <Route path="contribuicoes/relatorios" element={<UnionReportsPage />} />
                  <Route path="financeiro" element={<UnionFinancialsPage />} />
                  <Route path="financeiro/despesas" element={<UnionExpensesPage />} />
                  <Route path="financeiro/receitas" element={<UnionIncomePage />} />
                  <Route path="financeiro/movimentacao" element={<UnionStatementPage />} />
                  <Route path="financeiro/fluxo-caixa" element={<UnionCashFlowPage />} />
                  <Route path="financeiro/contas" element={<UnionCashRegistersPage />} />
                  <Route path="financeiro/fornecedores" element={<UnionSuppliersPage />} />
                  <Route path="financeiro/categorias" element={<UnionCategoriesPage />} />
                  <Route path="financeiro/plano-contas" element={<UnionChartOfAccountsPage />} />
                  <Route path="financeiro/conciliacao" element={<UnionReconciliationPage />} />
                  <Route path="financeiro/historico-pagamentos" element={<UnionPaymentHistoryPage />} />
                  <Route path="financeiro/conciliacao-bancaria" element={<UnionBankReconciliationPage />} />
                  <Route path="financeiro/relatorios" element={<UnionReportsPage />} />
                  <Route path="financeiro/relatorios-lytex" element={<UnionLytexReportsPage />} />
                  <Route path="financeiro/orcamento" element={<UnionBudgetPage />} />
                  <Route path="financeiro/orcamento/:id" element={<UnionBudgetDetailPage />} />
                  <Route path="negociacoes" element={<UnionNegotiationsPage />} />
                  <Route path="negociacoes/parcelamentos" element={<UnionNegotiationsPage />} />
                  <Route path="negociacoes/historico" element={<UnionNegotiationsPage />} />
                  <Route path="associados" element={<UnionAssociadosPage />} />
                  <Route path="filiacoes" element={<UnionFiliacoesPage />} />
                  {/* Homologação module routes - movido do dashboard */}
                  <Route path="homologacao" element={<HomologacaoAgendaPage />} />
                  <Route path="homologacao/profissionais" element={<HomologacaoProfissionaisPage />} />
                  <Route path="homologacao/servicos" element={<HomologacaoServicosPage />} />
                  <Route path="homologacao/bloqueios" element={<HomologacaoBloqueiosPage />} />
                  <Route path="homologacao/config" element={<HomologacaoConfigPage />} />
                  <Route path="conteudo-app" element={<UnionAppContentPage />} />
                  <Route path="beneficios" element={<UnionBenefitsPage />} />
                  <Route path="autorizacoes" element={<UnionAuthorizationsPage />} />
                  {/* Legal Module routes */}
                  <Route path="juridico" element={<UnionLegalDashboardPage />} />
                  <Route path="juridico/casos" element={<UnionLegalCasesPage />} />
                  <Route path="juridico/casos/novo" element={<UnionLegalCaseFormPage />} />
                  <Route path="juridico/casos/:id" element={<UnionLegalCaseFormPage />} />
                  <Route path="juridico/casos/:id/editar" element={<UnionLegalCaseFormPage />} />
                  <Route path="juridico/advogados" element={<UnionLawyersPage />} />
                  <Route path="juridico/escritorios" element={<UnionLawFirmsPage />} />
                  <Route path="juridico/prazos" element={<UnionLegalDeadlinesPage />} />
                  <Route path="juridico/prazos/novo" element={<UnionLegalDeadlineFormPage />} />
                  <Route path="juridico/despesas" element={<UnionLegalExpensesPage />} />
                  <Route path="configuracoes" element={<UnionConfigPage />} />
                </Route>
                {/* Mobile App Routes - sempre modo claro */}
                <Route path="/app" element={<MobileAppLayout />}>
                  <Route index element={<MobilePublicHomePage />} />
                  <Route path="welcome" element={<MobileWelcomePage />} />
                  <Route path="login" element={<MobileAuthPage />} />
                  <Route path="home" element={<MobileHomePage />} />
                  <Route path="home-publico" element={<MobilePublicHomePage />} />
                  <Route path="agendamentos" element={<MobileAppointmentsPage />} />
                  <Route path="agendamentos-juridicos" element={<MobileLegalAppointmentsPage />} />
                  <Route path="agendar" element={<MobileBookingPage />} />
                  <Route path="perfil" element={<MobileProfilePage />} />
                  <Route path="recuperar-senha" element={<MobilePasswordResetPage />} />
                  <Route path="primeiro-acesso" element={<MobileFirstAccessPage />} />
                  <Route path="dependentes" element={<MobileDependentsPage />} />
                  <Route path="alterar-senha" element={<MobileChangePasswordPage />} />
                  <Route path="carteirinha" element={<MobileCardPage />} />
                  <Route path="servicos" element={<MobileServicesPage />} />
                  <Route path="servicos/:serviceId" element={<MobileServicesPage />} />
                  <Route path="comunicacao" element={<MobileCommunicationPage />} />
                  <Route path="comunicacao/:mediaType" element={<MobileCommunicationPage />} />
                  <Route path="ajuda" element={<MobileHelpPage />} />
                  <Route path="faq" element={<MobileFAQPage />} />
                  <Route path="sobre" element={<MobileAboutPage />} />
                  <Route path="filiacao" element={<MobileFiliacaoPage />} />
                  <Route path="agendar-juridico" element={<MobileLegalBookingPage />} />
                  <Route path="autorizacoes" element={<MobileAuthorizationsPage />} />
                  <Route path="atualizar-carteirinha" element={<MobileCardRenewalPage />} />
                  <Route path="servicos/autorizacoes" element={<MobileAuthorizationsPage />} />
                  <Route path="servicos/declaracoes" element={<MobileAuthorizationsPage />} />
                  <Route path="instalar" element={<MobileInstallPage />} />
                  {/* Alias para evitar 404 por diferença de nomenclatura */}
                  <Route path="agendamento-juridico" element={<Navigate to="/app/agendar-juridico" replace />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
          </ModalProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
