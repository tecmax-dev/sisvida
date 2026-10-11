import { ReactNode, useState } from "react";
import { useLocation } from "react-router-dom";
import { Menu, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AppSidebar, SidebarSection, findActiveCrumbs, useSidebarCollapsed } from "./AppSidebar";

interface Props {
  sections: SidebarSection[];
  /** Ações à direita da barra superior (tema, avisos, usuário). */
  actions?: ReactNode;
  /** Conteúdo acima da barra (ex.: aviso de manutenção). */
  before?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** Moldura padrão: menu lateral recolhível + barra superior compacta. */
export function AppShell({ sections, actions, before, footer, children }: Props) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const crumbs = findActiveCrumbs(sections, pathname);

  return (
    <div className="flex h-[100dvh] min-h-screen overflow-hidden bg-muted/40">
      <div className="hidden lg:flex">
        <AppSidebar sections={sections} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 border-0 bg-shell p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <AppSidebar sections={sections} collapsed={false} mobile onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {before}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-card px-3 lg:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </Button>
          <nav aria-label="Caminho da página" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
            {crumbs ? (
              <>
                <span className="hidden text-muted-foreground sm:inline">{crumbs.section}</span>
                <ChevronRight className="hidden h-3.5 w-3.5 text-muted-foreground/60 sm:inline" />
                {crumbs.category !== crumbs.item && (
                  <>
                    <span className="hidden text-muted-foreground md:inline">{crumbs.category}</span>
                    <ChevronRight className="hidden h-3.5 w-3.5 text-muted-foreground/60 md:inline" />
                  </>
                )}
                <span className="truncate font-medium text-foreground">{crumbs.item}</span>
              </>
            ) : (
              <span className="truncate font-medium text-foreground">Prosinge</span>
            )}
          </nav>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">{actions}</div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4 pb-16 sm:px-5 sm:py-5">
          <div className="mx-auto w-full max-w-[1760px] animate-enter">{children}</div>
        </main>
        {footer}
      </div>
    </div>
  );
}
