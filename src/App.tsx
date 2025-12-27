import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoadingFallback } from "@/components/ui/loading-fallback";
import { Button } from "./components/ui/button";

// Layouts (carregamento imediato - necessários para estrutura)
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { AdminLayout } from "./components/admin/AdminLayout";

// Landing page (carregamento imediato - primeira página)
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

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

// Portal do Profissional
const ProfessionalDashboard = lazy(() => import("./pages/ProfessionalDashboard"));

// Dashboard pages (20 páginas)
const DashboardOverview = lazy(() => import("./pages/dashboard/DashboardOverview"));
const CalendarPage = lazy(() => import("./pages/dashboard/CalendarPage"));
const PatientsPage = lazy(() => import("./pages/dashboard/PatientsPage"));
const PatientEditPage = lazy(() => import("./pages/dashboard/PatientEditPage"));
const ProfessionalsPage = lazy(() => import("./pages/dashboard/ProfessionalsPage"));
const ProfessionalEditPage = lazy(() => import("./pages/dashboard/ProfessionalEditPage"));
const AppointmentEditPage = lazy(() => import("./pages/dashboard/AppointmentEditPage"));
const InsurancePage = lazy(() => import("./pages/dashboard/InsurancePage"));
const MedicalRecordsPage = lazy(() => import("./pages/dashboard/MedicalRecordsPage"));
const AnamnesisPage = lazy(() => import("./pages/dashboard/AnamnesisPage"));
const AnamneseTemplatesPage = lazy(() => import("./pages/dashboard/AnamneseTemplatesPage"));
const DynamicAnamnesisPage = lazy(() => import("./pages/dashboard/DynamicAnamnesisPage"));
const WaitingListPage = lazy(() => import("./pages/dashboard/WaitingListPage"));
const ReportsPage = lazy(() => import("./pages/dashboard/ReportsPage"));
const SubscriptionPage = lazy(() => import("./pages/dashboard/SubscriptionPage"));
const PrescriptionPage = lazy(() => import("./pages/dashboard/PrescriptionPage"));
const FinancialsPage = lazy(() => import("./pages/dashboard/FinancialsPage"));
const ProceduresPage = lazy(() => import("./pages/dashboard/ProceduresPage"));
const ProcedureEditPage = lazy(() => import("./pages/dashboard/ProcedureEditPage"));
const SettingsPage = lazy(() => import("./pages/dashboard/SettingsPage"));
const UsersManagementPage = lazy(() => import("./pages/dashboard/UsersManagementPage"));
const PackagesPage = lazy(() => import("./pages/dashboard/PackagesPage"));
const PatientAttachmentsPage = lazy(() => import("./pages/dashboard/PatientAttachmentsPage"));
const StockPage = lazy(() => import("./pages/dashboard/StockPage"));
const CatalogPage = lazy(() => import("./pages/dashboard/CatalogPage"));
const QuotesPage = lazy(() => import("./pages/dashboard/QuotesPage"));

// Admin pages (9 páginas)
const SuperAdminDashboard = lazy(() => import("./pages/admin/SuperAdminDashboard"));
const ClinicsManagement = lazy(() => import("./pages/admin/ClinicsManagement"));
const UsersManagement = lazy(() => import("./pages/admin/UsersManagement"));
const PlansManagement = lazy(() => import("./pages/admin/PlansManagement"));
const FeaturesManagement = lazy(() => import("./pages/admin/FeaturesManagement"));
const AccessGroupsPage = lazy(() => import("./pages/admin/AccessGroupsPage"));
const UpgradeRequestsPage = lazy(() => import("./pages/admin/UpgradeRequestsPage"));
const AuditLogsPage = lazy(() => import("./pages/admin/AuditLogsPage"));
const DataImportPage = lazy(() => import("./pages/admin/DataImportPage"));
const SmtpSettingsPage = lazy(() => import("./pages/admin/SmtpSettingsPage"));
const NotificationsPage = lazy(() => import("./pages/admin/NotificationsPage"));
const ChatSupportPage = lazy(() => import("./pages/admin/ChatSupportPage"));

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
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8 max-w-md">
            <h1 className="text-2xl font-bold text-foreground mb-4">
              Algo deu errado
            </h1>
            <p className="text-muted-foreground mb-6">
              Ocorreu um erro inesperado. Por favor, recarregue a página.
            </p>
            <Button onClick={() => window.location.reload()}>
              Recarregar página
            </Button>
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
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/instalar" element={<InstallPage />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/cadastro" element={<PublicSignup />} />
                <Route path="/confirm-email" element={<ConfirmEmail />} />
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
                  <Route path="patients/:id/edit" element={<PatientEditPage />} />
                  <Route path="patients/:id/attachments" element={<PatientAttachmentsPage />} />
                  <Route path="professionals" element={<ProfessionalsPage />} />
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
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
