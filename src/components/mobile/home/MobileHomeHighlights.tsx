import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, IdCard, Users, Newspaper, ChevronRight, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAppTabs } from "@/hooks/useMobileAppTabs";
import { parseDateOnlyToLocalNoon } from "@/lib/date";

interface Props {
  patientId: string;
  dependentsCount: number;
}

const fmt = (d: string) =>
  parseDateOnlyToLocalNoon(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function MobileCardStatus({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const { data: card, isLoading } = useQuery({
    queryKey: ["mobile-home-card", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("patient_cards")
        .select("expires_at, is_active")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="h-11 rounded-xl bg-mobile-foreground/10 animate-pulse" />;
  if (!card?.expires_at) return null;

  const exp = parseDateOnlyToLocalNoon(card.expires_at.slice(0, 10));
  const days = Math.ceil((exp.getTime() - Date.now()) / 86_400_000);
  const expired = days < 0;
  const soon = !expired && days <= 30;
  const Icon = expired || soon ? AlertTriangle : CheckCircle2;
  const text = expired
    ? `Carteirinha vencida em ${fmt(card.expires_at.slice(0, 10))}`
    : soon
      ? `Carteirinha vence em ${days} dia${days === 1 ? "" : "s"}`
      : `Carteirinha ativa · válida até ${fmt(card.expires_at.slice(0, 10))}`;

  return (
    <button
      onClick={() => navigate(expired || soon ? "/app/atualizar-carteirinha" : "/app/carteirinha")}
      className="w-full flex items-center gap-2.5 rounded-xl bg-mobile-foreground/12 px-3.5 py-2.5 text-left text-sm font-medium backdrop-blur transition active:scale-[0.99]"
      style={{ backgroundColor: "hsl(var(--mobile-primary-foreground) / 0.14)" }}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{text}</span>
      {(expired || soon) && <span className="text-xs font-semibold underline underline-offset-2">Renovar</span>}
      <ChevronRight className="h-4 w-4 opacity-80" aria-hidden="true" />
    </button>
  );
}

export function MobilePriorityCards({ dependentsCount }: Pick<Props, "dependentsCount">) {
  const navigate = useNavigate();
  const { isTabActive } = useMobileAppTabs();

  const cards = [
    { key: "agendamentos", icon: CalendarDays, title: "Agendar", sub: "Consultas e especialidades", path: "/app/agendar" },
    { key: "carteirinha", icon: IdCard, title: "Carteirinha", sub: "Identificação digital", path: "/app/carteirinha" },
    {
      key: "dependentes",
      icon: Users,
      title: "Dependentes",
      sub: dependentsCount > 0 ? `${dependentsCount} cadastrado${dependentsCount > 1 ? "s" : ""}` : "Consultar e incluir",
      path: "/app/dependentes",
    },
    { key: "jornais", icon: Newspaper, title: "Notícias", sub: "Comunicados SECMI", path: "/app/comunicacao/jornais" },
  ].filter((c) => isTabActive(c.key));

  if (!cards.length) return null;

  return (
    <section className="px-4 -mt-6 relative z-10" aria-label="Serviços principais">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <button
            key={c.key}
            onClick={() => navigate(c.path)}
            className="group flex min-h-[112px] flex-col justify-between rounded-2xl border border-border/70 bg-card p-4 text-left shadow-[0_6px_20px_-10px_hsl(var(--foreground)/0.18)] transition active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mobile-soft text-mobile">
              <c.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold text-foreground">{c.title}</span>
              <span className="block text-xs text-muted-foreground leading-snug">{c.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function MobileNextAppointment({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const { data: apt } = useQuery({
    queryKey: ["mobile-home-next-apt", patientId],
    queryFn: async () => {
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const { data } = await supabase
        .from("appointments")
        .select("id, appointment_date, start_time, status, professional:professionals(name, specialty)")
        .eq("patient_id", patientId)
        .gte("appointment_date", iso)
        .in("status", ["scheduled", "confirmed"])
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    staleTime: 60_000,
  });

  if (!apt) return null;

  return (
    <section className="px-4 mt-5">
      <h3 className="mb-2.5 text-sm font-semibold text-foreground">Próximo atendimento</h3>
      <button
        onClick={() => navigate("/app/agendamentos")}
        className="flex w-full items-center gap-3 rounded-2xl border border-mobile/20 bg-mobile-soft p-3.5 text-left transition active:scale-[0.99]"
      >
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-mobile text-mobile-foreground">
          <span className="text-lg font-bold leading-none">{parseDateOnlyToLocalNoon(apt.appointment_date).getDate()}</span>
          <span className="text-[10px] uppercase">
            {parseDateOnlyToLocalNoon(apt.appointment_date).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{apt.professional?.name || "Atendimento"}</p>
          {apt.professional?.specialty && <p className="truncate text-xs text-muted-foreground">{apt.professional.specialty}</p>}
          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-mobile">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {String(apt.start_time).slice(0, 5)} ·{" "}
            {apt.status === "confirmed" ? "Confirmado" : "Agendado"}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </button>
    </section>
  );
}
