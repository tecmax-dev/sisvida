import { useAuth } from "@/hooks/useAuth";
import { UnionChartOfAccountsPanel } from "@/components/union/financials/UnionChartOfAccountsPanel";
import { Skeleton } from "@/components/ui/skeleton";

export default function UnionChartOfAccountsPage() {
  const { currentClinic } = useAuth();

  if (!currentClinic?.id) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <UnionChartOfAccountsPanel clinicId={currentClinic.id} />
    </div>
  );
}
