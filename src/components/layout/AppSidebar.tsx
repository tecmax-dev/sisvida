import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, PanelLeftClose, PanelLeft, Search, Building2, HeartPulse, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import prosingeLogo from "@/assets/prosinge-logo.png";

export interface SidebarNavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
}
export interface SidebarNavCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: SidebarNavItem[];
}
export interface SidebarSection {
  id: string;
  label: string;
  categories: SidebarNavCategory[];
}

const COLLAPSE_KEY = "prosinge-sidebar-collapsed";

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch { /* preferência visual */ }
  }, [collapsed]);
  return [collapsed, setCollapsed] as const;
}

export function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/union") return pathname === href || pathname === href + "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Encontra o rótulo da página aberta (para o caminho na barra superior). */
export function findActiveCrumbs(sections: SidebarSection[], pathname: string) {
  let best: { section: string; category: string; item: string; len: number } | null = null;
  for (const s of sections) for (const c of s.categories) for (const i of c.items) {
    if (isNavActive(pathname, i.href) && (!best || i.href.length > best.len)) {
      best = { section: s.label, category: c.label, item: i.label, len: i.href.length };
    }
  }
  return best;
}

interface Props {
  sections: SidebarSection[];
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  mobile?: boolean;
}

export function AppSidebar({ sections, collapsed, onToggleCollapsed, onNavigate, mobile }: Props) {
  const { pathname } = useLocation();
  const [query, setQuery] = useState("");
  const isCollapsed = collapsed && !mobile;

  const activeSectionId = useMemo(() => {
    for (const s of sections) for (const c of s.categories) if (c.items.some((i) => isNavActive(pathname, i.href))) return s.id;
    return sections[0]?.id;
  }, [sections, pathname]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    // Abre automaticamente o grupo da página atual
    for (const s of sections) for (const c of s.categories) {
      if (c.items.some((i) => isNavActive(pathname, i.href))) setOpen({ [`${s.id}:${c.id}`]: true });
    }
  }, [pathname, sections]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        categories: s.categories
          .map((c) => ({
            ...c,
            items: c.label.toLowerCase().includes(q) ? c.items : c.items.filter((i) => i.label.toLowerCase().includes(q)),
          }))
          .filter((c) => c.items.length),
      }))
      .filter((s) => s.categories.length);
  }, [sections, q]);

  const activeSection = sections.find((s) => s.id === activeSectionId);

  return (
    <aside
      aria-label="Menu principal"
      className={cn(
        "flex h-full flex-col bg-shell text-shell-foreground transition-[width] duration-200",
        isCollapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex h-14 shrink-0 items-center gap-2 border-b border-shell-border px-3", isCollapsed && "justify-center px-2")}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-card"><img src={prosingeLogo} alt="Prosinge" className="h-6 w-6 object-contain" /></span>
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-shell-active-foreground">Prosinge</p>
            {activeSection && <p className="truncate text-[11px] text-shell-muted">{activeSection.label}</p>}
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-shell-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar função..."
              aria-label="Buscar função no menu"
              className="h-8 border-shell-border bg-shell-hover pl-8 text-sm text-shell-active-foreground placeholder:text-shell-muted focus-visible:ring-shell-active"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 [scrollbar-width:thin]">
        {filtered.map((section) => (
          <div key={section.id}>
            {!isCollapsed && (
              <p className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-shell-muted">
                {section.id === "union" ? <Building2 className="h-3.5 w-3.5" /> : section.id === "admin" ? <Shield className="h-3.5 w-3.5" /> : <HeartPulse className="h-3.5 w-3.5" />}
                {section.label}
              </p>
            )}
            {isCollapsed && sections.length > 1 && <div className="mx-3 mb-2 border-t border-shell-border" />}
            <ul className="space-y-0.5">
              {section.categories.map((cat) => {
                const key = `${section.id}:${cat.id}`;
                const catActive = cat.items.some((i) => isNavActive(pathname, i.href));
                const isOpen = !!q || !!open[key];
                const single = cat.items.length === 1;

                if (isCollapsed) {
                  const target = cat.items[0];
                  return (
                    <li key={key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            to={target.href}
                            onClick={onNavigate}
                            aria-label={cat.label}
                            className={cn(
                              "mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                              catActive ? "bg-shell-active text-shell-active-foreground" : "text-shell-foreground hover:bg-shell-hover hover:text-shell-active-foreground",
                            )}
                          >
                            <cat.icon className="h-5 w-5" />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">{cat.label}</TooltipContent>
                      </Tooltip>
                    </li>
                  );
                }

                if (single) {
                  const it = cat.items[0];
                  const active = isNavActive(pathname, it.href);
                  return (
                    <li key={key}>
                      <Link
                        to={it.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                          active ? "bg-shell-active font-medium text-shell-active-foreground" : "text-shell-foreground hover:bg-shell-hover hover:text-shell-active-foreground",
                        )}
                      >
                        <it.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{it.label}</span>
                        {!!it.badge && <span className="rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">{it.badge}</span>}
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setOpen((o) => (o[key] ? {} : { [key]: true }))}
                      aria-expanded={isOpen}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                        catActive ? "font-medium text-shell-active-foreground" : "text-shell-foreground",
                        "hover:bg-shell-hover hover:text-shell-active-foreground",
                      )}
                    >
                      <cat.icon className={cn("h-4 w-4 shrink-0", catActive && "text-shell-active")} />
                      <span className="flex-1 truncate text-left">{cat.label}</span>
                      <ChevronDown className={cn("h-3.5 w-3.5 opacity-60 transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <ul className="ml-[17px] mt-0.5 space-y-px border-l border-shell-border pl-2">
                        {cat.items.map((it) => {
                          const active = isNavActive(pathname, it.href);
                          return (
                            <li key={it.href}>
                              <Link
                                to={it.href}
                                onClick={onNavigate}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                  "flex items-center gap-2 rounded-md px-2 py-1 text-[12.5px] transition-colors",
                                  active ? "bg-shell-active/15 font-medium text-shell-active-foreground shadow-[inset_2px_0_0_hsl(var(--shell-active))]" : "text-shell-muted hover:bg-shell-hover hover:text-shell-active-foreground",
                                )}
                              >
                                <it.icon className="h-3.5 w-3.5 shrink-0" />
                                <span className="flex-1 truncate">{it.label}</span>
                                {!!it.badge && <span className="rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">{it.badge}</span>}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {q && filtered.length === 0 && <p className="px-3 text-sm text-shell-muted">Nenhuma função encontrada.</p>}
      </nav>

      {!mobile && onToggleCollapsed && (
        <div className="border-t border-shell-border p-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-shell-muted hover:bg-shell-hover hover:text-shell-active-foreground",
              isCollapsed && "justify-center",
            )}
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Recolher menu</>}
          </button>
        </div>
      )}
    </aside>
  );
}
