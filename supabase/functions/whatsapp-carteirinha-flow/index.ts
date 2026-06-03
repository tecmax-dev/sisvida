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
 *                     competência + 60 dias, registra payslip_request approved,
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

/** Gera variantes do telefone para casar com `patients.phone` (BR DDD+número). */
function phoneVariants(rawPhone: string): string[] {
  const digits = (rawPhone || "").replace(/\D/g, "");
  if (!digits) return [];
  const variants = new Set<string>();
  variants.add(digits);
  let local = digits.startsWith("55") ? digits.slice(2) : digits;
  variants.add(local);
  if (local.length === 11 && local[2] === "9") {
    variants.add(local.slice(0, 2) + local.slice(3));
  } else if (local.length === 10) {
    variants.add(local.slice(0, 2) + "9" + local.slice(2));
  }
  return Array.from(variants).filter(Boolean);
}

/** Identifica associado pelo telefone (cache + patients.phone). */
async function tryAutoIdentifyByPhone(
  supabase: any,
  phone: string,
): Promise<{ id: string; name: string; employer_name: string | null; employer_cnpj: string | null } | null> {
  const { data: cached } = await supabase
    .from("whatsapp_phone_identity")
    .select("patient_id")
    .eq("clinic_id", SINDICATO_CLINIC_ID)
    .eq("phone", phone)
    .maybeSingle();

  if (cached?.patient_id) {
    const { data: p } = await supabase
      .from("patients")
      .select("id, name, employer_name, employer_cnpj")
      .eq("id", cached.patient_id)
      .maybeSingle();
    if (p) return p;
  }

  const variants = phoneVariants(phone);
  if (variants.length === 0) return null;

  const { data: matches } = await supabase
    .from("patients")
    .select("id, name, employer_name, employer_cnpj")
    .eq("clinic_id", SINDICATO_CLINIC_ID)
    .in("phone", variants)
    .limit(2);

  if (!matches || matches.length !== 1) return null;

  await supabase
    .from("whatsapp_phone_identity")
    .upsert(
      {
        clinic_id: SINDICATO_CLINIC_ID,
        phone,
        patient_id: matches[0].id,
        identified_via: "phone",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clinic_id,phone" },
    );

  return matches[0];
}

async function rememberPhoneIdentity(
  supabase: any,
  phone: string,
  patientId: string,
  via: "cpf" | "phone",
) {
  await supabase
    .from("whatsapp_phone_identity")
    .upsert(
      {
        clinic_id: SINDICATO_CLINIC_ID,
        phone,
        patient_id: patientId,
        identified_via: via,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clinic_id,phone" },
    );
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
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function toDateOnly(value?: string | null): string | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${m}-${d}`;
}

function compareDateOnly(a?: string | null, b?: string | null): number {
  const da = toDateOnly(a);
  const db = toDateOnly(b);
  if (!da && !db) return 0;
  if (!da) return -1;
  if (!db) return 1;
  return da.localeCompare(db);
}

/**
 * Calcula a nova validade seguindo a competência do contracheque:
 *  - Último dia do mês de competência + 60 dias.
 *
 * Assim, contracheques de competências mais antigas geram validades menores
 * (os dias já passados desde o fim da competência são naturalmente descontados),
 * e contracheques mais recentes geram validades maiores — sem retroceder o que
 * o associado já tem.
 */
function calcNewExpiry(competenceMonth: number, competenceYear: number): string {
  const lastDay = new Date(Date.UTC(competenceYear, competenceMonth, 0));
  lastDay.setUTCDate(lastDay.getUTCDate() + 60);
  const y = lastDay.getUTCFullYear();
  const m = String(lastDay.getUTCMonth() + 1).padStart(2, "0");
  const d = String(lastDay.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Faz upload do contracheque ao bucket "contra-cheques" e registra a referência
 * nos anexos do cadastro do associado (patient_attachments), organizado em
 * pastas "Aprovados" / "Reprovados" para auditoria futura.
 */
async function archivePayslipToMember(
  supabase: any,
  opts: {
    clinicId: string;
    patientId: string;
    bytes: Uint8Array;
    mimeType: string;
    status: "approved" | "rejected";
    originalFileName?: string;
    rejectionReason?: string;
  },
): Promise<string | null> {
  try {
    const ext = opts.mimeType.includes("png")
      ? "png"
      : opts.mimeType.includes("webp")
      ? "webp"
      : opts.mimeType.includes("pdf")
      ? "pdf"
      : "jpg";
    const subDir = opts.status === "approved" ? "Aprovados" : "Reprovados";
    const filePath = `${opts.clinicId}/${opts.patientId}/${subDir}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("contra-cheques")
      .upload(filePath, opts.bytes, { contentType: opts.mimeType, upsert: true });
    if (upErr) {
      console.error("[carteirinha] archive upload error", upErr);
      return null;
    }

    // Localiza/cria pasta raiz "Contra cheques"
    let rootFolderId: string | null = null;
    const { data: roots } = await supabase
      .from("patient_folders")
      .select("id")
      .eq("clinic_id", opts.clinicId)
      .eq("patient_id", opts.patientId)
      .ilike("name", "%contra%cheque%")
      .is("parent_folder_id", null)
      .limit(1);
    if (roots && roots.length > 0) {
      rootFolderId = roots[0].id;
    } else {
      const { data: newRoot } = await supabase
        .from("patient_folders")
        .insert({
          clinic_id: opts.clinicId,
          patient_id: opts.patientId,
          name: "Contra cheques",
        })
        .select("id")
        .single();
      rootFolderId = newRoot?.id || null;
    }

    // Subpasta Aprovados / Reprovados
    let subFolderId: string | null = rootFolderId;
    if (rootFolderId) {
      const { data: subs } = await supabase
        .from("patient_folders")
        .select("id")
        .eq("clinic_id", opts.clinicId)
        .eq("patient_id", opts.patientId)
        .eq("parent_folder_id", rootFolderId)
        .ilike("name", subDir)
        .limit(1);
      if (subs && subs.length > 0) {
        subFolderId = subs[0].id;
      } else {
        const { data: newSub } = await supabase
          .from("patient_folders")
          .insert({
            clinic_id: opts.clinicId,
            patient_id: opts.patientId,
            parent_folder_id: rootFolderId,
            name: subDir,
          })
          .select("id")
          .single();
        subFolderId = newSub?.id || rootFolderId;
      }
    }

    const label = opts.status === "approved" ? "Aprovado" : "Reprovado";
    const description = opts.status === "approved"
      ? "Contracheque enviado via WhatsApp e aprovado automaticamente"
      : `Contracheque enviado via WhatsApp e reprovado automaticamente${opts.rejectionReason ? `: ${opts.rejectionReason}` : ""}`;

    await supabase.from("patient_attachments").insert({
      clinic_id: opts.clinicId,
      patient_id: opts.patientId,
      folder_id: subFolderId,
      file_name: `Contracheque WhatsApp (${label}) - ${opts.originalFileName || `${Date.now()}.${ext}`}`,
      file_type: opts.mimeType,
      file_size: opts.bytes.byteLength,
      file_path: `contra-cheques:${filePath}`,
      description,
    });

    return filePath;
  } catch (err) {
    console.error("[carteirinha] archivePayslipToMember failed", err);
    return null;
  }
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
          "Para começar, *digite o CPF do associado titular* (somente números, 11 dígitos).\n\n" +
          "_Não envie foto/documento do CPF — basta digitar os números aqui no chat._",
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
            "❌ CPF inválido. *Digite os 11 números do CPF* do associado titular (sem pontos, traços ou foto).",
          buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
        });
      }

      // localiza titular no sindicato
      const { data: patient } = await supabase
        .from("patients")
        .select("id, name, clinic_id, employer_name, employer_cnpj")
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

      // Carrega dados de empregador do titular para validação antifraude
      const { data: patientEmployer } = await supabase
        .from("patients")
        .select("employer_name, employer_cnpj")
        .eq("id", session.patient_id)
        .maybeSingle();

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
            employer_name: patientEmployer?.employer_name || null,
            employer_cnpj: patientEmployer?.employer_cnpj || null,
            clinic_id: SINDICATO_CLINIC_ID,
          }),
        },
      );
      const verifyData = await verifyRes.json().catch(() => ({}));
      console.log("[carteirinha] verify result", JSON.stringify(verifyData));

      if (!verifyData?.is_payslip) {
        // Arquiva o contracheque reprovado nos anexos do associado para auditoria
        await archivePayslipToMember(supabase, {
          clinicId: SINDICATO_CLINIC_ID,
          patientId: session.patient_id,
          bytes,
          mimeType,
          status: "rejected",
          originalFileName: body.media_filename,
          rejectionReason: verifyData?.message,
        });
        return json({
          success: true,
          response:
            `❌ Não consegui validar o contracheque.\n\n${verifyData?.message || "Envie uma foto nítida do contracheque mais recente, mostrando os descontos sindicais."}\n\nVocê pode tentar novamente ou tocar em *Cancelar*.`,
          buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
        });
      }

      // 5) determina competência. Exige mês/ano real do contracheque;
      // nunca usa mês atual como fallback para evitar validade indevida.
      let compMonth: number | null = null;
      let compYear: number | null = null;
      // tentativa: campos opcionais no payload
      const rawCompMonth = (verifyData as any).competence_month;
      const rawCompYear = (verifyData as any).competence_year;
      const parsedCompMonth = Number(rawCompMonth);
      const parsedCompYear = Number(rawCompYear);
      if (
        Number.isInteger(parsedCompMonth) &&
        Number.isInteger(parsedCompYear) &&
        parsedCompMonth >= 1 &&
        parsedCompMonth <= 12 &&
        parsedCompYear >= 2000
      ) {
        compMonth = parsedCompMonth;
        compYear = parsedCompYear;
      }
      if (!compMonth || !compYear) {
        await archivePayslipToMember(supabase, {
          clinicId: SINDICATO_CLINIC_ID,
          patientId: session.patient_id,
          bytes,
          mimeType,
          status: "rejected",
          originalFileName: body.media_filename,
          rejectionReason: "Competência não identificada no contracheque.",
        });
        return json({
          success: true,
          response:
            "❌ Não consegui identificar a competência do contracheque. Envie uma foto mais nítida mostrando o mês/ano de referência.",
          buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
        });
      }

      const newExpiresAt = calcNewExpiry(compMonth, compYear);
      const todayIso = new Date().toISOString().slice(0, 10);
      if (compareDateOnly(newExpiresAt, todayIso) < 0) {
        await archivePayslipToMember(supabase, {
          clinicId: SINDICATO_CLINIC_ID,
          patientId: session.patient_id,
          bytes,
          mimeType,
          status: "rejected",
          originalFileName: body.media_filename,
          rejectionReason: `Competência ${String(compMonth).padStart(2, "0")}/${compYear} gera validade vencida em ${formatBR(newExpiresAt)}.`,
        });
        return json({
          success: true,
          response:
            `❌ Esse contracheque não pode renovar a carteirinha, pois a competência ${String(compMonth).padStart(2, "0")}/${compYear} gera validade somente até ${formatBR(newExpiresAt)}. Envie um contracheque mais recente.`,
          buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
        });
      }

      // 6) arquiva o contracheque aprovado (upload + anexo na pasta Aprovados)
      const filePath = await archivePayslipToMember(supabase, {
        clinicId: SINDICATO_CLINIC_ID,
        patientId: session.patient_id,
        bytes,
        mimeType,
        status: "approved",
        originalFileName: body.media_filename,
      });
      if (!filePath) {
        return json({
          success: true,
          response: "❌ Erro ao salvar o contracheque. Tente novamente.",
          buttons: [{ id: "carteirinha_cancelar", title: "Cancelar" }],
        });
      }

      // 7) localiza/atualiza patient_cards. Se houver duplicidade ativa,
      // usa sempre a maior validade para nunca escolher uma carteirinha antiga.
      const { data: activeCards } = await supabase
        .from("patient_cards")
        .select("id, expires_at")
        .eq("patient_id", session.patient_id)
        .eq("is_active", true)
        .order("expires_at", { ascending: false });
      const existingCard = Array.isArray(activeCards) && activeCards.length > 0 ? activeCards[0] : null;

      let cardId: string | null = existingCard?.id || null;
      let finalExpiresAt = newExpiresAt;
      let keptCurrent = false;
      const currentExpiresAt = toDateOnly(existingCard?.expires_at) || null;
      if (currentExpiresAt && compareDateOnly(currentExpiresAt, newExpiresAt) >= 0) {
        // Nunca retroceder a validade: mantém a validade atual se já for maior.
        finalExpiresAt = currentExpiresAt;
        keptCurrent = true;
      }
      if (cardId) {
        if (!keptCurrent) {
          await supabase
            .from("patient_cards")
            .update({ expires_at: finalExpiresAt })
            .eq("id", cardId);
        }
        if (Array.isArray(activeCards) && activeCards.length > 1) {
          const olderActiveIds = activeCards
            .slice(1)
            .map((card: any) => card.id)
            .filter(Boolean);
          if (olderActiveIds.length > 0) {
            await supabase
              .from("patient_cards")
              .update({ expires_at: finalExpiresAt })
              .in("id", olderActiveIds);
          }
        }
      } else {
        const { data: newCard, error: cardErr } = await supabase
          .from("patient_cards")
          .insert({
            patient_id: session.patient_id,
            clinic_id: SINDICATO_CLINIC_ID,
            expires_at: finalExpiresAt,
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

      await supabase
        .from("patient_dependents")
        .update({ card_expires_at: finalExpiresAt })
        .eq("patient_id", session.patient_id)
        .eq("is_active", true);

      // 8) registra payslip_request como approved (auto, via whatsapp)
      await supabase.from("payslip_requests").insert({
        clinic_id: SINDICATO_CLINIC_ID,
        patient_id: session.patient_id,
        card_id: cardId,
        status: "approved",
        received_at: nowIso,
        reviewed_at: nowIso,
        attachment_path: filePath,
        notes:
          `Aprovado automaticamente via WhatsApp. Competência: ${String(compMonth).padStart(2, "0")}/${compYear}.` +
          (keptCurrent
            ? ` Validade atual (${finalExpiresAt}) é igual ou maior que a calculada (${newExpiresAt}); mantida a vigente.`
            : ""),
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
          (keptCurrent
            ? `✅ *Contracheque validado, ${firstName}!*\n\n` +
              `📄 Competência considerada: ${String(compMonth).padStart(2, "0")}/${compYear}\n` +
              `📅 Sua carteirinha já está válida até *${formatBR(finalExpiresAt)}*, uma data igual ou posterior à gerada por este contracheque (${formatBR(newExpiresAt)}).\n\n` +
              `Mantivemos sua validade atual — não houve retrocesso.\n\nObrigado!`
            : `✅ *Carteirinha renovada com sucesso, ${firstName}!*\n\n` +
              `📅 Nova validade: *${formatBR(finalExpiresAt)}*\n` +
              `📄 Competência considerada: ${String(compMonth).padStart(2, "0")}/${compYear}\n\n` +
              `Os dependentes vinculados também foram atualizados automaticamente.\n\n` +
              `Obrigado!`),
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