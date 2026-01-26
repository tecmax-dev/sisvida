import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  CalendarIcon, 
  Download, 
  RefreshCw, 
  Smartphone, 
  Monitor, 
  Tablet,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  Apple,
  Chrome,
  Globe,
  BarChart3,
  Clock,
  Zap,
  Info
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

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
  const [activeTab, setActiveTab] = useState("visao-geral");

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

  const getPlatformBadge = (platform: string | null) => {
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
        <Badge variant="outline" className="gap-1">
          <BarChart3 className="h-3 w-3" />
          Analytics
        </Badge>
      </div>

      {/* Filtros e Ações */}
      <Card className="border-dashed">
        <CardContent className="py-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {format(dateRange.from, "dd/MM", { locale: ptBR })} - {format(dateRange.to, "dd/MM", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    locale={ptBR}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              <Button variant="ghost" size="sm" className="h-8" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {differenceInDays(dateRange.to, dateRange.from)} dias
              </Badge>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportToCSV} disabled={!installations?.length}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="visao-geral" className="text-xs">
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="plataformas" className="text-xs">
            <Smartphone className="h-3.5 w-3.5 mr-1.5" />
            Plataformas
          </TabsTrigger>
          <TabsTrigger value="historico" className="text-xs">
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Tab: Visão Geral */}
        <TabsContent value="visao-geral" className="space-y-4 mt-4">
          {/* Stats Cards Compactos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">
                      {isLoading ? <Skeleton className="h-8 w-12" /> : stats?.total || 0}
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Hoje</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {isLoading ? <Skeleton className="h-8 w-12" /> : stats?.today || 0}
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {isLoading ? <Skeleton className="h-8 w-12" /> : stats?.thisWeek || 0}
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Standalone</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {isLoading ? <Skeleton className="h-8 w-12" /> : `${standalonePercent}%`}
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos de Progresso */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  Taxa de Mobile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Dispositivos móveis</span>
                  <span className="font-medium">{mobilePercent}%</span>
                </div>
                <Progress value={mobilePercent} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>iOS: {stats?.ios || 0}</span>
                  <span>Android: {stats?.android || 0}</span>
                  <span>Desktop: {stats?.desktop || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Download className="h-4 w-4 text-emerald-600" />
                  Instalação Completa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Modo Standalone</span>
                  <span className="font-medium">{standalonePercent}%</span>
                </div>
                <Progress value={standalonePercent} className="h-2 [&>div]:bg-emerald-500" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    Instalado: {stats?.standalone || 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-muted-foreground" />
                    Browser: {stats?.browser || 0}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Info Card */}
          <Card className="bg-muted/30">
            <CardContent className="py-3">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Standalone:</strong> Instalação completa na tela inicial do dispositivo</p>
                  <p><strong>Browser:</strong> Acesso via navegador sem instalação</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Plataformas */}
        <TabsContent value="plataformas" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Apple className="h-4 w-4" />
                    iOS
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {stats?.ios || 0}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Progress 
                  value={stats && stats.total > 0 ? (stats.ios / stats.total) * 100 : 0} 
                  className="h-1.5 [&>div]:bg-slate-500" 
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {stats && stats.total > 0 ? Math.round((stats.ios / stats.total) * 100) : 0}% do total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Chrome className="h-4 w-4 text-emerald-600" />
                    Android
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700">
                    {stats?.android || 0}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Progress 
                  value={stats && stats.total > 0 ? (stats.android / stats.total) * 100 : 0} 
                  className="h-1.5 [&>div]:bg-emerald-500" 
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {stats && stats.total > 0 ? Math.round((stats.android / stats.total) * 100) : 0}% do total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-blue-600" />
                    Desktop
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                    {stats?.desktop || 0}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Progress 
                  value={stats && stats.total > 0 ? (stats.desktop / stats.total) * 100 : 0} 
                  className="h-1.5 [&>div]:bg-blue-500" 
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {stats && stats.total > 0 ? Math.round((stats.desktop / stats.total) * 100) : 0}% do total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Globe className="h-4 w-4 text-amber-600" />
                    Outros
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700">
                    {stats ? stats.total - stats.ios - stats.android - stats.desktop : 0}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Progress 
                  value={stats && stats.total > 0 ? ((stats.total - stats.ios - stats.android - stats.desktop) / stats.total) * 100 : 0} 
                  className="h-1.5 [&>div]:bg-amber-500" 
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {stats && stats.total > 0 ? Math.round(((stats.total - stats.ios - stats.android - stats.desktop) / stats.total) * 100) : 0}% do total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Legenda de Plataformas */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Legenda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-slate-500" />
                  <span>iOS (iPhone/iPad)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-emerald-500" />
                  <span>Android</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-blue-500" />
                  <span>Windows/macOS/Linux</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-amber-500" />
                  <span>Outros/Desconhecido</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Histórico */}
        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Histórico de Instalações</CardTitle>
                  <CardDescription className="text-xs">
                    {installations?.length || 0} registros no período selecionado
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportToCSV} disabled={!installations?.length}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Exportar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !installations?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Smartphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhuma instalação registrada</p>
                  <p className="text-xs">no período selecionado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs h-9">Data</TableHead>
                        <TableHead className="text-xs h-9">Plataforma</TableHead>
                        <TableHead className="text-xs h-9">Tela</TableHead>
                        <TableHead className="text-xs h-9">Status</TableHead>
                        <TableHead className="text-xs h-9 hidden lg:table-cell">Idioma</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {installations.map((install) => (
                        <TableRow key={install.id} className="text-xs">
                          <TableCell className="py-2">
                            <div className="font-medium">
                              {format(new Date(install.installed_at), "dd/MM/yy")}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {format(new Date(install.installed_at), "HH:mm")}
                            </div>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge 
                              variant="outline" 
                              className={cn("gap-1 text-[10px] h-5", getPlatformBadge(install.platform))}
                            >
                              {getPlatformIcon(install.platform)}
                              {install.platform || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-muted-foreground">
                            {install.device_info ? (
                              <span className="text-[10px]">
                                {String(install.device_info.screenWidth)}×{String(install.device_info.screenHeight)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="py-2">
                            {install.standalone ? (
                              <Badge variant="outline" className="text-[10px] h-5 bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Instalado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-5 gap-1">
                                <Globe className="h-3 w-3" />
                                Browser
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-2 hidden lg:table-cell text-muted-foreground">
                            {install.device_info?.language ? String(install.device_info.language) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
