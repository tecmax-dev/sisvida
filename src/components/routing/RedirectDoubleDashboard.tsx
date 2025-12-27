import { Navigate, useLocation } from "react-router-dom";

export function RedirectDoubleDashboard() {
  const location = useLocation();
  const fixedPathname = location.pathname.replace(/^\/dashboard\/dashboard/, "/dashboard");
  const to = `${fixedPathname}${location.search}${location.hash}`;
  return <Navigate to={to} replace />;
}
