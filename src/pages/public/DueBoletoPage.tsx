import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { WorkerListValidationStep } from "@/components/portal/WorkerListValidationStep";
import { formatDateBR } from "@/lib/date";

interface Employer { id: string; name: string; cnpj: string }
interface Contribution {
  id: string; due_date: string; status: string; lytex_invoice_url: string | null; competence_month: number; competence_year: number;
  contribution_type_id?: string | null; contribution_type: { name: string } | null;
}

/** Página exclusiva aberta pelo botão "Gerar boleto" do WhatsApp: uma competência a vencer. */
export default function DueBoletoPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [contrib, setContrib] = useState<Contribution | null>(null);
  const [validationId, setValidationId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [options, setOptions] = useState<Contribution[]>([]);
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    document.title = "Gerar boleto — ProsindWeb";
    const t = new URLSearchParams(window.location.search).get("t");
    window.history.replaceState(null, "", window.location.pathname);
    if (!t) { setError("Link inválido. Peça um novo pelo WhatsApp."); setLoading(false); return; }
    supabase.functions.invoke("employer-portal-link", { body: { token: t } }).then(async ({ data, error: e }) => {
      let msg = data?.error as string | undefined;
      if (e && !msg) { try { msg = JSON.parse(await (e as any).context.text())?.error; } catch { /* */ } }
      if (msg || !data?.contribution) setError(msg || "Este link não é válido para gerar boleto.");
      else {
        setEmployer(data.employer);
        const opts: Contribution[] = data.options?.length ? data.options : [data.contribution];
        setOptions(opts);
        setContrib(null);
      }
      setLoading(false);
    });
  }, []);

  function pick(c: Contribution) {
    setContrib(c); setChosen(true); setValidationId(null); setValue(""); setError(null);
    if (c.status === "pending") { setDone(true); setInvoiceUrl(c.lytex_invoice_url || null); }
    else { setDone(false); setInvoiceUrl(null); }
  }
  const typeName = (c: Contribution) => String(c.contribution_type?.name ?? "Contribuição").replace(/^\s*\d+\s*[-–]\s*/, "");
  const compOf = (c: Contribution) => `${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`;

  const generate = async () => {
    if (!employer || !contrib || !validationId) return;
    const cents = Math.round(Number(value.replace(/\./g, "").replace(",", ".")) * 100);
    if (!cents || cents <= 0) { setError("Informe um valor maior que zero."); return; }
    setSaving(true); setError(null);
    const { data, error: e } = await supabase.functions.invoke("set-contribution-value", {
      body: {
        contribution_id: contrib.id, value: cents, portal_type: "employer", portal_id: employer.id,
        worker_list_validation_id: validationId, due_only: true,
      },
    });
    setSaving(false);
    if (e || data?.error) { setError(data?.error || "Não foi possível gerar o boleto."); return; }
    setInvoiceUrl(data?.lytex_invoice_url || null);
    setDone(true);
  };

  const comp = contrib ? `${String(contrib.competence_month).padStart(2, "0")}/${contrib.competence_year}` : "";

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-4">
        {loading && <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}

        {!loading && employer && !chosen && options.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Qual contribuição você vai gerar?</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{employer.name} — escolha o tipo de contribuição para enviar a lista de trabalhadores.</p>
              {options.map((o) => (
                <Button key={o.id} variant="outline" className="w-full h-auto py-3 justify-between" onClick={() => pick(o)}>
                  <span className="text-left font-medium">{typeName(o)}</span>
                  <span className="text-xs text-muted-foreground">{compOf(o)} · vence {formatDateBR(o.due_date)}{o.status === "pending" ? " · boleto gerado" : ""}</span>
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {!loading && !contrib && !(employer && options.length > 0) && (
          <Card><CardContent className="py-10 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
            <p className="font-medium">{error}</p>
            <p className="text-sm text-muted-foreground">Competências vencidas são geradas somente pelo Portal da Empresa.</p>
            <Button asChild variant="outline"><a href="/portal-empresa">Ir para o Portal da Empresa</a></Button>
          </CardContent></Card>
        )}

        {employer && contrib && (
          <>
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle>Gerar boleto</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => { setChosen(false); setContrib(null); }}>Trocar tipo</Button>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                <p><span className="text-muted-foreground">Empresa:</span> {employer.name}</p>
                <p><span className="text-muted-foreground">Tipo escolhido:</span> {typeName(contrib)}</p>
                <p><span className="text-muted-foreground">Competência:</span> {comp}</p>
                <p><span className="text-muted-foreground">Vencimento:</span> {formatDateBR(contrib.due_date)}</p>
              </CardContent>
            </Card>

            {done ? (
              <Card><CardContent className="py-10 text-center space-y-3">
                <CheckCircle2 className="h-10 w-10 mx-auto text-primary" />
                <p className="font-medium">{contrib.status === "pending" ? "O boleto desta competência já foi gerado." : "Boleto gerado com sucesso!"}</p>
                {invoiceUrl && (
                  <Button asChild><a href={invoiceUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Abrir boleto</a></Button>
                )}
              </CardContent></Card>
            ) : (
              <>
                <Card><CardContent className="pt-6">
                  <WorkerListValidationStep
                    contributionId={contrib.id} portalType="employer" portalId={employer.id}
                    employerName={employer.name} employerCnpj={employer.cnpj}
                    validationId={validationId} onValidated={setValidationId}
                    fixedTypeId={contrib.contribution_type_id ?? null} fixedTypeName={typeName(contrib)}
                  />
                </CardContent></Card>
                <Card><CardContent className="pt-6 space-y-3">
                  <Label htmlFor="due-value">Valor (R$)</Label>
                  <Input id="due-value" inputMode="decimal" placeholder="0,00" value={value}
                    onChange={(e) => setValue(e.target.value)} disabled={!validationId || saving} />
                  {!validationId && <p className="text-xs text-muted-foreground">Envie e valide a lista de trabalhadores para liberar o valor.</p>}
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button className="w-full" onClick={generate} disabled={!validationId || !value || saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Gerar boleto
                  </Button>
                </CardContent></Card>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
