import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Mail, Send, Users, Building2, Briefcase, Eye, RefreshCw,
  CheckCircle2, AlertCircle, Clock, XCircle, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TargetType = "associados" | "empresas" | "escritorios" | "custom";

interface RecipientPreview {
  id?: string;
  name: string;
  email: string;
  extra?: Record<string, any>;
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  target_type: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; cls: string; icon: any }> = {
  draft: { label: "Rascunho", cls: "bg-slate-100 text-slate-700", icon: Clock },
  queued: { label: "Na fila", cls: "bg-blue-100 text-blue-700", icon: Clock },
  sending: { label: "Enviando", cls: "bg-amber-100 text-amber-800", icon: Loader2 },
  completed: { label: "Concluída", cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  failed: { label: "Falha", cls: "bg-red-100 text-red-700", icon: XCircle },
  cancelled: { label: "Cancelada", cls: "bg-slate-100 text-slate-500", icon: XCircle },
};

export default function UnionEmailMarketingPage() {
  const { currentClinic } = useAuth();
  const clinicId = currentClinic?.id;

  const [tab, setTab] = useState<"compose" | "history">("compose");

  // Compose state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState(DEFAULT_TEMPLATE);
  const [targetType, setTargetType] = useState<TargetType>("associados");

  // Filters
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterCity, setFilterCity] = useState("");
  const [filterActive, setFilterActive] = useState<string>("active");
  const [filterEmployerId, setFilterEmployerId] = useState<string>("all");
  const [customEmails, setCustomEmails] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRecipients, setPreviewRecipients] = useState<RecipientPreview[]>([]);

  const [sending, setSending] = useState(false);

  // History
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [detailRecipients, setDetailRecipients] = useState<any[]>([]);

  // Lookups
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [employers, setEmployers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      const [{ data: plansData }, { data: empData }] = await Promise.all([
        (supabase as any).from("insurance_plans").select("id, name").eq("clinic_id", clinicId).order("name"),
        supabase.from("employers").select("id, name").eq("clinic_id", clinicId).order("name").limit(500),
      ]);
      setPlans((plansData as any) || []);
      setEmployers((empData as any) || []);
    })();
    loadCampaigns();
  }, [clinicId]);

  async function loadCampaigns() {
    if (!clinicId) return;
    setCampaignsLoading(true);
    const { data } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(100);
    setCampaigns((data || []) as any);
    setCampaignsLoading(false);
  }

  async function fetchAllPages<T>(
    builder: (from: number, to: number) => any
  ): Promise<T[]> {
    const all: T[] = [];
    const pageSize = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await builder(from, from + pageSize - 1);
      if (error) throw error;
      const rows = (data || []) as T[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return all;
  }

  async function buildRecipients(): Promise<RecipientPreview[]> {
    if (!clinicId) return [];

    if (targetType === "custom") {
      const lines = customEmails
        .split(/[\n,;]+/)
        .map((l) => l.trim())
        .filter(Boolean);
      return lines.map((line) => {
        const [maybeName, maybeEmail] = line.split(/[<>]/).map((s) => s.trim()).filter(Boolean);
        const email = (maybeEmail || maybeName || "").trim();
        const name = maybeEmail ? maybeName : "";
        return { name: name || email, email };
      }).filter((r) => r.email.includes("@"));
    }

    if (targetType === "associados") {
      const rows: any[] = await fetchAllPages((from, to) => {
        let q = supabase
          .from("patients")
          .select("id, name, email, insurance_plan_id, city, is_active, send_notifications", { count: "exact" })
          .eq("clinic_id", clinicId)
          .order("name", { ascending: true })
          .range(from, to);
        if (filterPlan !== "all") q = q.eq("insurance_plan_id", filterPlan);
        if (filterCity.trim()) q = q.ilike("city", `%${filterCity.trim()}%`);
        if (filterActive === "active") q = q.or("is_active.is.null,is_active.eq.true");
        if (filterActive === "inactive") q = q.eq("is_active", false);
        return q;
      });
      return rows
        .filter((r) => r.email && r.email.includes("@") && r.send_notifications !== false)
        .map((r) => ({
          id: r.id, name: r.name, email: r.email.trim(),
          extra: { plano: plans.find((p) => p.id === r.insurance_plan_id)?.name || "" },
        }));
    }

    if (targetType === "empresas") {
      const rows: any[] = await fetchAllPages((from, to) => {
        let q = supabase
          .from("employers")
          .select("id, name, trade_name, email, city, is_active")
          .eq("clinic_id", clinicId)
          .order("name")
          .range(from, to);
        if (filterEmployerId !== "all") q = q.eq("id", filterEmployerId);
        if (filterCity.trim()) q = q.ilike("city", `%${filterCity.trim()}%`);
        if (filterActive === "active") q = q.or("is_active.is.null,is_active.eq.true");
        if (filterActive === "inactive") q = q.eq("is_active", false);
        return q;
      });
      return rows
        .filter((r) => r.email && r.email.includes("@"))
        .map((r) => ({
          id: r.id, name: r.trade_name || r.name, email: r.email.trim(),
          extra: { empresa: r.trade_name || r.name },
        }));
    }

    if (targetType === "escritorios") {
      const rows: any[] = await fetchAllPages((from, to) => {
        let q = supabase
          .from("accounting_offices")
          .select("id, name, contact_name, email, city, is_active")
          .eq("clinic_id", clinicId)
          .order("name")
          .range(from, to);
        if (filterCity.trim()) q = q.ilike("city", `%${filterCity.trim()}%`);
        if (filterActive === "active") q = q.or("is_active.is.null,is_active.eq.true");
        if (filterActive === "inactive") q = q.eq("is_active", false);
        return q;
      });
      return rows
        .filter((r) => r.email && r.email.includes("@"))
        .map((r) => ({
          id: r.id, name: r.contact_name || r.name, email: r.email.trim(),
          extra: { escritorio: r.name },
        }));
    }

    return [];
  }

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const list = await buildRecipients();
      // Dedupe by email
      const seen = new Set<string>();
      const unique = list.filter((r) => {
        const key = r.email.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setPreviewRecipients(unique);
    } catch (err: any) {
      toast({ title: "Erro ao carregar destinatários", description: err.message, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSend() {
    if (!clinicId) return;
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      toast({ title: "Preencha nome, assunto e conteúdo", variant: "destructive" });
      return;
    }
    const recipients = previewRecipients.length > 0 ? previewRecipients : await buildRecipients();
    if (recipients.length === 0) {
      toast({ title: "Nenhum destinatário válido encontrado", variant: "destructive" });
      return;
    }
    const confirmed = window.confirm(
      `Confirma o envio para ${recipients.length} destinatários? Essa ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    setSending(true);
    try {
      const filters = {
        plan: filterPlan, city: filterCity, active: filterActive,
        employerId: filterEmployerId,
      };
      const { data: campaign, error: cErr } = await supabase
        .from("email_campaigns")
        .insert({
          clinic_id: clinicId,
          name,
          subject,
          body_html: bodyHtml,
          target_type: targetType,
          filters,
          status: "queued",
          total_recipients: recipients.length,
        })
        .select()
        .single();
      if (cErr || !campaign) throw cErr || new Error("Falha ao criar campanha");

      // Insert recipients in chunks
      const chunkSize = 500;
      const seen = new Set<string>();
      const rows = recipients
        .filter((r) => {
          const k = r.email.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((r) => ({
          campaign_id: campaign.id,
          recipient_type: targetType,
          recipient_id: r.id || null,
          recipient_name: r.name,
          recipient_email: r.email,
          variables: { nome: r.name, ...(r.extra || {}) },
        }));
      for (let i = 0; i < rows.length; i += chunkSize) {
        const slice = rows.slice(i, i + chunkSize);
        const { error } = await supabase.from("email_campaign_recipients").insert(slice);
        if (error) throw error;
      }

      // Kick off dispatcher
      await supabase.functions.invoke("send-bulk-email-campaign", {
        body: { campaignId: campaign.id },
      });

      toast({
        title: "Campanha iniciada!",
        description: `${rows.length} e-mails serão enviados em segundo plano.`,
      });

      // Reset
      setName(""); setSubject(""); setBodyHtml(DEFAULT_TEMPLATE);
      setPreviewRecipients([]); setPreviewOpen(false);
      setTab("history");
      loadCampaigns();
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function openCampaignDetails(c: Campaign) {
    setSelectedCampaign(c);
    const { data } = await supabase
      .from("email_campaign_recipients")
      .select("recipient_name, recipient_email, status, error_message, sent_at")
      .eq("campaign_id", c.id)
      .order("status")
      .limit(500);
    setDetailRecipients(data || []);
  }

  async function resendFailed(campaignId: string) {
    const { error } = await supabase
      .from("email_campaign_recipients")
      .update({ status: "pending", error_message: null })
      .eq("campaign_id", campaignId)
      .eq("status", "failed");
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("email_campaigns").update({ status: "queued" }).eq("id", campaignId);
    await supabase.functions.invoke("send-bulk-email-campaign", { body: { campaignId } });
    toast({ title: "Reenvio iniciado" });
    loadCampaigns();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> E-mail em Massa
          </h1>
          <p className="text-sm text-muted-foreground">
            Envio via SMTP Locaweb para associados, empresas e escritórios.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="compose"><Send className="h-4 w-4 mr-2" />Nova Campanha</TabsTrigger>
          <TabsTrigger value="history"><Clock className="h-4 w-4 mr-2" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">1. Público-alvo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { v: "associados", label: "Associados", icon: Users },
                  { v: "empresas", label: "Empresas", icon: Building2 },
                  { v: "escritorios", label: "Escritórios", icon: Briefcase },
                  { v: "custom", label: "Lista manual", icon: Mail },
                ] as const).map((t) => {
                  const Icon = t.icon;
                  const active = targetType === t.v;
                  return (
                    <button
                      key={t.v}
                      type="button"
                      onClick={() => setTargetType(t.v)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                        active ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {targetType === "associados" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Plano</Label>
                    <Select value={filterPlan} onValueChange={setFilterPlan}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Situação</Label>
                    <Select value={filterActive} onValueChange={setFilterActive}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativos</SelectItem>
                        <SelectItem value="inactive">Inativos</SelectItem>
                        <SelectItem value="all">Todos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cidade contém</Label>
                    <Input value={filterCity} onChange={(e) => setFilterCity(e.target.value)} placeholder="Ex: Ilhéus" />
                  </div>
                </div>
              )}

              {targetType === "empresas" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Empresa específica</Label>
                    <Select value={filterEmployerId} onValueChange={setFilterEmployerId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {employers.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Situação</Label>
                    <Select value={filterActive} onValueChange={setFilterActive}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativas</SelectItem>
                        <SelectItem value="inactive">Inativas</SelectItem>
                        <SelectItem value="all">Todas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cidade contém</Label>
                    <Input value={filterCity} onChange={(e) => setFilterCity(e.target.value)} />
                  </div>
                </div>
              )}

              {targetType === "escritorios" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Situação</Label>
                    <Select value={filterActive} onValueChange={setFilterActive}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativos</SelectItem>
                        <SelectItem value="inactive">Inativos</SelectItem>
                        <SelectItem value="all">Todos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cidade contém</Label>
                    <Input value={filterCity} onChange={(e) => setFilterCity(e.target.value)} />
                  </div>
                </div>
              )}

              {targetType === "custom" && (
                <div>
                  <Label>E-mails (um por linha, ou separados por vírgula)</Label>
                  <Textarea
                    rows={6}
                    value={customEmails}
                    onChange={(e) => setCustomEmails(e.target.value)}
                    placeholder={"joao@exemplo.com\nmaria@exemplo.com"}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">2. Mensagem</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Nome interno da campanha</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Convocação Assembleia Janeiro" />
              </div>
              <div>
                <Label>Assunto do e-mail</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: {{nome}}, convocação para assembleia" />
              </div>
              <div>
                <Label>Conteúdo do e-mail</Label>
                <RichTextEditor
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  minHeight={360}
                  placeholder="Escreva sua mensagem... use a barra acima para formatar (negrito, cores, listas, links, imagens, etc.)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variáveis disponíveis: <code className="bg-muted px-1 rounded">{"{{nome}}"}</code>
                  {targetType === "associados" && <> <code className="bg-muted px-1 rounded">{"{{plano}}"}</code></>}
                  {targetType === "empresas" && <> <code className="bg-muted px-1 rounded">{"{{empresa}}"}</code></>}
                  {targetType === "escritorios" && <> <code className="bg-muted px-1 rounded">{"{{escritorio}}"}</code></>}
                </p>
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Ver/editar HTML bruto (avançado)
                  </summary>
                  <Textarea
                    rows={8}
                    className="font-mono text-xs mt-2"
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                  />
                </details>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={handlePreview}>
              <Eye className="h-4 w-4 mr-2" /> Pré-visualizar destinatários
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar campanha
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Campanhas recentes</CardTitle>
              <Button variant="outline" size="sm" onClick={loadCampaigns} disabled={campaignsLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${campaignsLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma campanha ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-2">Nome</th>
                        <th className="py-2 pr-2">Público</th>
                        <th className="py-2 pr-2">Status</th>
                        <th className="py-2 pr-2 text-right">Enviados</th>
                        <th className="py-2 pr-2 text-right">Falhas</th>
                        <th className="py-2 pr-2 text-right">Pulados</th>
                        <th className="py-2 pr-2">Criada</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c) => {
                        const s = STATUS_LABELS[c.status] || STATUS_LABELS.draft;
                        const Icon = s.icon;
                        return (
                          <tr key={c.id} className="border-b hover:bg-muted/30">
                            <td className="py-2 pr-2 font-medium">{c.name}</td>
                            <td className="py-2 pr-2 capitalize text-xs">{c.target_type}</td>
                            <td className="py-2 pr-2">
                              <Badge className={s.cls}>
                                <Icon className={`h-3 w-3 mr-1 ${c.status === "sending" ? "animate-spin" : ""}`} />
                                {s.label}
                              </Badge>
                            </td>
                            <td className="py-2 pr-2 text-right">{c.sent_count}/{c.total_recipients}</td>
                            <td className="py-2 pr-2 text-right text-red-600">{c.failed_count}</td>
                            <td className="py-2 pr-2 text-right text-amber-600">{c.skipped_count}</td>
                            <td className="py-2 pr-2 text-xs text-muted-foreground">
                              {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </td>
                            <td className="py-2 text-right">
                              <Button variant="ghost" size="sm" onClick={() => openCampaignDetails(c)}>Detalhes</Button>
                              {c.failed_count > 0 && c.status === "completed" && (
                                <Button variant="ghost" size="sm" onClick={() => resendFailed(c.id)}>
                                  Reenviar falhas
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Destinatários ({previewRecipients.length})</DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr><th className="text-left py-2">Nome</th><th className="text-left py-2">E-mail</th></tr>
              </thead>
              <tbody>
                {previewRecipients.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-b"><td className="py-1.5">{r.name}</td><td className="py-1.5">{r.email}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {previewRecipients.length > 200 && (
            <p className="text-xs text-muted-foreground">…e mais {previewRecipients.length - 200} destinatários.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button onClick={handleSend} disabled={sending || previewRecipients.length === 0}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar para {previewRecipients.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={!!selectedCampaign} onOpenChange={(o) => !o && setSelectedCampaign(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCampaign?.name}</DialogTitle>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-emerald-50 p-2 rounded"><b>{selectedCampaign.sent_count}</b> enviados</div>
                <div className="bg-red-50 p-2 rounded"><b>{selectedCampaign.failed_count}</b> falhas</div>
                <div className="bg-amber-50 p-2 rounded"><b>{selectedCampaign.skipped_count}</b> pulados</div>
              </div>
              <p className="text-xs text-muted-foreground">Assunto: {selectedCampaign.subject}</p>
              <table className="w-full text-xs">
                <thead className="border-b text-muted-foreground"><tr>
                  <th className="text-left py-1">Nome</th>
                  <th className="text-left py-1">E-mail</th>
                  <th className="text-left py-1">Status</th>
                  <th className="text-left py-1">Erro</th>
                </tr></thead>
                <tbody>
                  {detailRecipients.map((r, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-1">{r.recipient_name}</td>
                      <td className="py-1">{r.recipient_email}</td>
                      <td className="py-1">{r.status}</td>
                      <td className="py-1 text-red-600">{r.error_message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
    <div style="background:#16a394;padding:24px;text-align:center;color:#ffffff;">
      <h1 style="margin:0;font-size:22px;">Comunicado do Sindicato</h1>
    </div>
    <div style="padding:32px 24px;color:#334155;line-height:1.6;">
      <p>Olá <strong>{{nome}}</strong>,</p>
      <p>Escreva aqui sua mensagem...</p>
      <p style="margin-top:32px;">Atenciosamente,<br/>Diretoria</p>
    </div>
  </div>
</body></html>`;