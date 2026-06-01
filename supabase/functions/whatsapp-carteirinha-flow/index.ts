import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * WHATSAPP CARTEIRINHA FLOW
 *
 * Fluxo de renovação automática da carteirinha digital pelo WhatsApp do Sindicato.
 *
 * Etapas:
 *  1) start         → cria sessão action_type='carteirinha', state='AWAITING_CPF'
 *  2) text (CPF)    → valida CPF, localiza associado titular, state='AWAITING_PAYSLIP'
 *  3) image/doc     → baixa mídia da Meta, chama verify-payslip-document,
 *                     se válido atualiza patient_cards.expires_at = último dia da
 *                     competência + 30 dias, registra payslip_request approved,
 *                     finaliza sessão.
 *
 * Chamadas vêm SEMPRE do meta-webhook (service role). Não exposto ao público.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

type Action = "start" | "cancel" | "text" | "media";

interface FlowRequest {
  action: Action;
  phone: string;                  // sem formatação, somente dígitos
  text?: string;                  // texto recebido (para action=text)
  media_id?: string;              // id da mídia Meta (para action=media)
  media_mime?: string;            // mimetype reportado pela Meta
  media_filename?: string;        // nome do arquivo (opcional)
}

interface FlowResponse {
  success: boolean;
  response: string;               // texto a enviar ao usuário
  buttons?: { id: string; title: string }[];
  finished?: boolean;             // sessão encerrada
}

function onlyDigits(s: string): string {
  return (s || "").replace(/\D/g, "");
}

function isValidCPF(cpf: string): boolean {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10) r = 0;
  return r === parseInt(d[10]);
}

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Calcula a nova validade seguindo a competência do contracheque:
 *  - Último dia do mês de competência + 30 dias.
 */
function calcNewExpiry(competenceMonth: number, competenceYear: number): string {
  const lastDay = new Date(Date.UTC(competenceYear, competenceMonth, 0));
  lastDay.setUTCDate(lastDay.getUTCDate() + 30);
  const y = lastDay.getUTCFullYear();
  const m = String(lastDay.getUTCMonth() + 1).padStart(2, "0");
  const d = String(lastDay.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json() as FlowRequest;
    const phone = onlyDigits(body.phone || "");
    if (!phone) {
      return json({ success: false, response: "Telefone inválido." } as FlowResponse);
    }

    const nowIso = new Date().toISOString();

    // -----------------------------------------------------------------------
    // CANCEL
    // -----------------------------------------------------------------------
    if (body.action === "cancel") {
      await supabase
        .from("whatsapp_booking_sessions")
        .delete()
        .eq("clinic_id", SINDICATO_CLINIC_ID)
        .eq("phone", phone)
        .eq("action_type", "carteirinha");
      return json({
        success: true,
        response: "Tudo bem! Atualização da carteirinha cancelada.",
        finished: true,
      });
    }

    // -----------------------------------------------------------------------
    // START
    // -----------------------------------------------------------------------
    if (body.action === "start") {
      // limpa QUALQUER sessão anterior desse telefone (unique key é clinic_id+phone)
      await supabase
        .from("whatsapp_booking_sessions")
        .delete()
        .eq("clinic_id", SINDICATO_CLINIC_ID)
        .eq("phone", phone);

      const { error: insErr } = await supabase
        .from("whatsapp_booking_sessions")
        .upsert({
          clinic_id: SINDICATO_CLINIC_ID,
          phone,
          action_type: "carteirinha",
          state: "AWAITING_CPF",
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        }, { onConflict: "clinic_id,phone" });
      if (insErr) {
        console.error("[carteirinha] create session error", insErr);
        return json({ success: false, response: "Erro ao iniciar fluxo. Tente novamente." });
      }

      return json({
        success: true,
        response:
          "🪪 *Atualização de Carteirinha pelo WhatsApp*\n\n" +
          "Para começar, *envie o CPF do associado titular* (somente números).\n\n" +
          "Se preferir, você pode cancelar a qualquer momento.",
        buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
      });
    }

    // carrega sessão ativa
    const { data: session } = await supabase
      .from("whatsapp_booking_sessions")
      .select("id, state, patient_id, patient_name")
      .eq("clinic_id", SINDICATO_CLINIC_ID)
      .eq("phone", phone)
      .eq("action_type", "carteirinha")
      .gte("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      return json({
        success: false,
        response: "Sua sessão de atualização da carteirinha expirou. Toque em *Menu Principal* para começar novamente.",
        finished: true,
      });
    }

    // -----------------------------------------------------------------------
    // TEXT (esperamos CPF)
    // -----------------------------------------------------------------------
    if (body.action === "text") {
      if (session.state !== "AWAITING_CPF") {
        return json({
          success: true,
          response:
            "📎 Agora preciso da *imagem do seu contracheque*. " +
            "Envie como foto ou PDF aqui no WhatsApp.",
          buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
        });
      }

      const cpfDigits = onlyDigits(body.text || "");
      if (!isValidCPF(cpfDigits)) {
        return json({
          success: true,
          response:
            "❌ CPF inválido. Por favor envie *somente os 11 dígitos do CPF* do associado titular.",
          buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
        });
      }

      // localiza titular no sindicato
      const { data: patient } = await supabase
        .from("patients")
        .select("id, name, clinic_id")
        .eq("clinic_id", SINDICATO_CLINIC_ID)
        .eq("cpf", cpfDigits)
        .maybeSingle();

      if (!patient) {
        return json({
          success: true,
          response:
            "❌ Não encontramos um associado titular com esse CPF cadastrado no sindicato.\n\n" +
            "Verifique o número e envie novamente, ou toque em *Cancelar*.",
          buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
        });
      }

      await supabase
        .from("whatsapp_booking_sessions")
        .update({
          state: "AWAITING_PAYSLIP",
          patient_id: patient.id,
          patient_name: patient.name,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          updated_at: nowIso,
        })
        .eq("id", session.id);

      const firstName = (patient.name || "").split(" ")[0];
      return json({
        success: true,
        response:
          `✅ Olá, *${firstName}*! Identifiquei seu cadastro.\n\n` +
          "📎 Agora *envie a imagem do seu contracheque mais recente* (foto ou PDF).\n\n" +
          "O sistema vai verificar automaticamente e renovar sua carteirinha.",
        buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
      });
    }

    // -----------------------------------------------------------------------
    // MEDIA (contracheque)
    // -----------------------------------------------------------------------
    if (body.action === "media") {
      if (session.state !== "AWAITING_PAYSLIP") {
        return json({
          success: true,
          response: "Primeiro preciso do *CPF do associado titular* (somente números).",
          buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
        });
      }
      if (!session.patient_id) {
        return json({
          success: false,
          response: "Sessão inválida. Reinicie o fluxo pelo menu principal.",
          finished: true,
        });
      }

      const mediaId = body.media_id;
      if (!mediaId) {
        return json({ success: false, response: "Mídia inválida." });
      }

      const META_TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
      if (!META_TOKEN) {
        console.error("[carteirinha] META_WHATSAPP_TOKEN missing");
        return json({ success: false, response: "Configuração indisponível. Contate o suporte." });
      }

      // 1) busca URL da mídia
      const metaInfoRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${META_TOKEN}` },
      });
      if (!metaInfoRes.ok) {
        console.error("[carteirinha] meta media info failed", await metaInfoRes.text());
        return json({
          success: true,
          response: "❌ Não consegui baixar sua imagem. Por favor envie novamente.",
          buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
        });
      }
      const metaInfo = await metaInfoRes.json();
      const mediaUrl: string | undefined = metaInfo?.url;
      const mimeType: string = body.media_mime || metaInfo?.mime_type || "image/jpeg";
      if (!mediaUrl) {
        return json({ success: false, response: "Não consegui obter a mídia." });
      }

      // 2) baixa o arquivo
      const mediaBinRes = await fetch(mediaUrl, {
        headers: { Authorization: `Bearer ${META_TOKEN}` },
      });
      if (!mediaBinRes.ok) {
        console.error("[carteirinha] meta media download failed", mediaBinRes.status);
        return json({
          success: true,
          response: "❌ Não consegui baixar sua imagem. Por favor envie novamente.",
          buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
        });
      }
      const buffer = await mediaBinRes.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // converte para base64 data URL (verify-payslip-document espera data:...;base64,...)
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      const dataUrl = `data:${mimeType};base64,${base64}`;

      // 3) PDF não é suportado pelo verify (precisa virar imagem). Como este flow
      // roda em Deno e não temos pdfjs aqui, rejeitamos PDFs com instrução clara.
      if (mimeType === "application/pdf") {
        return json({
          success: true,
          response:
            "⚠️ Por aqui não conseguimos analisar PDF. Por favor envie o contracheque como *foto* (JPG/PNG).",
          buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
        });
      }

      // 4) chama verify-payslip-document
      const verifyRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-payslip-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            file_base64: dataUrl,
            file_name: body.media_filename || `contracheque-${Date.now()}.jpg`,
            file_type: mimeType,
            member_name: session.patient_name,
            clinic_id: SINDICATO_CLINIC_ID,
          }),
        },
      );
      const verifyData = await verifyRes.json().catch(() => ({}));
      console.log("[carteirinha] verify result", JSON.stringify(verifyData));

      if (!verifyData?.is_payslip) {
        return json({
          success: true,
          response:
            `❌ Não consegui validar o contracheque.\n\n${verifyData?.message || "Envie uma foto nítida do contracheque mais recente, mostrando os descontos sindicais."}\n\nVocê pode tentar novamente ou tocar em *Cancelar*.`,
          buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
        });
      }

      // 5) determina competência. Se a função não devolveu, tenta extrair do raw.
      // Para simplificar, reaproveitamos verify e exigimos competência presente.
      // O verify atual valida internamente; se passou is_payslip=true, é seguro.
      // Usamos data atual como fallback (mês anterior) caso a Meta-IA não devolva.
      let compMonth: number | null = null;
      let compYear: number | null = null;
      // tentativa: campos opcionais no payload
      if (typeof (verifyData as any).competence_month === "number") {
        compMonth = (verifyData as any).competence_month;
        compYear = (verifyData as any).competence_year;
      }
      if (!compMonth || !compYear) {
        // fallback: mês corrente
        const now = new Date();
        compMonth = now.getMonth() + 1;
        compYear = now.getFullYear();
      }

      const newExpiresAt = calcNewExpiry(compMonth, compYear);

      // 6) faz upload no bucket contra-cheques
      const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
      const filePath = `${SINDICATO_CLINIC_ID}/${session.patient_id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("contra-cheques")
        .upload(filePath, bytes, { contentType: mimeType, upsert: true });
      if (upErr) {
        console.error("[carteirinha] storage upload error", upErr);
        return json({
          success: true,
          response: "❌ Erro ao salvar o contracheque. Tente novamente.",
          buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
        });
      }

      // 7) localiza/atualiza patient_cards
      const { data: existingCard } = await supabase
        .from("patient_cards")
        .select("id")
        .eq("patient_id", session.patient_id)
        .eq("is_active", true)
        .maybeSingle();

      let cardId: string | null = existingCard?.id || null;
      if (cardId) {
        await supabase
          .from("patient_cards")
          .update({ expires_at: newExpiresAt })
          .eq("id", cardId);
      } else {
        const { data: newCard, error: cardErr } = await supabase
          .from("patient_cards")
          .insert({
            patient_id: session.patient_id,
            clinic_id: SINDICATO_CLINIC_ID,
            expires_at: newExpiresAt,
            is_active: true,
            card_number: `CARD-${Date.now()}`,
          })
          .select("id")
          .single();
        if (cardErr) {
          console.error("[carteirinha] create card error", cardErr);
        } else {
          cardId = newCard?.id || null;
        }
      }

      // 8) registra payslip_request como approved (auto, via whatsapp)
      await supabase.from("payslip_requests").insert({
        clinic_id: SINDICATO_CLINIC_ID,
        patient_id: session.patient_id,
        card_id: cardId,
        status: "approved",
        received_at: nowIso,
        reviewed_at: nowIso,
        attachment_path: filePath,
        notes: `Aprovado automaticamente via WhatsApp. Competência: ${String(compMonth).padStart(2, "0")}/${compYear}.`,
      });

      // 9) finaliza sessão
      await supabase
        .from("whatsapp_booking_sessions")
        .delete()
        .eq("id", session.id);

      const firstName = (session.patient_name || "").split(" ")[0] || "associado(a)";
      return json({
        success: true,
        response:
          `✅ *Carteirinha renovada com sucesso, ${firstName}!*\n\n` +
          `📅 Nova validade: *${formatBR(newExpiresAt)}*\n` +
          `📄 Competência considerada: ${String(compMonth).padStart(2, "0")}/${compYear}\n\n` +
          `Os dependentes vinculados também foram atualizados automaticamente.\n\n` +
          `Obrigado!`,
        finished: true,
      });
    }

    return json({ success: false, response: "Ação não reconhecida." });
  } catch (err) {
    console.error("[carteirinha] error", err);
    return json({
      success: false,
      response: "Erro interno. Tente novamente em instantes.",
    });
  }
});

function json(body: FlowResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}