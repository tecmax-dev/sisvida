import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TEMPLATE_KEY = "appointment_reminder";
const DEFAULT_BODY = `Secmi: {nome}, consulta {data} as {hora}. Confirmar SIM:{link} ou NAO:{link}?x=1`;
const SAMPLE = { nome: "Joao", data: "12/06", hora: "14:30", link: "prosinge.com.br/c/abc123", token: "abc123" };
const PLACEHOLDERS = ["{nome}", "{data}", "{hora}", "{link}", "{token}"];
const LIMIT = 160;

function render(body: string, vars: Record<string, string>) {
  return body.replace(/\{(nome|data|hora|link|token)\}/g, (_, k) => vars[k] ?? "");
}

export function AppointmentSmsTemplateSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [body, setBody] = useState(DEFAULT_BODY);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("sms_templates")
        .select("id, body")
        .eq("meta_template_name", TEMPLATE_KEY)
        .maybeSingle();
      if (!error && data) {
        setId(data.id);
        setBody(data.body || DEFAULT_BODY);
      }
      setLoading(false);
    })();
  }, []);

  const preview = useMemo(() => render(body, SAMPLE), [body]);
  const length = preview.length;
  const overLimit = length > LIMIT;

  const insertPlaceholder = (ph: string) => setBody((b) => b + ph);

  const handleSave = async () => {
    if (overLimit) {
      toast.error(`Excede ${LIMIT} caracteres (${length}). Encurte o texto.`);
      return;
    }
    if (!body.trim()) {
      toast.error("O texto não pode ficar vazio.");
      return;
    }
    setSaving(true);
    const payload = {
      name: "Lembrete de agendamento",
      meta_template_name: TEMPLATE_KEY,
      body,
      variables: PLACEHOLDERS,
      status: "active",
    };
    const { data, error } = id
      ? await supabase.from("sms_templates").update(payload).eq("id", id).select("id").maybeSingle()
      : await supabase.from("sms_templates").insert(payload).select("id").maybeSingle();
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    if (data?.id) setId(data.id);
    toast.success("Modelo salvo!");
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Modelo do SMS de Lembrete
        </CardTitle>
        <CardDescription>
          Edite o texto enviado por SMS. Use os placeholders abaixo. O limite é de {LIMIT} caracteres por mensagem para caber em 1 SMS (GSM-7) e manter o custo baixo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PLACEHOLDERS.map((ph) => (
            <Button key={ph} type="button" variant="outline" size="sm" onClick={() => insertPlaceholder(ph)}>
              {ph}
            </Button>
          ))}
        </div>

        <div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="font-mono text-sm"
            placeholder={DEFAULT_BODY}
          />
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Placeholders: {PLACEHOLDERS.join(" ")}</span>
            <Badge variant={overLimit ? "destructive" : length > LIMIT * 0.9 ? "secondary" : "outline"}>
              {length} / {LIMIT} caracteres
            </Badge>
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Pré-visualização (com dados de exemplo):</p>
          <p className="text-sm whitespace-pre-wrap break-words">{preview}</p>
        </div>

        {overLimit && (
          <p className="text-sm text-destructive">
            A mensagem ultrapassa {LIMIT} caracteres e será cobrada como 2 SMS. Encurte o texto antes de salvar.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setBody(DEFAULT_BODY)} disabled={saving}>
            Restaurar padrão
          </Button>
          <Button onClick={handleSave} disabled={saving || overLimit}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default AppointmentSmsTemplateSettings;