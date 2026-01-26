import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, Download, RefreshCw, Smartphone, Monitor, Tablet } from "lucide-react";
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
  } : null;

  const getPlatformIcon = (platform: string | null) => {
    switch (platform) {
      case "iOS":
      case "Android":
        return <Smartphone className="h-4 w-4" />;
      case "Windows":
      case "macOS":
      case "Linux":
        return <Monitor className="h-4 w-4" />;
      default:
        return <Tablet className="h-4 w-4" />;
    }
  };

  const getPlatformColor = (platform: string | null) => {
    switch (platform) {
      case "iOS":
        return "bg-gray-100 text-gray-800";
      case "Android":
        return "bg-green-100 text-green-800";
      case "Windows":
        return "bg-blue-100 text-blue-800";
      case "macOS":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const exportToCSV = () => {
    if (!installations) return;
    
    const headers = ["Data/Hora", "Plataforma", "Standalone", "Tela", "User Agent"];
    const rows = installations.map(i => [
      format(new Date(i.installed_at), "dd/MM/yyyy HH:mm"),
      i.platform || "Desconhecido",
      i.standalone ? "Sim" : "Não",
      i.device_info ? `${i.device_info.screenWidth}x${i.device_info.screenHeight}` : "-",
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Instalações do App</h1>
          <p className="text-muted-foreground">
            Histórico de instalações do PWA do Sindicato
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} - {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
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

          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button variant="outline" onClick={exportToCSV} disabled={!installations?.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? <Skeleton className="h-9 w-16" /> : stats?.total || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>iOS</CardDescription>
            <CardTitle className="text-3xl text-gray-600">
              {isLoading ? <Skeleton className="h-9 w-16" /> : stats?.ios || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Android</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {isLoading ? <Skeleton className="h-9 w-16" /> : stats?.android || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Desktop</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {isLoading ? <Skeleton className="h-9 w-16" /> : stats?.desktop || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Standalone</CardDescription>
            <CardTitle className="text-3xl text-purple-600">
              {isLoading ? <Skeleton className="h-9 w-16" /> : stats?.standalone || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Instalações</CardTitle>
          <CardDescription>
            Lista detalhada de todas as instalações do app
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !installations?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma instalação registrada no período selecionado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Tela</TableHead>
                  <TableHead>Standalone</TableHead>
                  <TableHead className="hidden md:table-cell">Idioma</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installations.map((install) => (
                  <TableRow key={install.id}>
                    <TableCell>
                      <div className="font-medium">
                        {format(new Date(install.installed_at), "dd/MM/yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(install.installed_at), "HH:mm:ss")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={cn("gap-1", getPlatformColor(install.platform))}
                      >
                        {getPlatformIcon(install.platform)}
                        {install.platform || "Desconhecido"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {install.device_info ? (
                        <span className="text-sm">
                          {String(install.device_info.screenWidth)}x{String(install.device_info.screenHeight)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {install.standalone ? (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Sim
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Não</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {install.device_info?.language ? String(install.device_info.language) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
