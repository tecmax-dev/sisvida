// Recuperação de senha dos usuários do painel: gera o link oficial de recuperação
// e envia pelo SMTP Locaweb do sistema (mesmo canal dos demais e-mails que chegam).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { adminClient } from "../_shared/authGuard.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ALLOWED_HOSTS = ["prosinge.com.br", "www.prosinge.com.br", "sindexa.com.br", "www.sindexa.com.br", "prosindweb.com.br", "www.prosindweb.com.br", "app.eclini.com.br", "prosinge.lovable.app"];

function safeRedirect(raw: unknown): string {
  try {
    const u = new URL(String(raw));
    if (ALLOWED_HOSTS.includes(u.hostname) || u.hostname.endsWith(".lovableproject.com") || u.hostname.endsWith(".lovable.app")) return u.toString();
  } catch { /* ignore */ }
  return "https://prosinge.com.br/auth";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { email, redirectTo } = await req.json().catch(() => ({}));
    const addr = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return json({ success: false, error: "E-mail inválido" }, 400);

    const db = adminClient();
    const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email: addr, options: { redirectTo: safeRedirect(redirectTo) } });
    // Não revela se o e-mail existe
    if (error || !data?.properties?.action_link) {
      console.log("[staff-password-reset] no link:", error?.message);
      return json({ success: true });
    }

    const host = Deno.env.get("SMTP_HOST");
    const user = Deno.env.get("SMTP_USER");
    const pass = Deno.env.get("SMTP_PASSWORD");
    const from = Deno.env.get("SMTP_FROM") || "noreply@prosindweb.com.br";
    const port = Number(Deno.env.get("SMTP_PORT") || "587");
    if (!host || !user || !pass) throw new Error("Envio de e-mail não configurado");

    const link = data.properties.action_link;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px">
<h2 style="margin:0 0 16px;color:#0f766e">Redefinição de senha</h2>
<p>Recebemos um pedido para redefinir a senha do seu acesso ao painel.</p>
<p style="margin:24px 0"><a href="${link}" style="display:inline-block;padding:12px 28px;background:#16a394;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Criar nova senha</a></p>
<p style="font-size:13px;color:#6b7280">O link vale por tempo limitado e só pode ser usado uma vez. Se você não pediu, ignore este e-mail.</p>
</div></body></html>`;

    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    const client = new SMTPClient({ connection: { hostname: host, port, tls: port === 465, auth: { username: user, password: pass } } });
    try {
      await client.send({ from, to: addr, subject: "Redefinição de senha", html, content: "auto" });
    } finally {
      await client.close();
    }
    console.log("[staff-password-reset] sent");
    return json({ success: true });
  } catch (e) {
    console.error("[staff-password-reset]", e);
    return json({ success: false, error: "Não foi possível enviar o e-mail agora." }, 500);
  }
});
