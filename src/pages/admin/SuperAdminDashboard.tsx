import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  Users, 
  Calendar, 
  UserCheck, 
  ArrowRight,
  TrendingUp
} from "lucide-react";

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
    { label: "Total de Clínicas", value: stats?.totalClinics || 0, icon: Building2, bgColor: "bg-primary", textColor: "text-primary-foreground" },
    { label: "Total de Pacientes", value: stats?.totalPatients || 0, icon: Users, bgColor: "bg-cta", textColor: "text-cta-foreground" },
    { label: "Agendamentos", value: stats?.totalAppointments || 0, icon: Calendar, bgColor: "bg-warning", textColor: "text-warning-foreground" },
    { label: "Usuários", value: stats?.totalUsers || 0, icon: UserCheck, bgColor: "bg-info", textColor: "text-info-foreground" },
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
        <Button asChild>
          <Link to="/admin/clinics">
            Ver todas as clínicas
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className={`relative overflow-hidden border-0 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 ${stat.bgColor}`}>
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-12 translate-x-12 bg-white/10" />
            <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full translate-y-8 -translate-x-8 bg-black/5" />
            <CardContent className="relative p-6">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20 bg-white/20" />
                  <Skeleton className="h-8 w-16 bg-white/20" />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${stat.textColor} opacity-90`}>{stat.label}</p>
                    <p className={`text-3xl font-bold mt-1 ${stat.textColor}`}>{stat.value.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <stat.icon className={`h-6 w-6 ${stat.textColor}`} />
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
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/clinics">Ver todas</Link>
          </Button>
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
