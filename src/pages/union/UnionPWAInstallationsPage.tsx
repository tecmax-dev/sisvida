import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  CalendarIcon, 
  Download, 
  RefreshCw, 
  Smartphone, 
  Monitor, 
  TrendingUp,
  Users,
  CheckCircle2,
  Apple,
  Chrome,
  Globe,
  Clock,
  Zap,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50];

interface PWAInstallation {
  id: string;
  platform: string | null;
  user_agent: string | null;
  standalone: boolean | null;
  installed_at: string;
  device_info: Record<string, unknown> | null;
}

export default function UnionPWAInstallationsPage() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<"cards" | "compact">("cards");

  const { data: installations, isLoading, refetch } = useQuery({
    queryKey: ["pwa-installations", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pwa_installations")
        .select("*")
        .eq("clinic_id", TARGET_CLINIC_ID)
        .gte("installed_at", startOfDay(dateRange.from).toISOString())
        .lte("installed_at", endOfDay(dateRange.to).toISOString())
        .order("installed_at", { ascending: false });

      if (error) throw error;
      return data as PWAInstallation[];
    },
  });

  // Reset page when changing items per page or date range
  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const stats = installations ? {
    total: installations.length,
    ios: installations.filter(i => i.platform === "iOS").length,
    android: installations.filter(i => i.platform === "Android").length,
    desktop: installations.filter(i => ["Windows", "macOS", "Linux"].includes(i.platform || "")).length,
    standalone: installations.filter(i => i.standalone).length,
    browser: installations.filter(i => !i.standalone).length,
    today: installations.filter(i => {
      const installDate = new Date(i.installed_at);
      const today = new Date();
      return installDate.toDateString() === today.toDateString();
    }).length,
    thisWeek: installations.filter(i => {
      const installDate = new Date(i.installed_at);
      return differenceInDays(new Date(), installDate) <= 7;
    }).length,
  } : null;

  // Pagination
  const totalPages = Math.ceil((installations?.length || 0) / itemsPerPage);
  const paginatedInstallations = installations?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getPlatformIcon = (platform: string | null) => {
    switch (platform) {
      case "iOS":
        return <Apple className="h-3.5 w-3.5" />;
      case "Android":
        return <Chrome className="h-3.5 w-3.5" />;
      case "Windows":
      case "macOS":
      case "Linux":
        return <Monitor className="h-3.5 w-3.5" />;
      default:
        return <Globe className="h-3.5 w-3.5" />;
    }
  };

  const getPlatformColor = (platform: string | null) => {
    switch (platform) {
      case "iOS":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "Android":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Windows":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "macOS":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const exportToCSV = () => {
    if (!installations) return;
    
    const headers = ["Data/Hora", "Plataforma", "Standalone", "Tela", "Idioma", "User Agent"];
    const rows = installations.map(i => [
      format(new Date(i.installed_at), "dd/MM/yyyy HH:mm"),
      i.platform || "Desconhecido",
      i.standalone ? "Sim" : "Não",
      i.device_info ? `${i.device_info.screenWidth}x${i.device_info.screenHeight}` : "-",
      i.device_info?.language ? String(i.device_info.language) : "-",
      i.user_agent || "-",
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `instalacoes-pwa-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const mobilePercent = stats && stats.total > 0 
    ? Math.round(((stats.ios + stats.android) / stats.total) * 100) 
    : 0;
  const standalonePercent = stats && stats.total > 0 
    ? Math.round((stats.standalone / stats.total) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      {/* Header Compacto */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
            <Download className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Instalações do App</h1>
            <p className="text-sm text-muted-foreground">
              Métricas e histórico de instalações PWA
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards - Grid compacto */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total</p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Skeleton className="h-8 w-12" /> : stats?.total || 0}
                </p>
              </div>
              <Users className="h-5 w-5 text-primary opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Hoje</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {isLoading ? <Skeleton className="h-8 w-12" /> : stats?.today || 0}
                </p>
              </div>
              <Zap className="h-5 w-5 text-emerald-500 opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">7 dias</p>
                <p className="text-2xl font-bold text-blue-600">
                  {isLoading ? <Skeleton className="h-8 w-12" /> : stats?.thisWeek || 0}
                </p>
              </div>
              <TrendingUp className="h-5 w-5 text-blue-500 opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Instalados</p>
                <p className="text-2xl font-bold text-purple-600">
                  {isLoading ? <Skeleton className="h-8 w-12" /> : `${standalonePercent}%`}
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-purple-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Métricas de Plataforma - Compacto */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                Dispositivos Móveis
              </span>
              <span className="text-sm font-bold">{mobilePercent}%</span>
            </div>
            <Progress value={mobilePercent} className="h-2" />
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Apple className="h-3 w-3" /> iOS: {stats?.ios || 0}
              </span>
              <span className="flex items-center gap-1">
                <Chrome className="h-3 w-3" /> Android: {stats?.android || 0}
              </span>
              <span className="flex items-center gap-1">
                <Monitor className="h-3 w-3" /> Desktop: {stats?.desktop || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Download className="h-4 w-4 text-emerald-600" />
                Instalação Completa
              </span>
              <span className="text-sm font-bold">{standalonePercent}%</span>
            </div>
            <Progress value={standalonePercent} className="h-2 [&>div]:bg-emerald-500" />
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> 
                Standalone: {stats?.standalone || 0}
              </span>
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" /> 
                Browser: {stats?.browser || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Instalações */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Histórico</CardTitle>
              <CardDescription className="text-xs">
                {installations?.length || 0} instalações no período
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date Range Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {format(dateRange.from, "dd/MM", { locale: ptBR })} - {format(dateRange.to, "dd/MM", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                        setCurrentPage(1);
                      }
                    }}
                    locale={ptBR}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              {/* View Toggle */}
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === "cards" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-2 rounded-r-none"
                  onClick={() => setViewMode("cards")}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant={viewMode === "compact" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-2 rounded-l-none"
                  onClick={() => setViewMode("compact")}
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportToCSV} disabled={!installations?.length}>
                <Download className="h-3.5 w-3.5 mr-1" />
                CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !installations?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Smartphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma instalação registrada</p>
              <p className="text-xs">no período selecionado</p>
            </div>
          ) : viewMode === "cards" ? (
            /* Cards View - Visual e amigável */
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedInstallations?.map((install) => (
                <div 
                  key={install.id} 
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                    install.platform === "iOS" ? "bg-slate-100" :
                    install.platform === "Android" ? "bg-emerald-50" :
                    "bg-blue-50"
                  )}>
                    {getPlatformIcon(install.platform)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn("text-[10px] h-5 shrink-0", getPlatformColor(install.platform))}
                      >
                        {install.platform || "N/A"}
                      </Badge>
                      {install.standalone && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(install.installed_at), "dd/MM HH:mm")}
                      {install.device_info && (
                        <span className="text-[10px]">
                          • {String(install.device_info.screenWidth)}×{String(install.device_info.screenHeight)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Compact List View */
            <div className="space-y-1">
              {paginatedInstallations?.map((install) => (
                <div 
                  key={install.id} 
                  className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50 transition-colors text-sm"
                >
                  <div className="flex items-center gap-3">
                    {getPlatformIcon(install.platform)}
                    <Badge 
                      variant="outline" 
                      className={cn("text-[10px] h-5", getPlatformColor(install.platform))}
                    >
                      {install.platform || "N/A"}
                    </Badge>
                    {install.standalone && (
                      <Badge variant="outline" className="text-[10px] h-5 bg-emerald-50 text-emerald-700 border-emerald-200">
                        Instalado
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {install.device_info && (
                      <span>{String(install.device_info.screenWidth)}×{String(install.device_info.screenHeight)}</span>
                    )}
                    <span>{format(new Date(install.installed_at), "dd/MM HH:mm")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginação */}
          {installations && installations.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Exibir</span>
                <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                  <SelectTrigger className="h-7 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEMS_PER_PAGE_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={String(opt)} className="text-xs">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>de {installations.length} registros</span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "ghost"}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
