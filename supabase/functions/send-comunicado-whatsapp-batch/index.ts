import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
const BATCH_SIZE = 30; // por invocação
const DELAY_MS = 800;  // entre envios
const SUBJECT =
  "Comunicado Importante – Alteração Temporária do WhatsApp do Sindicato";

function buildHtml(name: string | null) {
  const greeting = name && name.trim()
    ? `Prezado(a) ${name.trim().split(/\s+/)[0]},`
    : "Prezado(a) associado(a) / Representante da empresa,";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color:#222; max-width:620px; margin:0 auto; padding:20px;">
  <div style="background:#16a394; color:#fff; padding:18px 20px; border-radius:8px 8px 0 0;">
    <h2 style="margin:0; font-size:18px;">Sindicato dos Comerciários de Ilhéus</h2>
    <p style="margin:4px 0 0; font-size:13px; opacity:.9;">Comunicado Oficial</p>
  </div>
  <div style="border:1px solid #e5e7eb; border-top:none; padding:22px; border-radius:0 0 8px 8px; background:#fff;">
    <p>${greeting}</p>
    <p>Informamos que nosso número de <strong>WhatsApp principal (73) 3231-1784</strong> está
    <strong>temporariamente bloqueado pela Meta</strong> (empresa responsável pelo WhatsApp).
    Já estamos em tratativas para uma solução definitiva.</p>

    <p>Enquanto isso, disponibilizamos um <strong>número alternativo temporário</strong> para que
    você não fique sem atendimento:</p>

    <div style="background:#f0fdf4; border:1px solid #16a394; border-radius:8px; padding:14px 18px; margin:14px 0;">
      <p style="margin:0; font-size:16px;">📱 <strong>Novo WhatsApp temporário:</strong>
        <a href="https://wa.me/557331982161" style="color:#16a394; text-decoration:none;"><strong>(73) 3198-2161</strong></a>
      </p>
    </div>

    <p><strong>Importante:</strong></p>
    <ul style="padding-left:18px; line-height:1.55;">
      <li>O telefone fixo <strong>(73) 3231-1784</strong> permanece o mesmo de sempre.</li>
      <li>Nosso endereço web continua o mesmo: <a href="https://secmi.org.br" style="color:#16a394;">secmi.org.br</a>.</li>
      <li>Todos os serviços seguem funcionando normalmente (agendamentos, boletos, carteirinha, homologação etc.).</li>
      <li>Por favor, <strong>salve o novo número</strong> em seus contatos.</li>
      <li>Assim que o WhatsApp principal voltar ao normal, comunicaremos a todos.</li>
    </ul>

    <p>Agradecemos sua compreensão.</p>
    <p style="margin-top:24px;">Atenciosamente,<br><strong>Sindicato dos Comerciários de Ilhéus</strong></p>

    <hr style="border:none; border-top:1px solid #e5e7eb; margin:22px 0;">
    <p style="font-size:12px; color:#666; margin:0;">
      📞 (73) 3231-1784 (telefone fixo) &nbsp;|&nbsp;
      📱 (73) 3198-2161 (WhatsApp temporário)<br>
      🌐 <a href="https://secmi.org.br" style="color:#16a394;">secmi.org.br</a>
    </p>
  </div>
</body></html>`;
}

interface Recipient {
  email: string;
  name: string | null;
  source: "patient" | "employer";
}

async function loadAllRecipients(supabase: any): Promise<Recipient[]> {
  const map = new Map<string, Recipient>();

  // Patients (sócios)
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("patients")
      .select("email, name")
      .eq("clinic_id", SINDICATO_CLINIC_ID)
      .not("email", "is", null)
      .neq("email", "")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      const e = (r.email || "").trim().toLowerCase();
      if (!e || !e.includes("@")) continue;
      if (!map.has(e)) {
        map.set(e, { email: e, name: r.name || null, source: "patient" });
      }
    }
    if (data.length < 1000) break;
    from += 1000;
  }

  // Employers (empresas)
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("employers")
      .select("email, trade_name, name")
      .eq("clinic_id", SINDICATO_CLINIC_ID)
      .not("email", "is", null)
      .neq("email", "")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      const e = (r.email || "").trim().toLowerCase();
      if (!e || !e.includes("@")) continue;
      if (!map.has(e)) {
        map.set(e, {
          email: e,
          name: r.trade_name || r.name || null,
          source: "employer",
        });
      }
    }
    if (data.length < 1000) break;
    from += 1000;
  }

  return Array.from(map.values());
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const offset: number = Number(body.offset || 0);
    const dryRun: boolean = !!body.dryRun;
    const testEmail: string | undefined = body.testEmail;

    // Modo teste: enviar 1 email para testEmail
    if (testEmail) {
      const recipients: Recipient[] = [
        { email: testEmail, name: body.testName || null, source: "patient" },
      ];
      const sent = await sendBatch(recipients);
      return new Response(JSON.stringify({ success: true, mode: "test", sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const all = await loadAllRecipients(supabase);
    console.log(`[comunicado-batch] Total destinatários únicos: ${all.length}`);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          mode: "dryRun",
          total: all.length,
          sample: all.slice(0, 5).map((r) => r.email),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const slice = all.slice(offset, offset + BATCH_SIZE);
    if (slice.length === 0) {
      console.log(`[comunicado-batch] ✓ FINALIZADO em offset=${offset}`);
      return new Response(
        JSON.stringify({ success: true, done: true, total: all.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await sendBatch(slice);
    console.log(
      `[comunicado-batch] Lote offset=${offset} enviados=${result.sent} falhas=${result.failed}`,
    );

    // Agenda próximo lote (recursivo, sem await)
    const nextOffset = offset + BATCH_SIZE;
    if (nextOffset < all.length) {
      const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-comunicado-whatsapp-batch`;
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ offset: nextOffset }),
      }).catch((e) => console.error("[comunicado-batch] erro recursão:", e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        offset,
        processed: slice.length,
        sent: result.sent,
        failed: result.failed,
        total: all.length,
        nextOffset: nextOffset < all.length ? nextOffset : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[comunicado-batch] ERRO:", err?.message, err?.stack);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
};

async function sendBatch(recipients: Recipient[]) {
  const smtpHost = Deno.env.get("SMTP_HOST")!;
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
  const smtpUser = Deno.env.get("SMTP_USER")!;
  const smtpPassword = Deno.env.get("SMTP_PASSWORD")!;
  const smtpFrom = Deno.env.get("SMTP_FROM")!;

  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: { username: smtpUser, password: smtpPassword },
      },
    });
    try {
      await client.send({
        from: smtpFrom,
        to: r.email,
        subject: SUBJECT,
        html: buildHtml(r.name),
      });
      sent++;
      console.log(`[comunicado-batch] ✓ ${r.email}`);
    } catch (e: any) {
      failed++;
      console.error(`[comunicado-batch] ✗ ${r.email}: ${e?.message}`);
    } finally {
      try { await client.close(); } catch (_) {}
    }
    await new Promise((res) => setTimeout(res, DELAY_MS));
  }

  return { sent, failed };
}

serve(handler);