import { createClient } from "npm:@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-test",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const CLIENT_ID = "954f6397-f970-4f7c-b686-8be2d24c0cde";
const TOKEN_URL = "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token";
const API = "https://api.sicoob.com.br/cobranca-bancaria/v3";
const SCOPE = "boletos_inclusao boletos_consulta boletos_alteracao webhooks_inclusao webhooks_consulta webhooks_alteracao";

let cached: { client: Deno.HttpClient; token: string; exp: number } | null = null;

async function sicoobSession(supabase: any) {
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
    method: "POST", client,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, scope: SCOPE }),
  } as any);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Sicoob recusou o acesso [${res.status}]: ${JSON.stringify(body).slice(0, 300)}`);
  cached = { client, token: body.access_token, exp: Date.now() + (body.expires_in || 300) * 1000 };
  return cached;
}

async function api(supabase: any, method: string, path: string, body?: unknown) {
  const s = await sicoobSession(supabase);
  const res = await fetch(`${API}${path}`, {
    method, client: s.client,
    headers: { Authorization: `Bearer ${s.token}`, client_id: CLIENT_ID, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  } as any);
  const text = await res.text();
  let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

const digits = (s: string | null | undefined) => String(s || "").replace(/\D/g, "");
const ymd = (d: string) => String(d).slice(0, 10);
const todayBR = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await supabase.auth.getUser(jwt);
    if (!u?.user) return json({ error: "Faça login novamente." }, 401);

    const { action, contribution_id } = await req.json().catch(() => ({}));
    if (!["emit", "consult", "pdf"].includes(action) || typeof contribution_id !== "string" || !/^[0-9a-f-]{36}$/i.test(contribution_id))
      return json({ error: "Pedido inválido." }, 400);

    const { data: c } = await supabase.from("employer_contributions")
      .select("*, contribution_types(name, billing_provider), employers(name, cnpj, address, neighborhood, city, state, cep, email)")
      .eq("id", contribution_id).maybeSingle();
    if (!c) return json({ error: "Contribuição não encontrada." }, 404);

    const { data: sa } = await supabase.from("super_admins").select("user_id").eq("user_id", u.user.id).maybeSingle();
    const { data: access } = await supabase.rpc("has_clinic_access", { _user_id: u.user.id, _clinic_id: c.clinic_id });
    if (!sa && !access) return json({ error: "Sem permissão para esta contribuição." }, 403);
    if (c.contribution_types?.billing_provider !== "sicoob") return json({ error: "Este tipo de contribuição não usa o Sicoob." }, 400);

    const numeroCliente = Number(Deno.env.get("SICOOB_NUMERO_CLIENTE") || Deno.env.get("SICOOB_CONTRATO_COBRANCA"));
    const contaCorrente = Deno.env.get("SICOOB_CONTA_CORRENTE");

    if (action === "emit") {
      if (c.sicoob_nosso_numero) return json({ error: "Esta contribuição já tem boleto no Sicoob." }, 409);
      if (["paid", "cancelled"].includes(c.status)) return json({ error: "Contribuição paga ou cancelada." }, 400);
      if (!c.value || c.value <= 0) return json({ error: "Defina o valor antes de gerar o boleto." }, 400);
      const e = c.employers;
      const doc = digits(e?.cnpj);
      if (!e || ![11, 14].includes(doc.length)) return json({ error: "CNPJ/CPF do pagador inválido." }, 400);
      const cep = digits(e.cep);
      if (cep.length !== 8 || !e.city || !e.state) return json({ error: "Endereço da empresa incompleto (CEP, cidade e UF são obrigatórios no Sicoob)." }, 400);

      const payload: Record<string, unknown> = {
        numeroCliente,
        codigoModalidade: 1,
        codigoEspecieDocumento: "DM",
        dataEmissao: todayBR(),
        seuNumero: String(c.id).replace(/-/g, "").slice(0, 18),
        identificacaoBoletoEmpresa: String(c.id).replace(/-/g, "").slice(0, 25),
        identificacaoEmissaoBoleto: 2,
        identificacaoDistribuicaoBoleto: 2,
        valor: Number((c.value / 100).toFixed(2)),
        dataVencimento: ymd(c.due_date),
        tipoDesconto: 0,
        tipoMulta: 0,
        tipoJurosMora: 3,
        numeroParcela: 1,
        pagador: {
          numeroCpfCnpj: doc,
          nome: String(e.name).slice(0, 50),
          endereco: String(e.address || "Não informado").slice(0, 40),
          bairro: String(e.neighborhood || "Centro").slice(0, 30),
          cidade: String(e.city).slice(0, 40),
          cep,
          uf: String(e.state).slice(0, 2).toUpperCase(),
          ...(e.email ? { email: e.email } : {}),
        },
        mensagensInstrucao: [`${c.contribution_types?.name} ${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`.slice(0, 40)],
        gerarPdf: true,
      };
      if (contaCorrente) payload.numeroContaCorrente = Number(contaCorrente);

      const r = await api(supabase, "POST", "/boletos", payload);
      if (!r.ok) {
        console.error(`Sicoob emit failed [${r.status}]`, JSON.stringify(r.data));
        return json({ error: "O Sicoob recusou o boleto.", status: r.status, details: r.data }, 502);
      }
      const b = r.data?.resultado || r.data;
      let pdfPath: string | null = null;
      if (b?.pdfBoleto) {
        pdfPath = `boletos/${c.id}.pdf`;
        const bytes = Uint8Array.from(atob(b.pdfBoleto), (ch) => ch.charCodeAt(0));
        await supabase.storage.from("sicoob-private").upload(pdfPath, bytes, { contentType: "application/pdf", upsert: true });
      }
      const { pdfBoleto: _omit, ...rawNoPdf } = b || {};
      await supabase.from("employer_contributions").update({
        sicoob_nosso_numero: b?.nossoNumero ?? null,
        sicoob_linha_digitavel: b?.linhaDigitavel ?? null,
        sicoob_codigo_barras: b?.codigoBarras ?? null,
        sicoob_pdf_path: pdfPath,
        sicoob_situacao: "Em Aberto",
        sicoob_raw: rawNoPdf,
        status: "pending",
        last_sicoob_sync_at: new Date().toISOString(),
      }).eq("id", c.id);
      return json({ ok: true, nosso_numero: b?.nossoNumero, linha_digitavel: b?.linhaDigitavel, has_pdf: !!pdfPath });
    }

    if (!c.sicoob_nosso_numero) return json({ error: "Esta contribuição ainda não tem boleto no Sicoob." }, 400);

    if (action === "consult") {
      const q = new URLSearchParams({ numeroCliente: String(numeroCliente), codigoModalidade: "1", nossoNumero: String(c.sicoob_nosso_numero) });
      if (contaCorrente) q.set("numeroContaCorrente", contaCorrente);
      const r = await api(supabase, "GET", `/boletos?${q}`);
      if (!r.ok) {
        console.error(`Sicoob consult failed [${r.status}]`, JSON.stringify(r.data));
        return json({ error: "Não foi possível consultar no Sicoob.", status: r.status, details: r.data }, 502);
      }
      const b = r.data?.resultado || r.data;
      const situacao: string = b?.situacaoBoleto || "";
      const hist: any[] = b?.listaHistorico || [];
      const pago = /liquidad|baixad.*pag/i.test(situacao);
      const update: Record<string, unknown> = { sicoob_situacao: situacao, last_sicoob_sync_at: new Date().toISOString() };
      if (pago && c.status !== "paid") {
        const liq = hist.find((h) => /liquida/i.test(h?.descricaoHistorico || "")) || {};
        update.status = "paid";
        update.paid_at = liq.dataHistorico ? `${String(liq.dataHistorico).slice(0, 10)}T12:00:00-03:00` : new Date().toISOString();
        update.paid_value = Math.round(Number(b?.valorPago ?? b?.valor ?? c.value / 100) * 100);
        update.payment_method = "boleto";
      }
      await supabase.from("employer_contributions").update(update).eq("id", c.id);
      return json({ ok: true, situacao, pago });
    }

    // pdf
    if (!c.sicoob_pdf_path) return json({ error: "PDF não disponível." }, 404);
    const { data: signed } = await supabase.storage.from("sicoob-private").createSignedUrl(c.sicoob_pdf_path, 3600);
    return json({ ok: true, url: signed?.signedUrl });
  } catch (e: any) {
    console.error("sicoob-boleto exception", e?.message);
    return json({ error: e?.message || "Erro inesperado." }, 500);
  }
});
