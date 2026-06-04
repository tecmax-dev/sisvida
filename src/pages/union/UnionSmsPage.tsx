import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, RefreshCw, Send, MessageSquare, Users, Search } from "lucide-react";

interface SmsTemplate {
  id: string;
  name: string;
  meta_template_name: string | null;
  body: string;
  variables: any;
  status: string;
  updated_at: string;
}

interface SmsLog {
  id: string;
  recipient: string;
  rendered_body: string;
  status: string;
  error: string | null;
  created_at: string;
}

interface MemberRow {
  id: string;
  name: string;
  phone: string | null;
  cpf: string;
  is_active: boolean | null;
}

export default function UnionSmsPage() {
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [customBody, setCustomBody] = useState("");
  const [recipients, setRecipients] = useState("");

  // Valores globais para variáveis {1}, {2}, ... e flag de auto-preencher com nome do associado
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [varUseName, setVarUseName] = useState<Record<string, boolean>>({ "1": true });

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  // Aba "Agendados": filtra associados que têm agendamento na clínica no intervalo
  const today = new Date().toISOString().slice(0, 10);
  const janFirst = `${new Date().getFullYear()}-01-01`;
  const [agendaFrom, setAgendaFrom] = useState(janFirst);
  const [agendaTo, setAgendaTo] = useState(today);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaByProf, setAgendaByProf] = useState<
    Record<string, { profName: string; members: MemberRow[] }>
  >({});
  const [agendaTotalAppointments, setAgendaTotalAppointments] = useState(0);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: tpls }, { data: lg }] = await Promise.all([
      supabase.from("sms_templates").select("*").order("name"),
      supabase.from("sms_send_logs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setTemplates((tpls as SmsTemplate[]) ?? []);
    setLogs((lg as SmsLog[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const loadMembers = async () => {
    setMembersLoading(true);
    try {
      const all: MemberRow[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("members")
          .select("id, name, phone, cpf, is_active")
          .eq("is_active", true)
          .not("phone", "is", null)
          .order("name", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as MemberRow[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      const valid = all.filter((m) => (m.phone ?? "").replace(/\D/g, "").length >= 10);
      setMembers(valid);
      toast.success(`${valid.length} associados com telefone carregados`);
    } catch (err: any) {
      toast.error(`Erro ao carregar associados: ${err.message ?? err}`);
    } finally {
      setMembersLoading(false);
    }
  };

  const openMemberPicker = async () => {
    setShowMemberPicker(true);
    if (members.length === 0) await loadMembers();
  };

  const filteredMembers = members.filter((m) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    const cpfDigits = m.cpf.replace(/\D/g, "");
    const phoneDigits = (m.phone ?? "").replace(/\D/g, "");
    return (
      m.name.toLowerCase().includes(q) ||
      cpfDigits.includes(q.replace(/\D/g, "")) ||
      phoneDigits.includes(q.replace(/\D/g, ""))
    );
  });

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    const allSelected = filteredMembers.every((m) => selectedMemberIds.has(m.id));
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (allSelected) filteredMembers.forEach((m) => next.delete(m.id));
      else filteredMembers.forEach((m) => next.add(m.id));
      return next;
    });
  };

  const applyMemberSelection = () => {
    const phones = members
      .filter((m) => selectedMemberIds.has(m.id))
      .map((m) => (m.phone ?? "").replace(/\D/g, ""))
      .filter((p) => p.length >= 10);
    const existing = recipients
      .split(/[\n,;]+/)
      .map((s) => s.replace(/\D/g, ""))
      .filter((s) => s.length >= 10);
    const merged = Array.from(new Set([...existing, ...phones]));
    setRecipients(merged.join("\n"));
    setShowMemberPicker(false);
    toast.success(`${phones.length} número(s) adicionado(s)`);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sindicato-sms-templates-sync");
      if (error) throw error;
      toast.success(`Sincronização concluída: ${data?.synced ?? 0} modelos`);
      await loadAll();
    } catch (err: any) {
      toast.error(`Erro ao sincronizar: ${err.message ?? err}`);
    } finally {
      setSyncing(false);
    }
  };

  const parseRecipients = (text: string) => {
    return text
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 8)
      .map((phone) => ({ phone }));
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const previewBody = selectedTemplate?.body ?? customBody;

  // Detecta índices de variáveis no texto (ex.: {1}, {2}) e ordena
  const varIndexes = Array.from(
    new Set((previewBody.match(/\{(\d+)\}/g) ?? []).map((m) => m.replace(/\D/g, ""))),
  ).sort((a, b) => Number(a) - Number(b));

  const renderPreview = (sampleName = "João da Silva") => {
    return previewBody.replace(/\{(\d+)\}/g, (_m, idx) => {
      if (varUseName[idx]) return sampleName;
      return varValues[idx] ?? `{${idx}}`;
    });
  };

  const handleSend = async () => {
    // Destinatários a partir de associados selecionados (com nome para {1})
    const selectedMembers = members.filter((m) => selectedMemberIds.has(m.id));
    const memberPhones = new Set(
      selectedMembers
        .map((m) => (m.phone ?? "").replace(/\D/g, ""))
        .filter((p) => p.length >= 10),
    );

    const memberRecipients = selectedMembers
      .map((m) => {
        const phone = (m.phone ?? "").replace(/\D/g, "");
        if (phone.length < 10) return null;
        const vars: Record<string, string> = {};
        for (const idx of varIndexes) {
          if (varUseName[idx]) vars[idx] = m.name;
          else if (varValues[idx]) vars[idx] = varValues[idx];
        }
        return { phone, vars, name: m.name };
      })
      .filter(Boolean) as Array<{ phone: string; vars: Record<string, string>; name: string }>;

    // Telefones manuais que NÃO estão entre os associados selecionados (evita duplicado)
    const manualPhones = parseRecipients(recipients)
      .map((r) => r.phone.replace(/\D/g, ""))
      .filter((p) => p.length >= 10 && !memberPhones.has(p));

    const manualRecipients = manualPhones.map((phone) => {
      const vars: Record<string, string> = {};
      for (const idx of varIndexes) {
        if (!varUseName[idx] && varValues[idx]) vars[idx] = varValues[idx];
      }
      return { phone, vars };
    });

    const list = [...memberRecipients, ...manualRecipients];

    if (list.length === 0) {
      toast.error("Informe ao menos um número de telefone");
      return;
    }
    if (!selectedTemplateId && !customBody.trim()) {
      toast.error("Selecione um modelo ou digite o texto do SMS");
      return;
    }
    // Validar variáveis sem valor (exceto as marcadas como nome do associado em envio só-manual)
    const missingVars = varIndexes.filter((idx) => {
      if (varUseName[idx]) {
        // se houver destinatários manuais e não tem nome, falha
        return manualRecipients.length > 0 && !varValues[idx];
      }
      return !varValues[idx];
    });
    if (missingVars.length > 0) {
      const ok = confirm(
        `As variáveis {${missingVars.join("}, {")}} ficarão sem valor para parte dos destinatários. Continuar?`,
      );
      if (!ok) return;
    }
    if (!confirm(`Enviar SMS para ${list.length} destinatário(s)?`)) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("sindicato-send-sms", {
        body: {
          template_id: selectedTemplateId || undefined,
          body: selectedTemplateId ? undefined : customBody,
          recipients: list,
        },
      });
      if (error) throw error;
      toast.success(`${data?.sent ?? 0}/${data?.total ?? 0} SMS enviados`);
      setRecipients("");
      await loadAll();
    } catch (err: any) {
      toast.error(`Erro: ${err.message ?? err}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">SMS (Comtele)</h1>
        </div>
        <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sincronizar do WhatsApp
        </Button>
      </div>

      <Tabs defaultValue="send">
        <TabsList>
          <TabsTrigger value="send">Envio</TabsTrigger>
          <TabsTrigger value="templates">Modelos ({templates.length})</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Enviar SMS</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Modelo (opcional)</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  <option value="">— Texto livre —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {!selectedTemplateId && (
                <div className="space-y-2">
                  <Label>Texto do SMS</Label>
                  <Textarea
                    rows={4}
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    placeholder="Digite a mensagem (máx 160 caracteres recomendado)"
                  />
                  <p className="text-xs text-muted-foreground">{customBody.length} caracteres</p>
                </div>
              )}

              {selectedTemplate && (
                <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                  {previewBody}
                </div>
              )}

              {varIndexes.length > 0 && (
                <div className="space-y-2 border rounded-md p-3 bg-muted/30">
                  <Label className="text-sm">Variáveis do modelo</Label>
                  <p className="text-xs text-muted-foreground">
                    Defina o valor de cada variável. Marque "Usar nome do associado" para preencher automaticamente por destinatário.
                  </p>
                  {varIndexes.map((idx) => (
                    <div key={idx} className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono bg-background border rounded px-2 py-1">{`{${idx}}`}</span>
                      <Input
                        className="flex-1 min-w-[180px]"
                        placeholder={varUseName[idx] ? "(nome do associado)" : "Valor fixo"}
                        value={varValues[idx] ?? ""}
                        disabled={!!varUseName[idx]}
                        onChange={(e) => setVarValues((p) => ({ ...p, [idx]: e.target.value }))}
                      />
                      <label className="flex items-center gap-1 text-xs">
                        <Checkbox
                          checked={!!varUseName[idx]}
                          onCheckedChange={(v) =>
                            setVarUseName((p) => ({ ...p, [idx]: !!v }))
                          }
                        />
                        Nome do associado
                      </label>
                    </div>
                  ))}
                  <div className="text-xs text-muted-foreground pt-1">
                    <span className="font-medium">Prévia:</span> {renderPreview()}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Destinatários (um por linha, ou separados por vírgula)</Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={openMemberPicker}>
                    <Users className="h-4 w-4 mr-2" />
                    Selecionar associados
                  </Button>
                  {selectedMemberIds.size > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedMemberIds(new Set())}
                    >
                      Limpar seleção ({selectedMemberIds.size})
                    </Button>
                  )}
                </div>
                {selectedMemberIds.size > 0 && (
                  <p className="text-xs text-primary">
                    {selectedMemberIds.size} associado(s) selecionado(s) — o nome será injetado automaticamente nas variáveis marcadas.
                  </p>
                )}
                <Textarea
                  rows={5}
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="73999990000&#10;11988887777"
                />
                <p className="text-xs text-muted-foreground">
                  {parseRecipients(recipients).length} número(s) manual(is) detectado(s)
                </p>
              </div>

              <Button onClick={handleSend} disabled={sending} className="w-full">
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar SMS
              </Button>
            </CardContent>
          </Card>

          {showMemberPicker && (
            <Card className="border-primary/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Associados ({selectedMemberIds.size} selecionado{selectedMemberIds.size === 1 ? "" : "s"})
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowMemberPicker(false)}>Fechar</Button>
                  <Button size="sm" onClick={applyMemberSelection} disabled={selectedMemberIds.size === 0}>
                    Adicionar aos destinatários
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Buscar por nome, CPF ou telefone..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {filteredMembers.length} de {members.length} associados
                  </p>
                  <Button variant="ghost" size="sm" onClick={toggleAllFiltered} disabled={filteredMembers.length === 0}>
                    {filteredMembers.every((m) => selectedMemberIds.has(m.id)) && filteredMembers.length > 0
                      ? "Desmarcar todos"
                      : "Selecionar todos"}
                  </Button>
                </div>
                {membersLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                  <ScrollArea className="h-[400px] border rounded-md">
                    <div className="divide-y">
                      {filteredMembers.map((m) => (
                        <label
                          key={m.id}
                          className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedMemberIds.has(m.id)}
                            onCheckedChange={() => toggleMember(m.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{m.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {m.phone} · CPF {m.cpf}
                            </p>
                          </div>
                        </label>
                      ))}
                      {filteredMembers.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Nenhum associado encontrado
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-2">
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : templates.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum modelo cadastrado. Clique em "Sincronizar do WhatsApp" para importar modelos aprovados.</p>
          ) : templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium">{t.name}</p>
                  <Badge variant="outline">{t.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.body}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="history" className="space-y-2">
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum envio registrado ainda.</p>
          ) : logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-medium text-sm">{log.recipient}</p>
                  <Badge variant={log.status === "sent" ? "default" : "destructive"}>{log.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</p>
                <p className="text-sm mt-1 whitespace-pre-wrap">{log.rendered_body}</p>
                {log.error && <p className="text-xs text-destructive mt-1">{log.error}</p>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}