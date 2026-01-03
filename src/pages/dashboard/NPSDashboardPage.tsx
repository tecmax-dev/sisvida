import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, TrendingUp, TrendingDown, Minus, MessageSquare, Star, Settings, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RoleGuard } from "@/components/auth/RoleGuard";

interface NPSStats {
  total: number;
  responded: number;
  avgScore: number;
  promoters: number;
  passives: number;
  detractors: number;
  npsScore: number;
}

export default function NPSDashboardPage() {
  const { currentClinic } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    is_enabled: false,
    delay_hours: 2,
    message_template: "Olá {nome}! 😊\n\nComo foi seu atendimento na {clinica}?\n\nAvalie de 0 a 10 clicando no link abaixo:\n{link}\n\nSua opinião é muito importante para nós!",
  });
  const [surveys, setSurveys] = useState<any[]>([]);
  const [stats, setStats] = useState<NPSStats>({
    total: 0,
    responded: 0,
    avgScore: 0,
    promoters: 0,
    passives: 0,
    detractors: 0,
    npsScore: 0,
  });

  useEffect(() => {
    if (currentClinic?.id) {
      loadData();
    }
  }, [currentClinic?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load settings
      const { data: settingsData } = await supabase
        .from("nps_settings")
        .select("*")
        .eq("clinic_id", currentClinic?.id)
        .single();

      if (settingsData) {
        setSettings({
          is_enabled: settingsData.is_enabled || false,
          delay_hours: settingsData.delay_hours || 2,
          message_template: settingsData.message_template || settings.message_template,
        });
      }

      // Load surveys
      const { data: surveysData } = await supabase
        .from("nps_surveys")
        .select(`
          *,
          patients:patient_id (name),
          professionals:professional_id (name)
        `)
        .eq("clinic_id", currentClinic?.id)
        .order("created_at", { ascending: false })
        .limit(100);

      setSurveys(surveysData || []);

      // Calculate stats
      const responded = (surveysData || []).filter(s => s.responded_at);
      const scores = responded.map(s => s.score);
      
      const promoters = scores.filter(s => s >= 9).length;
      const passives = scores.filter(s => s >= 7 && s <= 8).length;
      const detractors = scores.filter(s => s <= 6).length;
      
      const avgScore = scores.length > 0 
        ? scores.reduce((a, b) => a + b, 0) / scores.length 
        : 0;
      
      const npsScore = responded.length > 0
        ? Math.round(((promoters - detractors) / responded.length) * 100)
        : 0;

      setStats({
        total: (surveysData || []).length,
        responded: responded.length,
        avgScore: Math.round(avgScore * 10) / 10,
        promoters,
        passives,
        detractors,
        npsScore,
      });
    } catch (error) {
      console.error("Error loading NPS data:", error);
      toast.error("Erro ao carregar dados NPS");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("nps_settings")
        .upsert({
          clinic_id: currentClinic?.id,
          is_enabled: settings.is_enabled,
          delay_hours: settings.delay_hours,
          message_template: settings.message_template,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "clinic_id",
        });

      if (error) throw error;
      toast.success("Configurações salvas");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 9) return <Badge className="bg-green-500">Promotor</Badge>;
    if (score >= 7) return <Badge className="bg-yellow-500">Neutro</Badge>;
    return <Badge className="bg-red-500">Detrator</Badge>;
  };

  const getNPSColor = (nps: number) => {
    if (nps >= 50) return "text-green-500";
    if (nps >= 0) return "text-yellow-500";
    return "text-red-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <RoleGuard permission="view_reports">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pesquisa NPS</h1>
          <p className="text-muted-foreground">
            Acompanhe a satisfação dos associados após os atendimentos
          </p>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="responses">
              <MessageSquare className="h-4 w-4 mr-2" />
              Respostas
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    NPS Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${getNPSColor(stats.npsScore)}`}>
                    {stats.npsScore}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    -100 a 100
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Média de Avaliação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold flex items-center gap-2">
                    <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                    {stats.avgScore}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    de 0 a 10
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Taxa de Resposta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {stats.total > 0 ? Math.round((stats.responded / stats.total) * 100) : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.responded} de {stats.total} enviadas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Distribuição
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span>{stats.promoters}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Minus className="h-4 w-4 text-yellow-500" />
                      <span>{stats.passives}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      <span>{stats.detractors}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Promotores / Neutros / Detratores
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* NPS Scale Visual */}
            <Card>
              <CardHeader>
                <CardTitle>Escala NPS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-8 flex rounded-lg overflow-hidden">
                  <div 
                    className="bg-red-500 flex items-center justify-center text-white text-sm font-medium"
                    style={{ width: `${stats.responded > 0 ? (stats.detractors / stats.responded) * 100 : 33}%` }}
                  >
                    {stats.detractors > 0 && `${Math.round((stats.detractors / stats.responded) * 100)}%`}
                  </div>
                  <div 
                    className="bg-yellow-500 flex items-center justify-center text-white text-sm font-medium"
                    style={{ width: `${stats.responded > 0 ? (stats.passives / stats.responded) * 100 : 34}%` }}
                  >
                    {stats.passives > 0 && `${Math.round((stats.passives / stats.responded) * 100)}%`}
                  </div>
                  <div 
                    className="bg-green-500 flex items-center justify-center text-white text-sm font-medium"
                    style={{ width: `${stats.responded > 0 ? (stats.promoters / stats.responded) * 100 : 33}%` }}
                  >
                    {stats.promoters > 0 && `${Math.round((stats.promoters / stats.responded) * 100)}%`}
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>Detratores (0-6)</span>
                  <span>Neutros (7-8)</span>
                  <span>Promotores (9-10)</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="responses" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Respostas Recentes</CardTitle>
                <CardDescription>
                  Últimas avaliações recebidas dos associados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Associado</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead>Nota</TableHead>
                      <TableHead>Feedback</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surveys.filter(s => s.responded_at).map((survey) => (
                      <TableRow key={survey.id}>
                        <TableCell>{survey.patients?.name || "-"}</TableCell>
                        <TableCell>{survey.professionals?.name || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{survey.score}</span>
                            {getScoreBadge(survey.score)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {survey.feedback || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          {format(new Date(survey.responded_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                    {surveys.filter(s => s.responded_at).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhuma resposta recebida ainda
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Configurações NPS</CardTitle>
                <CardDescription>
                  Configure o envio automático de pesquisas após atendimentos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Ativar Pesquisa NPS</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar pesquisa de satisfação após cada atendimento
                    </p>
                  </div>
                  <Switch
                    checked={settings.is_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, is_enabled: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Delay (horas após atendimento)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={72}
                    value={settings.delay_hours}
                    onChange={(e) => setSettings({ ...settings, delay_hours: parseInt(e.target.value) || 2 })}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tempo de espera após finalizar o atendimento
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Mensagem WhatsApp</Label>
                  <Textarea
                    value={settings.message_template}
                    onChange={(e) => setSettings({ ...settings, message_template: e.target.value })}
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variáveis: {"{nome}"} (nome do paciente), {"{clinica}"} (nome da clínica), {"{link}"} (link da pesquisa)
                  </p>
                </div>

                <Button onClick={saveSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Configurações"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}
