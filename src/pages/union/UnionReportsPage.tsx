import { useState, useEffect, useMemo} from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllEmployers } from "@/lib/supabase-helpers";
import { Loader2, FileBarChart, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import UnionContributionsReportsTab from "@/components/contributions/UnionContributionsReportsTab";

import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
interface Employer {
  id: string;
  name: string;
  cnpj: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  category_id?: string | null;
  registration_number?: string | null;
  trade_name?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
  description: string | null;
  default_value: number;
  is_active: boolean;
}

export default function UnionReportsPage() {
  const { currentClinic, userRoles} = useAuth();

  const resolvedClinic = useMemo(
    () => userRoles.find((role) => role.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [contributionTypes, setContributionTypes] = useState<ContributionType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (resolvedClinic?.id) {
      fetchData();
    }
  }, [resolvedClinic?.id]);

  const fetchData = async () => {
    if (!resolvedClinic?.id) return;
    setLoading(true);

    try {
      // Fetch employers - using pagination to avoid 1000 limit
      const employersResult = await fetchAllEmployers<Employer>(resolvedClinic.id, {
        select: "id, name, cnpj, email, phone, address, city, state, category_id, registration_number, trade_name"
      });
      if (employersResult.error) throw employersResult.error;
      setEmployers(employersResult.data);

      // Fetch contribution types
      const { data: typesData, error: typesError } = await supabase
        .from("contribution_types")
        .select("*")
        .eq("clinic_id", resolvedClinic.id)
        .order("name");

      if (typesError) throw typesError;
      setContributionTypes(typesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!resolvedClinic) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-foreground flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-muted-foreground" />
            Relatórios Sindicais
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
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
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-foreground flex items-center gap-2">
          <FileBarChart className="h-5 w-5 text-muted-foreground" />
          Relatórios Sindicais
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Relatórios financeiros do módulo sindical
        </p>
      </div>

      <UnionContributionsReportsTab
        clinicId={resolvedClinic.id}
        employers={employers}
        contributionTypes={contributionTypes}
        clinicName={resolvedClinic?.name}
        clinicLogo={resolvedClinic?.logo_url || undefined}
      />
    </div>
  );
}
