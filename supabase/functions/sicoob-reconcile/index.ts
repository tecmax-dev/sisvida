import { createClient } from "npm:@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";

// Conciliação de boletos antigos emitidos direto no Sicoob (sem vínculo no sistema).
// Não toca em contribuições com boleto Lytex nem em boletos já emitidos pelo sistema no Sicoob.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-reconcile-key",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const CLIENT_ID = "954f6397-f970-4f7c-b686-8be2d24c0cde";
const TOKEN_URL = "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token";
const API = "https://api.sicoob.com.br/cobranca-bancaria/v3";
const SCOPE = "boletos_inclusao boletos_consulta boletos_alteracao webhooks_inclusao webhooks_consulta webhooks_alteracao";
let cached: { client: Deno.HttpClient; token: string; exp: number } | null = null;

async function session(supabase: any) {
  if (cached && cached.exp > Date.now() + 20_000) return cached;
  const { data: file, error } = await supabase.storage.from("sicoob-private").download("certificado-a1.pfx");
  if (error || !file) throw new Error("Certificado do Sicoob não encontrado.");
  const bin = new Uint8Array(await file.arrayBuffer());
  let raw = ""; for (const b of bin) raw += String.fromCharCode(b);
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(raw), Deno.env.get("SICOOB_CERT_PASSWORD") || "");
  const keyBag = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const client = Deno.createHttpClient({
    cert: certBags.map((b: any) => forge.pki.certificateToPem(b.cert)).join("\n"),
    key: forge.pki.privateKeyToPem(keyBag.key),
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST", client, headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, scope: SCOPE }),
  } as any);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Sicoob recusou o acesso [${res.status}]`);
  cached = { client, token: body.access_token, exp: Date.now() + (body.expires_in || 300) * 1000 };
  return cached;
}

async function get(supabase: any, path: string) {
  const s = await session(supabase);
  const res = await fetch(`${API}${path}`, {
    method: "GET", client: s.client,
    headers: { Authorization: `Bearer ${s.token}`, client_id: CLIENT_ID, Accept: "application/json" },
  } as any);
  const text = await res.text();
  let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isPaid = (b: any) => /liquidad/i.test(String(b?.situacaoBoleto || "")) || Number(b?.valorPago ?? b?.valorLiquidado ?? 0) > 0;
function paidDate(b: any): string | null {
  const d = b?.dataLiquidacao || b?.dataPagamento ||
    (b?.listaHistorico || []).find((h: any) => /liquida/i.test(h?.descricaoHistorico || ""))?.dataHistorico;
  return d ? String(d).slice(0, 10) : null;
}

async function boletosDoPagador(supabase: any, cnpj: string, numeroCliente: number, conta: string | undefined, months: string[]) {
  // Sicoob aceita no máximo 35 dias por consulta: consultamos só os meses de vencimento que interessam
  const all: any[] = [];
  for (const ym of months) {
    const [y, m] = ym.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const q = new URLSearchParams({ numeroCliente: String(numeroCliente), dataInicio: `${ym}-01`, dataFim: `${ym}-${String(last).padStart(2, "0")}` });
    if (conta) q.set("numeroContaCorrente", conta);
    const r = await get(supabase, `/pagadores/${cnpj}/boletos?${q}`);
    if (r.status === 404 || r.status === 204) { await sleep(60); continue; }
    if (!r.ok) throw new Error(`Sicoob [${r.status}]: ${JSON.stringify(r.data).slice(0, 300)}`);
    const list = r.data?.resultado ?? r.data ?? [];
    if (Array.isArray(list)) all.push(...list);
    await sleep(60);
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const body = await req.json().catch(() => ({}));
    // Chave interna de diagnóstico: só leitura (nunca aplica baixas)
    const testKey = Deno.env.get("SICOOB_RECONCILE_TEST_KEY");
    const internal = !!testKey && testKey.length >= 32 && req.headers.get("x-reconcile-key") === testKey;
    if (internal) body.apply = false;
    const { data: ud } = internal ? { data: { user: { id: "internal-test" } } } : await supabase.auth.getUser(jwt);
    const u = ud as any;
    if (!u?.user) return json({ error: "Faça login novamente." }, 401);
    const { data: sa } = internal ? { data: true } : await supabase.from("super_admins").select("user_id").eq("user_id", u.user.id).maybeSingle();
    const clinicId = String(body.clinic_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(clinicId)) return json({ error: "Pedido inválido." }, 400);
    const { data: access } = internal ? { data: true } : await supabase.rpc("has_clinic_access", { _user_id: u.user.id, _clinic_id: clinicId });
    if (!sa && !access) return json({ error: "Sem permissão." }, 403);

    const numeroCliente = Number(Deno.env.get("SICOOB_NUMERO_CLIENTE") || Deno.env.get("SICOOB_CONTRATO_COBRANCA"));
    const conta = Deno.env.get("SICOOB_CONTA_CORRENTE") || undefined;
    const apply = body.apply === true;

    // Probe de um CNPJ (diagnóstico, sem alterar nada)
    if (body.action === "probe") {
      const cnpj = digits(body.cnpj);
      const list = await boletosDoPagador(supabase, cnpj, numeroCliente, conta, (body.months || ["2022-03"]) as string[]);
      return json({ ok: true, count: list.length, sample: list.slice(0, 3) });
    }

    // Lote de empresas: offset/limit sobre empresas com contribuições antigas em aberto
    const offset = Math.max(0, Number(body.offset) || 0);
    const limit = Math.min(10, Math.max(1, Number(body.limit) || 10));
    const { data: rows, error } = await supabase.from("employer_contributions")
      .select("id, employer_id, due_date, value, status, competence_month, competence_year, employers!inner(cnpj, name)")
      .eq("clinic_id", clinicId).in("status", ["pending", "overdue"])
      .is("lytex_invoice_id", null).is("sicoob_nosso_numero", null)
      .gte("due_date", "2021-01-01").order("employer_id").order("id").range(0, 9999);
    if (error) throw error;
    const byEmp = new Map<string, any[]>();
    for (const r of rows || []) { const k = r.employer_id; if (!byEmp.has(k)) byEmp.set(k, []); byEmp.get(k)!.push(r); }
    const empIds = [...byEmp.keys()].sort();
    const slice = empIds.slice(offset, offset + limit);

    const exact: any[] = [], probable: any[] = [], errors: any[] = []; let found = 0; const situacoes: Record<string, number> = {};
    for (const empId of slice) {
      const contribs = byEmp.get(empId)!;
      const cnpj = digits(contribs[0].employers?.cnpj);
      if (![11, 14].includes(cnpj.length)) { errors.push({ employer: contribs[0].employers?.name, error: "CNPJ inválido" }); continue; }
      let boletos: any[] = [];
      try { const months = [...new Set(contribs.map((c) => String(c.due_date).slice(0, 7)))];
        const allB = await boletosDoPagador(supabase, cnpj, numeroCliente, conta, months); found += allB.length;
        for (const b of allB) situacoes[b.situacaoBoleto || "?"] = (situacoes[b.situacaoBoleto || "?"] || 0) + 1;
        boletos = allB.filter(isPaid); }
      catch (e: any) { errors.push({ employer: contribs[0].employers?.name, error: e.message }); continue; }
      const used = new Set<string>();
      for (const c of contribs) {
        const valor = Math.round(Number(c.value || 0));
        const sameDue = boletos.filter((b) => String(b.dataVencimento).slice(0, 10) === c.due_date && !used.has(String(b.nossoNumero)));
        const exactMatches = sameDue.filter((b) => Math.round(Number(b.valor) * 100) === valor);
        // "Bate certinho": um único boleto pago, mesmo CNPJ, mesmo vencimento e mesmo valor, e nenhuma outra contribuição igual
        const twins = contribs.filter((o) => o.due_date === c.due_date && Math.round(Number(o.value || 0)) === valor).length;
        if (exactMatches.length === 1 && twins === 1 && valor > 0) {
          const b = exactMatches[0]; used.add(String(b.nossoNumero));
          exact.push({ c, b });
        } else if (sameDue.length > 0) {
          probable.push({ contribution_id: c.id, employer: c.employers?.name, competencia: `${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`, vencimento: c.due_date, valor_sistema: valor / 100, boletos_sicoob: sameDue.map((b) => ({ nosso_numero: b.nossoNumero, valor: b.valor, pago: b.valorPago ?? null })) });
        }
      }
    }

    let applied = 0;
    if (apply) {
      for (const { c, b } of exact) {
        const pd = paidDate(b);
        const { error: ue } = await supabase.from("employer_contributions").update({
          status: "paid",
          paid_at: pd ? `${pd}T12:00:00-03:00` : new Date().toISOString(),
          paid_value: Math.round(Number(b.valorPago ?? b.valor) * 100),
          payment_method: "boleto",
          sicoob_nosso_numero: b.nossoNumero ?? null,
          sicoob_linha_digitavel: b.linhaDigitavel ?? null,
          sicoob_codigo_barras: b.codigoBarras ?? null,
          sicoob_situacao: b.situacaoBoleto ?? "Liquidado",
          sicoob_raw: { conciliado_sicoob: true, conciliado_em: new Date().toISOString(), conciliado_por: u.user.id, status_anterior: c.status, boleto: b },
          last_sicoob_sync_at: new Date().toISOString(),
        }).eq("id", c.id).in("status", ["pending", "overdue"]).is("lytex_invoice_id", null);
        if (!ue) applied++; else errors.push({ contribution_id: c.id, error: ue.message });
      }
    }

    return json({
      ok: true, total_empresas: empIds.length, offset, processadas: slice.length, proximo_offset: offset + slice.length < empIds.length ? offset + slice.length : null,
      boletos_encontrados_sicoob: found, situacoes, batem_certinho: exact.length, baixadas: applied, provaveis: probable, erros: errors,
      exemplos_exatos: exact.slice(0, 5).map(({ c, b }) => ({ employer: c.employers?.name, vencimento: c.due_date, valor: Number(c.value) / 100, nosso_numero: b.nossoNumero, pago_em: paidDate(b) })),
    });
  } catch (e: any) {
    console.error("sicoob-reconcile", e?.message);
    return json({ error: e?.message || "Erro inesperado." }, 500);
  }
});
