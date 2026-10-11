import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Bell, RotateCw, ChevronRight } from "lucide-react";

interface SindSystemHeaderProps {
  logoUrl?: string | null;
  entityName: string;
  entityEmail?: string;
  onLogout: () => void;
}

export function SindSystemHeader({
  logoUrl,
  entityName,
  entityEmail,
  onLogout,
}: SindSystemHeaderProps) {
  return (
    <header className="bg-[#2c5282] text-white sticky top-0 z-20 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-4 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-7 object-contain brightness-0 invert shrink-0"
            />
          ) : (
            <span className="font-bold text-base shrink-0">SindSystem</span>
          )}
          <div className="hidden md:block min-w-0 border-l border-white/20 pl-3 ml-1">
            <p className="text-sm font-medium leading-tight truncate max-w-[220px]">
              {entityName}
            </p>
            {entityEmail && (
              <p className="text-[11px] text-white/60 truncate max-w-[220px]">
                {entityEmail}
              </p>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Notificações">
            <Bell className="h-4.5 w-4.5 text-white/80" />
          </button>
          <div className="flex items-center gap-2 md:hidden mr-1">
            <div className="h-7 w-7 rounded-full bg-white/15 flex items-center justify-center text-xs font-semibold">
              {entityName?.charAt(0)?.toUpperCase() || "E"}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-white/80 hover:text-white hover:bg-white/10 gap-1.5 px-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

interface SindSystemContainerProps {
  children: ReactNode;
}

export function SindSystemContainer({ children }: SindSystemContainerProps) {
  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {children}
    </div>
  );
}

interface SindSystemMainProps {
  children: ReactNode;
}

export function SindSystemMain({ children }: SindSystemMainProps) {
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {children}
    </main>
  );
}

interface SindSystemPageHeaderProps {
  icon?: ReactNode;
  title: string;
  subtitle: string;
  onBack?: () => void;
}

export function SindSystemPageHeader({
  icon,
  title,
  subtitle,
  onBack,
}: SindSystemPageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-slate-800 truncate">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {onBack && (
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50 shrink-0 h-8"
        >
          <RotateCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
      )}
    </div>
  );
}

interface SindSystemServiceCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  color: "green" | "blue" | "orange" | "red";
  badge?: string | number;
}

export function SindSystemServiceCard({
  icon,
  title,
  description,
  onClick,
  color,
  badge,
}: SindSystemServiceCardProps) {
  const iconStyles = {
    green: "bg-[#20c997]/10 text-[#13946f]",
    blue: "bg-[#2c7be5]/10 text-[#2c7be5]",
    orange: "bg-[#e8a838]/10 text-[#b9791e]",
    red: "bg-[#e35d6a]/10 text-[#e35d6a]",
  };
  const hoverBorder = {
    green: "hover:border-[#20c997]/40",
    blue: "hover:border-[#2c7be5]/40",
    orange: "hover:border-[#e8a838]/40",
    red: "hover:border-[#e35d6a]/40",
  };

  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 ${hoverBorder[color]} hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 w-full`}
    >
      {badge !== undefined && badge !== null && badge !== 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors ${iconStyles[color]}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-500" />
    </button>
  );
}

interface SindSystemBackButtonProps {
  onClick: () => void;
}

export function SindSystemBackButton({ onClick }: SindSystemBackButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      className="gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50"
    >
      <RotateCw className="h-3.5 w-3.5" />
      Voltar
    </Button>
  );
}
