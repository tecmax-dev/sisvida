import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ProfessionalAuth from "./pages/ProfessionalAuth";
import ProfessionalDashboard from "./pages/ProfessionalDashboard";
import ClinicSetup from "./pages/ClinicSetup";
import PublicBooking from "./pages/PublicBooking";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import DashboardOverview from "./pages/dashboard/DashboardOverview";
import CalendarPage from "./pages/dashboard/CalendarPage";
import PatientsPage from "./pages/dashboard/PatientsPage";
import ProfessionalsPage from "./pages/dashboard/ProfessionalsPage";
import InsurancePage from "./pages/dashboard/InsurancePage";
import ReportsPage from "./pages/dashboard/ReportsPage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import MedicalRecordsPage from "./pages/dashboard/MedicalRecordsPage";
import WaitingListPage from "./pages/dashboard/WaitingListPage";
import AnamnesisPage from "./pages/dashboard/AnamnesisPage";
import NotFound from "./pages/NotFound";
import { AdminLayout } from "./components/admin/AdminLayout";
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
import ClinicsManagement from "./pages/admin/ClinicsManagement";
import UsersManagement from "./pages/admin/UsersManagement";
import AuditLogsPage from "./pages/admin/AuditLogsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            {/* Public booking (both legacy and current URLs) */}
            <Route path="/agendar/:clinicSlug" element={<PublicBooking />} />
            <Route path="/booking/:clinicSlug" element={<PublicBooking />} />
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
              <Route path="audit" element={<AuditLogsPage />} />
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
              <Route path="professionals" element={<ProfessionalsPage />} />
              <Route path="insurance" element={<InsurancePage />} />
              <Route path="medical-records" element={<MedicalRecordsPage />} />
              <Route path="anamnesis" element={<AnamnesisPage />} />
              <Route path="waiting-list" element={<WaitingListPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
