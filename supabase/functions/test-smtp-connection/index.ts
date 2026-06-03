import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SMTPLW_API_URL = "https://api.smtplw.com.br/v1/messages";

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout:${label}:${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function isSmtplwHost(host: string): boolean {
  return host.toLowerCase().includes("smtplw.com.br");
}

function isConnectionCanceled(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("operation canceled") || message.includes("timeout:") || message.includes("aborted");
}

interface TestSmtpRequest {
  host: string;
  port: number;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  encryption: string;
  test_email: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[test-smtp-connection] Request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is super admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user is super admin using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: isSuperAdmin } = await supabaseAdmin
      .from("super_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas super admins podem testar SMTP." }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { 
      host, 
      port, 
      username, 
      password, 
      from_email, 
      from_name,
      encryption,
      test_email 
    }: TestSmtpRequest = await req.json();

    console.log(`[test-smtp-connection] Testing SMTP: ${host}:${port}`);

    if (!host || !port || !username || !password || !from_email || !test_email) {
      return new Response(
        JSON.stringify({ error: "Todos os campos são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const subject = "✅ Teste de Configuração SMTP - ProSindWeb";

    // Configure SMTP client
    // Port 465 uses implicit SSL/TLS, Port 587 uses STARTTLS
    const useTls = port === 465 || encryption === "ssl";
    console.log(`[test-smtp-connection] Using TLS: ${useTls} (port: ${port}, encryption: ${encryption})`);
    
    let client: SMTPClient | null = null;

    // Send test email
    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: #f8fafc; padding: 30px; border-radius: 12px; text-align: center;">
          <h1 style="color: #16a34a; margin-bottom: 20px;">✅ Teste de Email Bem-Sucedido!</h1>
          <p style="color: #475569; font-size: 16px;">
            As configurações SMTP do ProsindWeb estão funcionando corretamente.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #94a3b8; font-size: 14px;">
            Servidor: ${host}:${port}<br>
            Data: ${new Date().toLocaleString("pt-BR")}
          </p>
        </div>
      </body>
      </html>
    `;

    try {
      client = new SMTPClient({
        connection: {
          hostname: host,
          port: port,
          tls: useTls,
          auth: {
            username: username,
            password: password,
          },
        },
      });

      await withTimeout(client.send({
        from: `${from_name || "ProSindWeb"} <${from_email}>`,
        to: test_email,
        subject,
        content: "auto",
        html: testHtml,
      }), 20000, "smtp:send");
    } catch (smtpError) {
      const token = Deno.env.get("LOCAWEB_SMTPLW_API_TOKEN");
      if (!isSmtplwHost(host) || !isConnectionCanceled(smtpError) || !token) throw smtpError;

      console.warn("[test-smtp-connection] SMTP direto cancelado; usando fallback SMTPLW API");
      const apiResponse = await withTimeout(fetch(SMTPLW_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-auth-token": token },
        body: JSON.stringify({
          subject,
          body: testHtml,
          from: from_email,
          from_name: from_name || "ProSindWeb",
          to: test_email,
          reply_to: from_email,
        }),
      }), 20000, "smtplw-api:send");

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`SMTPLW API ${apiResponse.status}: ${errorText}`);
      }
    } finally {
      if (client) {
        try {
          await withTimeout(client.close(), 5000, "smtp:close");
        } catch (closeError) {
          console.warn("[test-smtp-connection] SMTP close warning:", closeError);
        }
      }
    }

    console.log(`[test-smtp-connection] Test email sent successfully to ${test_email}`);

    return new Response(
      JSON.stringify({ success: true, message: `Email de teste enviado para ${test_email}` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[test-smtp-connection] Error:", error);
    
    let errorMessage = "Erro ao conectar com servidor SMTP";
    if (error.message?.includes("authentication")) {
      errorMessage = "Falha na autenticação. Verifique usuário e senha.";
    } else if (error.message?.includes("connection")) {
      errorMessage = "Não foi possível conectar ao servidor. Verifique host e porta.";
    } else if (error.message?.includes("timeout")) {
      errorMessage = "Tempo de conexão esgotado. Verifique as configurações de rede.";
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage, details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
