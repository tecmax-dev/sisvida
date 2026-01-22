import { Navigate, useParams } from "react-router-dom";

/**
 * Redireciona URLs legadas do orçamento para a rota atual do módulo.
 * Ex.: /union/orcamento/:id -> /union/financeiro/orcamento/:id
 */
export function UnionBudgetLegacyRedirect() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <Navigate to="/union/financeiro/orcamento" replace />;
  }

  return <Navigate to={`/union/financeiro/orcamento/${id}`} replace />;
}
