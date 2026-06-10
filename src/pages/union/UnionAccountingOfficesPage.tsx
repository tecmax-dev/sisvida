import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Building2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AccountingOfficesPage from "@/pages/dashboard/AccountingOfficesPage";

import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
export default function UnionAccountingOfficesPage() {
  const { currentClinic, loading, userRoles} = useAuth();


  const resolvedClinic = useMemo(
    () => userRoles.find((role) => role.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!resolvedClinic) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Escritórios de Contabilidade
          </h1>
          <p className="text-muted-foreground">
            Gerencie os escritórios de contabilidade vinculados
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhuma clínica vinculada à entidade sindical. Entre em contato com o administrador para vincular uma clínica ao cadastro da entidade.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <AccountingOfficesPage clinicOverride={resolvedClinic} />;
}
