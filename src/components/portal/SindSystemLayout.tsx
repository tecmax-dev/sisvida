import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, ChevronDown, Bell, RotateCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    <header className="bg-[#2c5282] text-white sticky top-0 z-20">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="h-8 object-contain brightness-0 invert"
            />
          ) : (
            <span className="font-bold text-lg">SindSystem</span>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <Bell className="h-5 w-5 text-white/80 cursor-pointer hover:text-white" />
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-green-400 rounded-full" />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-tight truncate max-w-[200px]">
                {entityName.length > 20 ? entityName.substring(0, 17) + "..." : entityName}
              </p>
              {entityEmail && (
                <p className="text-xs text-white/70 truncate max-w-[200px]">
                  {entityEmail.length > 25 ? entityEmail.substring(0, 22) + "..." : entityEmail}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1"
          >
            <LogOut className="h-5 w-5" />
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
    <div className="min-h-screen bg-[#f5f5f5]">
      {children}
    </div>
  );
}

interface SindSystemMainProps {
  children: ReactNode;
}

export function SindSystemMain({ children }: SindSystemMainProps) {
  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
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
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="text-amber-500 mt-0.5">{icon}</span>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            {title}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 text-slate-700 border-slate-300 hover:bg-slate-50">
            Opções
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onBack && (
            <DropdownMenuItem onClick={onBack} className="cursor-pointer">
              <RotateCw className="h-4 w-4 mr-2" />
              Voltar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface SindSystemServiceCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  color: "green" | "blue" | "orange";
}

export function SindSystemServiceCard({
  icon,
  title,
  description,
  onClick,
  color,
}: SindSystemServiceCardProps) {
  const colorStyles = {
    green: "bg-[#20c997]",
    blue: "bg-[#2c7be5]",
    orange: "bg-[#e8a838]",
  };

  return (
    <button
      onClick={onClick}
      className={`${colorStyles[color]} rounded-lg p-8 text-white flex flex-col items-center justify-center text-center min-h-[180px] w-full transition-all hover:opacity-90 hover:shadow-lg`}
    >
      <div className="mb-4">{icon}</div>
      <h3 className="font-bold text-lg uppercase tracking-wide">{title}</h3>
      <p className="text-sm text-white/90 mt-1">{description}</p>
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
      className="bg-[#2c7be5] hover:bg-[#2566bf] text-white gap-2"
    >
      <RotateCw className="h-4 w-4" />
      Voltar
    </Button>
  );
}
