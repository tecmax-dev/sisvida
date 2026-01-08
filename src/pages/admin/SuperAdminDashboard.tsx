import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Building2, 
  Users, 
  Calendar, 
  UserCheck, 
  ArrowRight,
  TrendingUp,
  Download,
  Loader2,
  ChevronDown
} from "lucide-react";
import { toast } from "sonner";

interface Stats {
  totalClinics: number;
  totalPatients: number;
  totalAppointments: number;
  totalUsers: number;
}

interface RecentClinic {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentClinics, setRecentClinics] = useState<RecentClinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [clinicBackupLoading, setClinicBackupLoading] = useState(false);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-sql-backup`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao gerar backup");
      }

      const sql = await response.text();
      const blob = new Blob([sql], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Backup gerado com sucesso!");
    } catch (error) {
      console.error("Backup error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao gerar backup");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleClinicBackup = async (clinicId: string, clinicSlug: string, version: string = "1.1") => {
    setClinicBackupLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      toast.info(`Gerando backup v${version} da clínica... Isso pode levar alguns minutos.`);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clinic-backup?clinic_id=${clinicId}&version=${version}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao gerar backup da clínica");
      }

      const json = await response.text();
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${clinicSlug}_v${version}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Backup v${version} da clínica gerado com sucesso!`);
    } catch (error) {
      console.error("Clinic backup error:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao gerar backup da clínica");
    } finally {
      setClinicBackupLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchRecentClinics();
  }, []);

  const fetchStats = async () => {
    try {
      const [clinicsRes, patientsRes, appointmentsRes, usersRes] = await Promise.all([
        supabase.from('clinics').select('id', { count: 'exact', head: true }),
        supabase.from('patients').select('id', { count: 'exact', head: true }),
        supabase.from('appointments').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalClinics: clinicsRes.count || 0,
        totalPatients: patientsRes.count || 0,
        totalAppointments: appointmentsRes.count || 0,
        totalUsers: usersRes.count || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentClinics = async () => {
    const { data } = await supabase
      .from('clinics')
      .select('id, name, slug, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (data) {
      setRecentClinics(data);
    }
  };

  const statCards = [
    { label: "Total de Clínicas", value: stats?.totalClinics || 0, icon: Building2, color: "text-primary" },
    { label: "Total de Pacientes", value: stats?.totalPatients || 0, icon: Users, color: "text-info" },
    { label: "Agendamentos", value: stats?.totalAppointments || 0, icon: Calendar, color: "text-success" },
    { label: "Usuários", value: stats?.totalUsers || 0, icon: UserCheck, color: "text-warning" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral de todas as clínicas do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBackup} disabled={backupLoading}>
            {backupLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Backup SQL
          </Button>
          <Button asChild>
            <Link to="/admin/clinics">
              Ver todas as clínicas
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="card-hover">
            <CardContent className="p-5">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className={`p-3 rounded-lg bg-muted ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Clinics */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Clínicas Recentes
          </CardTitle>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={clinicBackupLoading}>
                  {clinicBackupLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Backup Sindicato
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Versão do Backup</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleClinicBackup("89e7585e-7bce-4e58-91fa-c37080d1170d", "sindicato", "1.1")}
                  className="flex flex-col items-start py-2"
                >
                  <span className="font-medium">v1.1 - Completo</span>
                  <span className="text-xs text-muted-foreground">
                    30 tabelas (inclui escritórios e portais)
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleClinicBackup("89e7585e-7bce-4e58-91fa-c37080d1170d", "sindicato", "1.0")}
                  className="flex flex-col items-start py-2"
                >
                  <span className="font-medium">v1.0 - Básico</span>
                  <span className="text-xs text-muted-foreground">
                    24 tabelas principais
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/clinics">Ver todas</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentClinics.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma clínica cadastrada ainda
            </p>
          ) : (
            <div className="space-y-2">
              {recentClinics.map((clinic) => (
                <div
                  key={clinic.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{clinic.name}</p>
                      <p className="text-xs text-muted-foreground">/{clinic.slug}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(clinic.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
