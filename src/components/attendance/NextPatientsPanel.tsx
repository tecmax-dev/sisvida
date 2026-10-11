import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Play, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NextPatient {
  id: string;
  start_time: string;
  status: string;
  name: string;
  age: number | null;
  isDependent: boolean;
}

const STATUS: Record<string, { label: string; variant: "info" | "success" | "warning" | "muted" }> = {
  scheduled: { label: "Agendado", variant: "muted" },
  confirmed: { label: "Confirmado", variant: "info" },
  arrived: { label: "Chegou", variant: "success" },
  in_progress: { label: "Em atendimento", variant: "warning" },
};

function ageFrom(birth?: string | null): number | null {
  if (!birth) return null;
  const [y, m, d] = birth.split("-").map(Number);
  if (!y) return null;
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return a;
}

/** Busca os próximos pacientes do mesmo profissional, no mesmo dia, ainda não atendidos. */
export function useNextPatients(params: {
  clinicId?: string;
  professionalId?: string;
  date?: string;
  currentId?: string;
}) {
  const { clinicId, professionalId, date, currentId } = params;
  const [items, setItems] = useState<NextPatient[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!clinicId || !professionalId || !date) return;
    setLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select(
        "id, start_time, status, patient:patients(name, birth_date), dependent:patient_dependents!appointments_dependent_id_fkey(name, birth_date)"
      )
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .eq("appointment_date", date)
      .in("status", ["scheduled", "confirmed", "arrived", "in_progress"])
      .order("start_time", { ascending: true });
    const list = ((data as any[]) || [])
      .filter((a) => a.id !== currentId)
      .map((a) => {
        const p = a.dependent || a.patient;
        return {
          id: a.id,
          start_time: a.start_time,
          status: a.status,
          name: p?.name || "Paciente",
          age: ageFrom(p?.birth_date),
          isDependent: !!a.dependent,
        } as NextPatient;
      });
    setItems(list);
    setLoading(false);
  }, [clinicId, professionalId, date, currentId]);

  useEffect(() => {
    load();
    if (!clinicId || !professionalId) return;
    const channel = supabase
      .channel(`next-patients-${professionalId}-${date}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `professional_id=eq.${professionalId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, clinicId, professionalId, date]);

  return { items, loading, reload: load };
}

export function NextPatientsList({
  items,
  loading,
  onOpen,
  compact,
}: {
  items: NextPatient[];
  loading: boolean;
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  if (loading && items.length === 0)
    return <p className="p-4 text-sm text-muted-foreground">Carregando…</p>;
  if (items.length === 0)
    return <p className="p-4 text-sm text-muted-foreground">Nenhum outro paciente pendente hoje.</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((p, i) => {
        const st = STATUS[p.status] ?? { label: p.status, variant: "muted" as const };
        return (
          <li key={p.id} className={cn("flex items-center gap-3 p-3", i === 0 && "bg-primary/5")}>
            <span className="w-12 shrink-0 font-mono text-sm font-semibold text-primary">
              {p.start_time?.slice(0, 5)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                {p.age != null && <span className="text-[11px] text-muted-foreground">{p.age}a</span>}
                {p.isDependent && <Badge variant="muted" className="h-4 px-1 text-[10px]">DEP</Badge>}
                <Badge variant={st.variant} className="h-4 px-1 text-[10px]">{st.label}</Badge>
              </div>
            </div>
            <Button size={compact ? "sm" : "sm"} variant={i === 0 ? "default" : "outline"} onClick={() => onOpen(p.id)}>
              <Play className="h-3.5 w-3.5" />
              <span className="ml-1">Abrir</span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export function NextPatientsPanel({
  items,
  loading,
  onOpen,
}: {
  items: NextPatient[];
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (collapsed)
    return (
      <div className="hidden lg:flex w-12 flex-col items-center border-l border-border bg-card py-3">
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} title="Mostrar próximos pacientes">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Users className="mt-2 h-4 w-4 text-primary" />
        <span className="mt-1 text-xs font-semibold text-primary">{items.length}</span>
      </div>
    );
  return (
    <aside className="hidden lg:flex w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Próximos pacientes</span>
          <Badge variant="info" className="h-5 px-1.5 text-[10px]">{items.length}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(true)} title="Recolher">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <NextPatientsList items={items} loading={loading} onOpen={onOpen} />
      </ScrollArea>
    </aside>
  );
}
