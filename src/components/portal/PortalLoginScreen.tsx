import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Loader2, Lock, Mail } from "lucide-react";

interface PortalLoginScreenProps {
  logoUrl?: string | null;
  clinicName?: string;
  title: string;
  subtitle: string;
  variant: "employer" | "accounting";
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  fields: {
    identifier: {
      label: string;
      placeholder: string;
      value: string;
      onChange: (value: string) => void;
      icon: ReactNode;
      type?: string;
    };
    accessCode: {
      value: string;
      onChange: (value: string) => void;
    };
  };
  helpText?: string;
}

export function PortalLoginScreen({
  logoUrl,
  clinicName,
  title,
  subtitle,
  variant,
  isLoading,
  onSubmit,
  fields,
  helpText
}: PortalLoginScreenProps) {
  const gradientClass = variant === "accounting" 
    ? "from-teal-600 to-cyan-600 shadow-teal-500/25"
    : "from-amber-500 to-orange-600 shadow-amber-500/25";

  const focusClass = variant === "accounting"
    ? "focus:border-teal-500 focus:ring-teal-500"
    : "focus:border-amber-500 focus:ring-amber-500";

  const iconBgClass = variant === "accounting"
    ? "from-teal-500 to-cyan-600"
    : "from-amber-500 to-orange-600";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
      
      <Card className="w-full max-w-md relative bg-white/95 backdrop-blur shadow-2xl border-0">
        <CardHeader className="text-center space-y-4 pb-2">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={clinicName} 
              className="h-16 mx-auto object-contain"
            />
          ) : (
            <div className={`h-16 w-16 mx-auto bg-gradient-to-br ${iconBgClass} rounded-xl flex items-center justify-center shadow-lg`}>
              <Building2 className="h-8 w-8 text-white" />
            </div>
          )}
          <div>
            <CardTitle className="text-xl font-semibold text-slate-800">{title}</CardTitle>
            <CardDescription className="text-slate-500">
              {clinicName || subtitle}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-slate-700 text-sm font-medium">
                {fields.identifier.label}
              </Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400">
                  {fields.identifier.icon}
                </div>
                <Input
                  id="identifier"
                  type={fields.identifier.type || "text"}
                  placeholder={fields.identifier.placeholder}
                  value={fields.identifier.value}
                  onChange={(e) => fields.identifier.onChange(e.target.value)}
                  className={`pl-10 h-11 border-slate-200 ${focusClass}`}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="accessCode" className="text-slate-700 text-sm font-medium">
                Código de Acesso
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="accessCode"
                  type="text"
                  placeholder="XXXXXXXX"
                  value={fields.accessCode.value}
                  onChange={(e) => fields.accessCode.onChange(e.target.value.toUpperCase())}
                  className={`pl-10 h-11 uppercase tracking-widest font-mono border-slate-200 ${focusClass}`}
                  maxLength={10}
                  required
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className={`w-full h-11 bg-gradient-to-r ${gradientClass} hover:opacity-90 text-white font-medium shadow-lg`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Acessar Portal"
              )}
            </Button>

            {helpText && (
              <p className="text-xs text-center text-slate-500 pt-2">
                {helpText}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
