import { useEffect, useState } from "react";
import { Calendar, Plus, Trash2, Loader2, CalendarOff, Globe, MapPin, Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RoleGuard } from "@/components/auth/RoleGuard";

interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  is_recurring: boolean;
  recurring_month: number | null;
  recurring_day: number | null;
  created_at: string;
}

interface ClinicHoliday extends Holiday {
  clinic_id: string;
}

const BRAZILIAN_STATES = [
  { code: "AC", name: "Acre" },
  { code: "AL", name: "Alagoas" },
  { code: "AP", name: "Amapá" },
  { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },
  { code: "MA", name: "Maranhão" },
  { code: "MT", name: "Mato Grosso" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" },
  { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" },
  { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" },
  { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" },
  { code: "SE", name: "Sergipe" },
  { code: "TO", name: "Tocantins" },
];

export default function HolidaysPage() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [holidaysEnabled, setHolidaysEnabled] = useState(true);
  const [stateCode, setStateCode] = useState<string | null>(null);
  const [city, setCity] = useState<string>("");

  const [nationalHolidays, setNationalHolidays] = useState<Holiday[]>([]);
  const [stateHolidays, setStateHolidays] = useState<Holiday[]>([]);
  const [municipalHolidays, setMunicipalHolidays] = useState<Holiday[]>([]);
  const [clinicHolidays, setClinicHolidays] = useState<ClinicHoliday[]>([]);

  const [clinicDialogOpen, setClinicDialogOpen] = useState(false);
  const [stateDialogOpen, setStateDialogOpen] = useState(false);
  const [municipalDialogOpen, setMunicipalDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<{ id: string; name: string; type: "clinic" | "state" | "municipal" } | null>(null);

  // Form state
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayRecurring, setNewHolidayRecurring] = useState(false);
  const [newHolidayStateCode, setNewHolidayStateCode] = useState<string>("");
  const [newHolidayCity, setNewHolidayCity] = useState<string>("");

  useEffect(() => {
    if (currentClinic) {
      fetchClinicSettings();
      fetchAllHolidays();
    }
  }, [currentClinic]);

  const fetchClinicSettings = async () => {
    if (!currentClinic) return;

    try {
      const { data, error } = await supabase
        .from("clinics")
        .select("holidays_enabled, state_code, city")
        .eq("id", currentClinic.id)
        .single();

      if (error) throw error;

      setHolidaysEnabled(data.holidays_enabled ?? true);
      setStateCode(data.state_code);
      setCity(data.city || "");
    } catch (error) {
      console.error("Error fetching clinic settings:", error);
    }
  };

  const fetchAllHolidays = async () => {
    if (!currentClinic) return;

    setLoading(true);
    try {
      // Fetch national holidays
      const { data: national } = await supabase
        .from("national_holidays")
        .select("*")
        .order("holiday_date");
      setNationalHolidays(national || []);

      // Fetch state holidays based on clinic state
      if (stateCode) {
        const { data: state } = await supabase
          .from("state_holidays")
          .select("*")
          .eq("state_code", stateCode)
          .order("holiday_date");
        setStateHolidays(state || []);
      }

      // Fetch municipal holidays
      if (stateCode && city) {
        const { data: municipal } = await supabase
          .from("municipal_holidays")
          .select("*")
          .eq("state_code", stateCode)
          .eq("city", city)
          .order("holiday_date");
        setMunicipalHolidays(municipal || []);
      }

      // Fetch clinic custom holidays
      const { data: clinic } = await supabase
        .from("clinic_holidays")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("holiday_date");
      setClinicHolidays(clinic || []);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveClinicSettings = async () => {
    if (!currentClinic) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("clinics")
        .update({
          holidays_enabled: holidaysEnabled,
          state_code: stateCode,
          city: city.trim() || null,
        })
        .eq("id", currentClinic.id);

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "As configurações de feriados foram atualizadas.",
      });

      // Reload holidays based on new settings
      fetchAllHolidays();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClinicHoliday = async () => {
    if (!currentClinic || !newHolidayName || !newHolidayDate) return;

    setSaving(true);
    try {
      const date = parseISO(newHolidayDate);
      const insertData: any = {
        clinic_id: currentClinic.id,
        name: newHolidayName.trim(),
        holiday_date: newHolidayDate,
        is_recurring: newHolidayRecurring,
      };

      if (newHolidayRecurring) {
        insertData.recurring_month = date.getMonth() + 1;
        insertData.recurring_day = date.getDate();
      }

      const { error } = await supabase.from("clinic_holidays").insert(insertData);

      if (error) throw error;

      toast({
        title: "Feriado cadastrado",
        description: "O feriado foi adicionado com sucesso.",
      });

      setClinicDialogOpen(false);
      resetForm();
      fetchAllHolidays();
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar",
        description: error.message?.includes("duplicate") 
          ? "Já existe um feriado nesta data." 
          : error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStateHoliday = async () => {
    if (!newHolidayName || !newHolidayDate || !newHolidayStateCode) return;

    setSaving(true);
    try {
      const date = parseISO(newHolidayDate);
      const insertData: any = {
        state_code: newHolidayStateCode,
        name: newHolidayName.trim(),
        holiday_date: newHolidayDate,
        is_recurring: newHolidayRecurring,
      };

      if (newHolidayRecurring) {
        insertData.recurring_month = date.getMonth() + 1;
        insertData.recurring_day = date.getDate();
      }

      const { error } = await supabase.from("state_holidays").insert(insertData);

      if (error) throw error;

      toast({
        title: "Feriado estadual cadastrado",
        description: "O feriado foi adicionado com sucesso.",
      });

      setStateDialogOpen(false);
      resetForm();
      fetchAllHolidays();
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar",
        description: error.message?.includes("duplicate") 
          ? "Já existe um feriado nesta data." 
          : error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMunicipalHoliday = async () => {
    if (!newHolidayName || !newHolidayDate || !newHolidayStateCode || !newHolidayCity) return;

    setSaving(true);
    try {
      const date = parseISO(newHolidayDate);
      const insertData: any = {
        state_code: newHolidayStateCode,
        city: newHolidayCity.trim(),
        name: newHolidayName.trim(),
        holiday_date: newHolidayDate,
        is_recurring: newHolidayRecurring,
      };

      if (newHolidayRecurring) {
        insertData.recurring_month = date.getMonth() + 1;
        insertData.recurring_day = date.getDate();
      }

      const { error } = await supabase.from("municipal_holidays").insert(insertData);

      if (error) throw error;

      toast({
        title: "Feriado municipal cadastrado",
        description: "O feriado foi adicionado com sucesso.",
      });

      setMunicipalDialogOpen(false);
      resetForm();
      fetchAllHolidays();
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar",
        description: error.message?.includes("duplicate") 
          ? "Já existe um feriado nesta data." 
          : error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!selectedHoliday) return;

    setSaving(true);
    try {
      const tableName = selectedHoliday.type === "clinic" 
        ? "clinic_holidays" 
        : selectedHoliday.type === "state" 
          ? "state_holidays" 
          : "municipal_holidays";

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", selectedHoliday.id);

      if (error) throw error;

      toast({
        title: "Feriado removido",
        description: "O feriado foi removido com sucesso.",
      });

      setDeleteDialogOpen(false);
      setSelectedHoliday(null);
      fetchAllHolidays();
    } catch (error: any) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setNewHolidayName("");
    setNewHolidayDate("");
    setNewHolidayRecurring(false);
    setNewHolidayStateCode("");
    setNewHolidayCity("");
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const HolidayTable = ({ holidays, type, showDelete = false, deleteType }: { 
    holidays: Holiday[]; 
    type: "nacional" | "estadual" | "municipal" | "clinica";
    showDelete?: boolean;
    deleteType?: "clinic" | "state" | "municipal";
  }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Data</TableHead>
          <TableHead>Recorrente</TableHead>
          {showDelete && <TableHead className="w-16"></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {holidays.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showDelete ? 4 : 3} className="text-center text-muted-foreground py-8">
              <CalendarOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Nenhum feriado cadastrado
            </TableCell>
          </TableRow>
        ) : (
          holidays.map((holiday) => (
            <TableRow key={holiday.id}>
              <TableCell className="font-medium">{holiday.name}</TableCell>
              <TableCell>{formatDate(holiday.holiday_date)}</TableCell>
              <TableCell>
                {holiday.is_recurring ? (
                  <Badge variant="secondary">Anual</Badge>
                ) : (
                  <Badge variant="outline">Único</Badge>
                )}
              </TableCell>
              {showDelete && deleteType && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedHoliday({ id: holiday.id, name: holiday.name, type: deleteType });
                      setDeleteDialogOpen(true);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <RoleGuard permission="manage_settings">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Feriados</h1>
            <p className="text-muted-foreground">
              Gerencie feriados que bloqueiam agendamentos
            </p>
          </div>
        </div>

        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Configuração da Clínica
            </CardTitle>
            <CardDescription>
              Configure estado e cidade para carregar feriados regionais automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <Label>Bloquear agendamentos em feriados</Label>
                <p className="text-sm text-muted-foreground">
                  Impede que consultas sejam marcadas em dias de feriado
                </p>
              </div>
              <Switch
                checked={holidaysEnabled}
                onCheckedChange={setHolidaysEnabled}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Estado</Label>
                <Select value={stateCode || ""} onValueChange={setStateCode}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map((state) => (
                      <SelectItem key={state.code} value={state.code}>
                        {state.name} ({state.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Cidade</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Nome da cidade"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={saveClinicSettings} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Configurações
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs de Feriados */}
        <Tabs defaultValue="national" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="national" className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Nacionais</span>
            </TabsTrigger>
            <TabsTrigger value="state" className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Estaduais</span>
            </TabsTrigger>
            <TabsTrigger value="municipal" className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Municipais</span>
            </TabsTrigger>
            <TabsTrigger value="clinic" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Clínica</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="national">
            <Card>
              <CardHeader>
                <CardTitle>Feriados Nacionais</CardTitle>
                <CardDescription>
                  Feriados oficiais do Brasil (gerenciados pelo sistema)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HolidayTable holidays={nationalHolidays} type="nacional" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="state">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Feriados Estaduais</CardTitle>
                  <CardDescription>
                    {stateCode 
                      ? `Feriados do estado ${BRAZILIAN_STATES.find(s => s.code === stateCode)?.name || stateCode}`
                      : "Configure o estado da clínica para ver os feriados estaduais"
                    }
                  </CardDescription>
                </div>
                <Dialog open={stateDialogOpen} onOpenChange={(open) => { setStateDialogOpen(open); if (!open) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Feriado Estadual
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Novo Feriado Estadual</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Estado</Label>
                        <Select value={newHolidayStateCode} onValueChange={setNewHolidayStateCode}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Selecione o estado" />
                          </SelectTrigger>
                          <SelectContent>
                            {BRAZILIAN_STATES.map((state) => (
                              <SelectItem key={state.code} value={state.code}>
                                {state.name} ({state.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Nome do Feriado</Label>
                        <Input
                          value={newHolidayName}
                          onChange={(e) => setNewHolidayName(e.target.value)}
                          placeholder="Ex: Revolução Constitucionalista"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label>Data</Label>
                        <Input
                          type="date"
                          value={newHolidayDate}
                          onChange={(e) => setNewHolidayDate(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={newHolidayRecurring}
                          onCheckedChange={setNewHolidayRecurring}
                        />
                        <Label>Repetir todos os anos</Label>
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setStateDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCreateStateHoliday} disabled={saving || !newHolidayName || !newHolidayDate || !newHolidayStateCode}>
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Cadastrar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {stateCode ? (
                  <HolidayTable holidays={stateHolidays} type="estadual" showDelete deleteType="state" />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Configure o estado nas configurações acima
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="municipal">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Feriados Municipais</CardTitle>
                  <CardDescription>
                    {city && stateCode
                      ? `Feriados de ${city} - ${stateCode}`
                      : "Configure estado e cidade para ver os feriados municipais"
                    }
                  </CardDescription>
                </div>
                <Dialog open={municipalDialogOpen} onOpenChange={(open) => { setMunicipalDialogOpen(open); if (!open) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Feriado Municipal
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Novo Feriado Municipal</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label>Estado</Label>
                          <Select value={newHolidayStateCode} onValueChange={setNewHolidayStateCode}>
                            <SelectTrigger className="mt-1.5">
                              <SelectValue placeholder="Selecione o estado" />
                            </SelectTrigger>
                            <SelectContent>
                              {BRAZILIAN_STATES.map((state) => (
                                <SelectItem key={state.code} value={state.code}>
                                  {state.name} ({state.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Cidade</Label>
                          <Input
                            value={newHolidayCity}
                            onChange={(e) => setNewHolidayCity(e.target.value)}
                            placeholder="Nome da cidade"
                            className="mt-1.5"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Nome do Feriado</Label>
                        <Input
                          value={newHolidayName}
                          onChange={(e) => setNewHolidayName(e.target.value)}
                          placeholder="Ex: Aniversário da Cidade"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label>Data</Label>
                        <Input
                          type="date"
                          value={newHolidayDate}
                          onChange={(e) => setNewHolidayDate(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={newHolidayRecurring}
                          onCheckedChange={setNewHolidayRecurring}
                        />
                        <Label>Repetir todos os anos</Label>
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setMunicipalDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCreateMunicipalHoliday} disabled={saving || !newHolidayName || !newHolidayDate || !newHolidayStateCode || !newHolidayCity}>
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Cadastrar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {city && stateCode ? (
                  <HolidayTable holidays={municipalHolidays} type="municipal" showDelete deleteType="municipal" />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Configure estado e cidade nas configurações acima
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clinic">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Feriados da Clínica</CardTitle>
                  <CardDescription>
                    Feriados customizados específicos desta clínica
                  </CardDescription>
                </div>
                <Dialog open={clinicDialogOpen} onOpenChange={(open) => { setClinicDialogOpen(open); if (!open) resetForm(); }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Feriado
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Novo Feriado da Clínica</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Nome do Feriado</Label>
                        <Input
                          value={newHolidayName}
                          onChange={(e) => setNewHolidayName(e.target.value)}
                          placeholder="Ex: Recesso Interno"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label>Data</Label>
                        <Input
                          type="date"
                          value={newHolidayDate}
                          onChange={(e) => setNewHolidayDate(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={newHolidayRecurring}
                          onCheckedChange={setNewHolidayRecurring}
                        />
                        <Label>Repetir todos os anos</Label>
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setClinicDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCreateClinicHoliday} disabled={saving || !newHolidayName || !newHolidayDate}>
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Cadastrar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <HolidayTable holidays={clinicHolidays} type="clinica" showDelete deleteType="clinic" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover Feriado</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover "{selectedHoliday?.name}"? 
                Isso permitirá agendamentos nesta data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteHoliday} className="bg-destructive text-destructive-foreground">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remover"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RoleGuard>
  );
}
