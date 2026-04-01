import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UnionChartOfAccountsPanel } from "@/components/union/financials/UnionChartOfAccountsPanel";
import { Skeleton } from "@/components/ui/skeleton";

import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
export default function UnionChartOfAccountsPage() {
  const { currentClinic, userRoles} = useAuth();


  const resolvedClinic = useMemo(
    () => userRoles.find((role) => role.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  if (!resolvedClinic?.id) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <UnionChartOfAccountsPanel clinicId={resolvedClinic.id} />
    </div>
  );
}
