import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Target clinic for SECMI
const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch clinic and union entity data
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name, logo_url, entity_nomenclature")
      .eq("id", TARGET_CLINIC_ID)
      .single();

    const { data: unionEntity } = await supabase
      .from("union_entities")
      .select("razao_social, nome_fantasia, logo_url")
      .eq("clinic_id", TARGET_CLINIC_ID)
      .eq("status", "ativa")
      .maybeSingle();

    // Use union entity data if available, otherwise fall back to clinic
    const entityName = unionEntity?.nome_fantasia || unionEntity?.razao_social || clinic?.name || "Sindicato";
    const logoUrl = unionEntity?.logo_url || clinic?.logo_url || "https://eahhszmbyxapxzilfdlo.supabase.co/storage/v1/object/public/clinic-assets/89e7585e-7bce-4e58-91fa-c37080d1170d/logo.png";
    
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "/sindicato";
    const baseUrl = "https://app.eclini.com.br";

    // Determine page-specific content
    let title = `${entityName} - App do Associado`;
    let description = `Aplicativo oficial do ${entityName}. Agende consultas, acesse sua carteirinha digital e muito mais.`;

    if (path.includes("instalar")) {
      title = `📲 Instale o App - ${entityName}`;
      description = `Baixe o aplicativo oficial do ${entityName}. Carteirinha digital, agendamento 24h e acesso offline aos seus benefícios!`;
    }

    // Generate HTML with proper OG tags
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${title}</title>
  <meta name="title" content="${title}">
  <meta name="description" content="${description}">
  <meta name="author" content="${entityName}">
  <meta name="robots" content="index, follow">
  
  <!-- Favicon -->
  <link rel="icon" type="image/png" href="${logoUrl}">
  <link rel="apple-touch-icon" href="${logoUrl}">
  
  <!-- PWA iOS -->
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="${entityName.substring(0, 12)}">
  <meta name="application-name" content="${entityName.substring(0, 12)}">
  
  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${baseUrl}${path}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${logoUrl}">
  <meta property="og:image:width" content="512">
  <meta property="og:image:height" content="512">
  <meta property="og:image:type" content="image/png">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:site_name" content="${entityName}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:url" content="${baseUrl}${path}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${logoUrl}">
  
  <!-- Theme Color -->
  <meta name="theme-color" content="#16a394">
  <meta name="msapplication-TileColor" content="#16a394">
  
  <!-- Redirect to actual app -->
  <script>
    // Redirect user to the actual app page
    window.location.replace('${baseUrl}/app/instalar');
  </script>
</head>
<body style="background-color: #16a394; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: system-ui, -apple-system, sans-serif;">
  <div style="text-align: center; color: white; padding: 20px;">
    <img 
      src="${logoUrl}" 
      alt="${entityName}" 
      style="width: 80px; height: 80px; border-radius: 16px; margin-bottom: 16px; background: white; padding: 8px;"
    >
    <h1 style="margin: 0 0 8px 0; font-size: 24px;">${entityName}</h1>
    <p style="margin: 0; opacity: 0.9;">Redirecionando para o App...</p>
    <noscript>
      <p style="margin-top: 20px;">
        <a href="${baseUrl}/app/instalar" style="color: white; text-decoration: underline;">
          Clique aqui para acessar o App
        </a>
      </p>
    </noscript>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("[og-sindicato] Error:", error);
    
    // Fallback HTML in case of error
    return new Response(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SECMI - App do Associado</title>
  <meta property="og:title" content="SECMI - App do Associado">
  <meta property="og:description" content="Aplicativo oficial do Sindicato">
  <script>window.location.replace('https://app.eclini.com.br/app/instalar');</script>
</head>
<body>Redirecionando...</body>
</html>`, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }
});
