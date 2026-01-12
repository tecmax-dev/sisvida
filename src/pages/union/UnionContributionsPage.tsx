import { useAuth } from "@/hooks/useAuth";
import { Loader2, Receipt, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ContributionsPage from "@/pages/dashboard/ContributionsPage";

export default function UnionContributionsPage() {
  const { currentClinic, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentClinic) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Contribuições Sindicais
          </h1>
          <p className="text-muted-foreground">
            Gerencie boletos e contribuições das empresas associadas
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

  return <ContributionsPage />;
}
