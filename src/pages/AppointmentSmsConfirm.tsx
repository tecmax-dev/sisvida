import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export default function AppointmentSmsConfirm() {
  const { token } = useParams<{ token: string }>();
  const [params] = useSearchParams();
  const x = params.get("x") === "1" ? "1" : "0";

  useEffect(() => {
    if (!token) return;
    const url = `${SUPABASE_URL}/functions/v1/appointment-action?t=${encodeURIComponent(token)}&x=${x}`;
    window.location.replace(url);
  }, [token, x]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
      <p style={{ color: "#666" }}>Processando…</p>
    </div>
  );
}