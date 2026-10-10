import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays, Scale, RefreshCw, Handshake, FileText, FileSignature, Building2, Receipt, Users2,
  FolderOpen, Headset, MessageSquareWarning, KeyRound, Image, Newspaper, Radio, PlayCircle, MapPin, Search, LucideIcon,
} from "lucide-react";
import { useMobileAppTabs } from "@/hooks/useMobileAppTabs";
import { useMobileAuth, PUBLIC_TAB_KEYS } from "@/hooks/useMobileAuth";

interface Item { key: string; label: string; icon: LucideIcon; path: string; alwaysPublic?: boolean }

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Atendimento",
    items: [
      { key: "agendamentos", label: "Agendamentos", icon: CalendarDays, path: "/app/agendamentos" },
      { key: "agendamento-juridico", label: "Agend. Jurídico", icon: Scale, path: "/app/agendar-juridico" },
      { key: "atendimentos", label: "Atendimentos", icon: Headset, path: "/app/servicos/atendimentos" },
      { key: "ouvidoria", label: "Ouvidoria", icon: MessageSquareWarning, path: "/app/servicos/ouvidoria" },
    ],
  },
  {
    title: "Documentos e conta",
    items: [
      { key: "atualizar-carteirinha", label: "Atualizar Carteirinha", icon: RefreshCw, path: "/app/atualizar-carteirinha" },
      { key: "declaracoes", label: "Declarações", icon: FileText, path: "/app/servicos/declaracoes" },
      { key: "autorizacoes", label: "Autorizações", icon: FileSignature, path: "/app/autorizacoes" },
      { key: "documentos", label: "Documentos", icon: FolderOpen, path: "/app/servicos/documentos" },
      { key: "alterar-senha", label: "Alterar senha", icon: KeyRound, path: "/app/alterar-senha" },
    ],
  },
  {
    title: "Benefícios e financeiro",
    items: [
      { key: "convenios", label: "Convênios", icon: Building2, path: "/app/servicos/convenios" },
      { key: "convencoes", label: "Convenções", icon: Handshake, path: "/app/servicos/convencoes" },
      { key: "boletos", label: "Boletos", icon: Receipt, path: "/app/servicos/boletos" },
      { key: "diretoria", label: "Diretoria", icon: Users2, path: "/app/servicos/diretoria" },
    ],
  },
  {
    title: "Comunicação",
    items: [
      { key: "galeria", label: "Galeria", icon: Image, path: "/app/comunicacao/galeria" },
      { key: "jornais", label: "Jornais", icon: Newspaper, path: "/app/comunicacao/jornais" },
      { key: "radios", label: "Rádios", icon: Radio, path: "/app/comunicacao/radios" },
      { key: "videos", label: "Vídeos", icon: PlayCircle, path: "/app/comunicacao/videos" },
    ],
  },
  {
    title: "Ajuda e contato",
    items: [{ key: "__ajuda", label: "Como chegar e contato", icon: MapPin, path: "/app/ajuda", alwaysPublic: true }],
  },
];

export function MobileAllServices() {
  const navigate = useNavigate();
  const { isTabActive, loading } = useMobileAppTabs();
  const { isLoggedIn } = useMobileAuth();
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        if (!i.alwaysPublic) {
          if (!isTabActive(i.key)) return false;
          if (!isLoggedIn && !PUBLIC_TAB_KEYS.includes(i.key)) return false;
        }
        if (!term) return true;
        return i.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term);
      }),
    })).filter((g) => g.items.length);
  }, [q, isTabActive, isLoggedIn]);

  if (loading) {
    return (
      <div className="px-4 mt-6 grid grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <section id="todos-servicos" className="px-4 mt-7" aria-label="Todos os serviços">
      <h3 className="text-base font-semibold text-foreground">Todos os serviços</h3>
      <label className="relative mt-3 block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar serviço..."
          aria-label="Buscar serviço"
          className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm outline-none focus:border-mobile focus:ring-2 focus:ring-mobile/20"
        />
      </label>

      {groups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum serviço encontrado.</p>}

      {groups.map((g) => (
        <div key={g.title} className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
          <div className="grid grid-cols-3 gap-2.5 min-[400px]:grid-cols-4">
            {g.items.map((i) => (
              <button
                key={i.key}
                onClick={() => navigate(i.path)}
                className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card px-1.5 py-3 text-center shadow-sm transition active:scale-95"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mobile-soft text-mobile">
                  <i.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-[11.5px] font-medium leading-tight text-foreground">{i.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
