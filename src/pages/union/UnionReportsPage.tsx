import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllEmployers } from "@/lib/supabase-helpers";
import { Loader2, FileBarChart, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ContributionsReportsTab from "@/components/contributions/ContributionsReportsTab";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name?: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  category_id?: string | null;
  registration_number?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
  description: string | null;
  default_value: number;
  is_active: boolean;
}

interface Contribution {
  id: string;
  employer_id: string;
  contribution_type_id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  due_date: string;
  status: string;
  lytex_invoice_id: string | null;
  lytex_invoice_url: string | null;
  paid_at: string | null;
  paid_value: number | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  employers?: Employer;
  contribution_types?: ContributionType;
}

export default function UnionReportsPage() {
  const { currentClinic } = useAuth();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [contributionTypes, setContributionTypes] = useState<ContributionType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentClinic?.id) {
      fetchData();
    }
  }, [currentClinic?.id]);

  const fetchData = async () => {
    if (!currentClinic?.id) return;
    setLoading(true);

    try {
      // Fetch ALL contributions (not filtered by year - let the component filter)
      const { data: contribData, error: contribError } = await supabase
        .from("employer_contributions")
        .select(`
          *,
          employers (id, name, cnpj, trade_name, email, phone, address, city, state, category_id, registration_number),
          contribution_types (id, name, description, default_value, is_active)
        `)
        .eq("clinic_id", currentClinic.id)
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false });

      if (contribError) throw contribError;
      setContributions(contribData || []);

      // Fetch employers - using pagination to avoid 1000 limit
      // Include trade_name for search functionality
      const employersResult = await fetchAllEmployers<Employer>(currentClinic.id, {
        select: "id, name, cnpj, trade_name, email, phone, address, city, state, category_id, registration_number"
      });
      if (employersResult.error) throw employersResult.error;
      setEmployers(employersResult.data);

      // Fetch contribution types
      const { data: typesData, error: typesError } = await supabase
        .from("contribution_types")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("name");

      if (typesError) throw typesError;
      setContributionTypes(typesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!currentClinic) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileBarChart className="h-6 w-6 text-blue-500" />
            Relatórios Sindicais
          </h1>
          <p className="text-muted-foreground">
            Relatórios financeiros do módulo sindical
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhuma clínica vinculada à entidade sindical. Entre em contato com o administrador.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileBarChart className="h-6 w-6 text-blue-500" />
          Relatórios Sindicais
        </h1>
        <p className="text-muted-foreground">
          Relatórios financeiros do módulo sindical
        </p>
      </div>

      {contributions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileBarChart className="h-5 w-5 text-blue-500" />
              Sem Dados
            </CardTitle>
            <CardDescription>
              Nenhuma contribuição encontrada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <FileBarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aguarde o lançamento de contribuições para visualizar os relatórios</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ContributionsReportsTab
          contributions={contributions}
          employers={employers}
          contributionTypes={contributionTypes}
          clinicName={currentClinic?.name}
          clinicLogo={currentClinic?.logo_url || undefined}
        />
      )}
    </div>
  );
}
