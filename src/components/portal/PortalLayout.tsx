import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw, Printer, Building2 } from "lucide-react";

interface PortalHeaderProps {
  logoUrl?: string | null;
  clinicName?: string;
  entityName: string;
  entitySubtitle?: string;
  onLogout: () => void;
  onRefresh?: () => void;
  onPrint?: () => void;
  variant?: "amber" | "teal";
}

export function PortalHeader({
  logoUrl,
  clinicName,
  entityName,
  entitySubtitle,
  onLogout,
  onRefresh,
  onPrint,
  variant = "amber"
}: PortalHeaderProps) {
  return (
    <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white sticky top-0 z-20 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={clinicName || "Logo"} 
                className="h-10 object-contain brightness-0 invert"
              />
            ) : (
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                variant === "teal" ? "bg-teal-500/20" : "bg-amber-500/20"
              }`}>
                <Building2 className="h-5 w-5" />
              </div>
            )}
            <div className="hidden sm:block">
              <h1 className="font-semibold text-base leading-tight truncate max-w-[280px]">
                {entityName}
              </h1>
              {entitySubtitle && (
                <p className="text-xs text-white/60 truncate max-w-[280px]">{entitySubtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {onRefresh && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onRefresh}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
            )}
            {onPrint && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onPrint}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <Printer className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Imprimir</span>
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onLogout}
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

interface PortalWelcomeBannerProps {
  logoUrl?: string | null;
  clinicName?: string;
  entityName: string;
  variant?: "amber" | "teal";
}

export function PortalWelcomeBanner({
  logoUrl,
  clinicName,
  entityName,
  variant = "amber"
}: PortalWelcomeBannerProps) {
  const gradientClass = variant === "teal" 
    ? "from-teal-600 to-cyan-600" 
    : "from-amber-500 to-orange-600";
  
  return (
    <div className={`bg-gradient-to-r ${gradientClass} rounded-2xl p-6 text-white shadow-lg`}>
      <div className="flex items-center gap-4">
        {logoUrl ? (
          <img 
            src={logoUrl} 
            alt={clinicName || "Logo"} 
            className="h-16 w-16 object-contain bg-white rounded-xl p-2"
          />
        ) : (
          <div className="h-16 w-16 bg-white/20 rounded-xl flex items-center justify-center">
            <Building2 className="h-8 w-8" />
          </div>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Bem-vindo!</h1>
          <p className="text-sm sm:text-base text-white/90 mt-1">{entityName}</p>
          {clinicName && (
            <p className="text-xs text-white/70 mt-0.5">{clinicName}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface PortalServiceCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  color: "blue" | "green" | "purple" | "amber" | "teal" | "indigo" | "rose";
  badge?: string;
  disabled?: boolean;
}

export function PortalServiceCard({
  icon,
  title,
  description,
  onClick,
  color,
  badge,
  disabled
}: PortalServiceCardProps) {
  const colorStyles = {
    blue: "bg-blue-50 hover:bg-blue-100 border-blue-200 group-hover:border-blue-300",
    green: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 group-hover:border-emerald-300",
    purple: "bg-purple-50 hover:bg-purple-100 border-purple-200 group-hover:border-purple-300",
    amber: "bg-amber-50 hover:bg-amber-100 border-amber-200 group-hover:border-amber-300",
    teal: "bg-teal-50 hover:bg-teal-100 border-teal-200 group-hover:border-teal-300",
    indigo: "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 group-hover:border-indigo-300",
    rose: "bg-rose-50 hover:bg-rose-100 border-rose-200 group-hover:border-rose-300",
  };

  const iconColorStyles = {
    blue: "text-blue-600 bg-blue-100",
    green: "text-emerald-600 bg-emerald-100",
    purple: "text-purple-600 bg-purple-100",
    amber: "text-amber-600 bg-amber-100",
    teal: "text-teal-600 bg-teal-100",
    indigo: "text-indigo-600 bg-indigo-100",
    rose: "text-rose-600 bg-rose-100",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative p-5 rounded-xl border-2 transition-all duration-200 text-left w-full ${
        colorStyles[color]
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:shadow-md hover:-translate-y-0.5"}`}
    >
      {badge && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${iconColorStyles[color]}`}>
        {icon}
      </div>
      <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </button>
  );
}

interface PortalQuickActionProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  color?: string;
}

export function PortalQuickAction({ icon, label, onClick, color = "text-slate-600" }: PortalQuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
    >
      <div className={`${color}`}>{icon}</div>
      <span className="text-xs font-medium text-slate-700">{label}</span>
    </button>
  );
}

interface PortalContainerProps {
  children: ReactNode;
}

export function PortalContainer({ children }: PortalContainerProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {children}
    </div>
  );
}

interface PortalMainProps {
  children: ReactNode;
}

export function PortalMain({ children }: PortalMainProps) {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {children}
    </main>
  );
}
