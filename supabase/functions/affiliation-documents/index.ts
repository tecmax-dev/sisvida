// Central de Filiações: processamento automático após aprovação, listagem para
// sindicato/portais, abertura da ficha e confirmação de ciência pela empresa/contador.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { adminClient, getAuthContext } from "../_shared/authGuard.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const CARD_DAYS = 30;

type DB = ReturnType<typeof adminClient>;

async function logEvent(db: DB, e: { clinic_id: string; document_id?: string | null; associado_id?: string | null; employer_id?: string | null; event: string; actor?: string | null; details?: Record<string, unknown> }) {
  await db.from("affiliation_document_events").insert({ details: {}, ...e });
}

async function canAccessClinic(db: DB, userId: string, isSuperAdmin: boolean, clinicId: string) {
  if (isSuperAdmin) return true;
  const { data } = await db.from("user_roles").select("id").eq("user_id", userId).eq("clinic_id", clinicId).limit(1);
  return (data ?? []).length > 0;
}

/** Resolve os CNPJs/empresas que o portal pode ver. */
async function portalEmployerIds(db: DB, portalType: string, portalId: string): Promise<string[]> {
  if (!portalId) return [];
  if (portalType === "employer") return [portalId];
  if (portalType === "accounting_office") {
    const { data } = await db.from("accounting_office_employers").select("employer_id").eq("accounting_office_id", portalId);
    return (data ?? []).map((r: any) => r.employer_id);
  }
  return [];
}

async function ensureCompanyDoc(db: DB, a: any, employer: any, clinicId: string, associadoId: string, actor: string): Promise<string> {
  let documentId: string;
  const { data: existing } = await db.from("affiliation_company_documents").select("id").eq("associado_id", associadoId).eq("source", "auto").maybeSingle();
  if (existing) {
    documentId = existing.id;
  } else {
    const snapshot = {
      nome: a.nome, cpf: a.cpf, rg: a.rg, data_nascimento: a.data_nascimento, sexo: a.sexo,
      estado_civil: a.estado_civil, nome_mae: a.nome_mae, telefone: a.telefone, email: a.email,
      endereco: [a.logradouro, a.numero, a.bairro, a.cidade, a.uf].filter(Boolean).join(", "),
      cargo: a.cargo ?? a.funcao, data_admissao: a.data_admissao, salario: a.salario,
      empresa_razao_social: a.empresa_razao_social || employer.name, empresa_cnpj: employer.cnpj,
      matricula: a.matricula, forma_pagamento: a.forma_pagamento, valor_contribuicao: a.valor_contribuicao,
      assinatura_digital_url: a.assinatura_digital_url, assinatura_aceite_desconto: a.assinatura_aceite_desconto,
      assinatura_aceite_at: a.assinatura_aceite_at, aprovado_at: a.aprovado_at, created_at: a.created_at,
    };
    // Aviso de reclassificação: trabalhador estava na Taxa Negocial
    let notice = false;
    const { data: workers } = await db.from("employer_workers").select("cpf, name_norm, contribution_types(name)")
      .eq("employer_id", employer.id).eq("active", true);
    const nameNorm = String(a.nome ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    notice = (workers ?? []).some((w: any) =>
      ((w.cpf && digits(w.cpf) === digits(a.cpf)) || (w.name_norm && String(w.name_norm).toUpperCase() === nameNorm)) &&
      /negocial/i.test(w.contribution_types?.name ?? ""));
    const { data: doc, error: docErr } = await db.from("affiliation_company_documents").insert({
      clinic_id: clinicId, associado_id: associadoId, employer_id: employer.id, employer_cnpj: employer.cnpj,
      worker_name: a.nome, worker_cpf: a.cpf, source: "auto", snapshot, approved_at: a.aprovado_at,
      classification_notice: notice,
    }).select("id").single();
    if (docErr) {
      // corrida: outro processamento já criou
      const { data: again } = await db.from("affiliation_company_documents").select("id").eq("associado_id", associadoId).eq("source", "auto").maybeSingle();
      if (!again) throw docErr;
      documentId = again.id;
    } else {
      documentId = doc.id;
      await logEvent(db, { clinic_id: clinicId, document_id: documentId, associado_id: associadoId, employer_id: employer.id, event: "made_available", actor, details: { employer_cnpj: employer.cnpj, classification_notice: notice } });
    }
  }

  return documentId;
}

async function processApproval(db: DB, associadoId: string, actor: string) {
  const { data: a, error } = await db.from("sindical_associados").select("*").eq("id", associadoId).maybeSingle();
  if (error || !a) throw new Error("Associado não encontrado");
  if (a.status !== "ativo") throw new Error("Filiação ainda não aprovada");
  const { data: ue } = await db.from("union_entities").select("clinic_id").eq("id", a.sindicato_id).maybeSingle();
  const clinicId = ue?.clinic_id;
  if (!clinicId) throw new Error("Sindicato sem clínica vinculada");

  const { data: prevJob } = await db.from("affiliation_processing_jobs").select("*").eq("associado_id", associadoId).maybeSingle();
  await db.from("affiliation_processing_jobs").upsert({
    associado_id: associadoId, clinic_id: clinicId, status: "pending",
    attempts: (prevJob?.attempts ?? 0) + 1, updated_at: new Date().toISOString(),
  });
  if (!prevJob) await logEvent(db, { clinic_id: clinicId, associado_id: associadoId, event: "approved", actor, details: { aprovado_at: a.aprovado_at, aprovado_por: a.aprovado_por } });

  const result: Record<string, unknown> = {};
  const errors: string[] = [];

  // 1) Carteirinha inicial de 30 dias (sem duplicar)
  try {
    const cpf = digits(a.cpf);
    const { data: pts } = await db.from("patients").select("id, cpf").eq("clinic_id", clinicId)
      .in("cpf", [cpf, a.cpf].filter(Boolean)).limit(1);
    const patientId = pts?.[0]?.id;
    if (!patientId) throw new Error("Cadastro do associado não encontrado para gerar carteirinha");
    const { data: active } = await db.from("patient_cards").select("id, expires_at").eq("patient_id", patientId)
      .eq("is_active", true).gt("expires_at", new Date().toISOString()).limit(1);
    if (active?.[0]) {
      result.card_id = active[0].id;
      result.card_reused = true;
    } else {
      const { data: num, error: numErr } = await db.rpc("generate_card_number", { p_clinic_id: clinicId, p_patient_id: patientId });
      if (numErr || !num) throw new Error("Falha ao gerar número da carteirinha");
      const approvedAt = a.aprovado_at ? new Date(a.aprovado_at) : new Date();
      const expires = new Date(approvedAt.getTime() + CARD_DAYS * 86400000);
      const { data: card, error: cardErr } = await db.from("patient_cards").insert({
        clinic_id: clinicId, patient_id: patientId, card_number: num,
        issued_at: approvedAt.toISOString(), expires_at: expires.toISOString(), is_active: true,
        notes: "Carteirinha inicial de filiação (30 dias)",
      }).select("id").single();
      if (cardErr) throw cardErr;
      result.card_id = card.id;
      await logEvent(db, { clinic_id: clinicId, associado_id: associadoId, event: "card_issued", actor, details: { card_id: card.id, expires_at: expires.toISOString() } });
    }
  } catch (e) {
    errors.push(`Carteirinha: ${(e as Error).message}`);
  }

  // 2) Empresa: vínculo cadastrado + CNPJ exato (nunca por aproximação)
  let employer: any = null;
  const cnpj = digits(a.empresa_cnpj);
  if (a.employer_id) {
    const { data } = await db.from("employers").select("id, cnpj, name, clinic_id").eq("id", a.employer_id).maybeSingle();
    if (data && data.clinic_id === clinicId && (!cnpj || digits(data.cnpj) === cnpj)) employer = data;
  }
  if (!employer && cnpj.length === 14) {
    const { data } = await db.from("employers").select("id, cnpj, name, clinic_id").eq("clinic_id", clinicId);
    const matches = (data ?? []).filter((e: any) => digits(e.cnpj) === cnpj);
    if (matches.length === 1) employer = matches[0];
  }

  let documentId: string | null = null;
  if (!employer) {
    await logEvent(db, { clinic_id: clinicId, associado_id: associadoId, event: "employer_link_failed", actor, details: { employer_id: a.employer_id, empresa_cnpj: a.empresa_cnpj } });
    await db.from("affiliation_processing_jobs").update({
      status: "needs_employer", card_id: result.card_id ?? null,
      last_error: [...errors, "Empresa não identificada pelo vínculo/CNPJ. Corrija o cadastro e reprocesse."].join(" | "),
      updated_at: new Date().toISOString(),
    }).eq("associado_id", associadoId);
    return { ...result, status: "needs_employer", errors };
  }

  // 3) Ficha na Central da empresa (uma por filiação)
  documentId = await ensureCompanyDoc(db, a, employer, clinicId, associadoId, actor);

  await db.from("affiliation_processing_jobs").update({
    status: errors.length ? "error" : "done", card_id: result.card_id ?? null, document_id: documentId,
    last_error: errors.length ? errors.join(" | ") : null, updated_at: new Date().toISOString(),
  }).eq("associado_id", associadoId);
  return { ...result, document_id: documentId, status: errors.length ? "error" : "done", errors };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const db = adminClient();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "process") {
      const ctx = await getAuthContext(req);
      if (!ctx?.isStaff) return json({ success: false, error: "UNAUTHORIZED" }, 401);
      const { data: a } = await db.from("sindical_associados").select("sindicato_id").eq("id", body.associadoId).maybeSingle();
      const { data: ue } = a ? await db.from("union_entities").select("clinic_id").eq("id", a.sindicato_id).maybeSingle() : { data: null };
      if (!ue?.clinic_id || !(await canAccessClinic(db, ctx.userId, ctx.isSuperAdmin, ue.clinic_id))) return json({ success: false, error: "FORBIDDEN" }, 403);
      const r = await processApproval(db, String(body.associadoId), ctx.email ?? ctx.userId);
      return json({ success: true, ...r });
    }

    // Exporta a ficha assinada de UMA filiação aprovada para a empresa (sem carteirinha nem envio externo)
    if (action === "export_associado") {
      const ctx = await getAuthContext(req);
      if (!ctx?.isStaff) return json({ success: false, error: "UNAUTHORIZED" }, 401);
      const { data: a } = await db.from("sindical_associados").select("*").eq("id", body.associadoId).maybeSingle();
      if (!a || a.status !== "ativo") return json({ success: false, error: "NOT_APPROVED" });
      const { data: ue } = await db.from("union_entities").select("clinic_id").eq("id", a.sindicato_id).maybeSingle();
      const clinicId = ue?.clinic_id;
      if (!clinicId || !(await canAccessClinic(db, ctx.userId, ctx.isSuperAdmin, clinicId))) return json({ success: false, error: "FORBIDDEN" }, 403);
      if (!a.assinatura_digital_url) return json({ success: false, error: "NO_SIGNATURE" });
      const cnpj = digits(a.empresa_cnpj);
      let employer: any = null;
      if (a.employer_id) {
        const { data } = await db.from("employers").select("id, cnpj, name, clinic_id").eq("id", a.employer_id).maybeSingle();
        if (data && data.clinic_id === clinicId && (!cnpj || digits(data.cnpj) === cnpj)) employer = data;
      }
      if (!employer && cnpj.length === 14) {
        const { data } = await db.from("employers").select("id, cnpj, name, clinic_id").eq("clinic_id", clinicId);
        const m = (data ?? []).filter((e: any) => digits(e.cnpj) === cnpj);
        if (m.length === 1) employer = m[0];
      }
      if (!employer) return json({ success: false, error: "NO_EMPLOYER" });
      const { data: prev } = await db.from("affiliation_company_documents").select("id").eq("associado_id", a.id).eq("source", "auto").maybeSingle();
      const id = await ensureCompanyDoc(db, a, employer, clinicId, a.id, ctx.email ?? ctx.userId);
      return json({ success: true, document_id: id, already: !!prev, employer: employer.name });
    }

    // Exporta fichas assinadas de filiações já aprovadas para o cadastro da empresa (sem carteirinha nem envio externo)
    if (action === "export_employer") {
      const ctx = await getAuthContext(req);
      if (!ctx?.isStaff) return json({ success: false, error: "UNAUTHORIZED" }, 401);
      const { data: employer } = await db.from("employers").select("id, cnpj, name, clinic_id").eq("id", body.employer_id).maybeSingle();
      if (!employer || !(await canAccessClinic(db, ctx.userId, ctx.isSuperAdmin, employer.clinic_id))) return json({ success: false, error: "FORBIDDEN" }, 403);
      const { data: ues } = await db.from("union_entities").select("id").eq("clinic_id", employer.clinic_id);
      const ueIds = (ues ?? []).map((u: any) => u.id);
      if (!ueIds.length) return json({ success: true, exported: 0, already: 0 });
      const cnpj = digits(employer.cnpj);
      const { data: assoc } = await db.from("sindical_associados").select("*").in("sindicato_id", ueIds)
        .eq("status", "ativo").not("assinatura_digital_url", "is", null);
      const mine = (assoc ?? []).filter((a: any) => a.employer_id === employer.id || (cnpj.length === 14 && digits(a.empresa_cnpj) === cnpj));
      const { data: existing } = await db.from("affiliation_company_documents").select("associado_id")
        .in("associado_id", mine.length ? mine.map((a: any) => a.id) : ["00000000-0000-0000-0000-000000000000"]).eq("source", "auto");
      const have = new Set((existing ?? []).map((r: any) => r.associado_id));
      let exported = 0;
      for (const a of mine) {
        if (have.has(a.id)) continue;
        await ensureCompanyDoc(db, a, employer, employer.clinic_id, a.id, ctx.email ?? ctx.userId);
        exported++;
      }
      return json({ success: true, exported, already: have.size, found: mine.length });
    }

    // Ações de portal (empresa/contador)
    const portalType = String(body.portal_type || "");
    const portalId = String(body.portal_id || "");
    const allowed = await portalEmployerIds(db, portalType, portalId);
    if (!allowed.length) return json({ success: false, error: "FORBIDDEN" }, 403);

    if (action === "list") {
      const ids = body.employer_id ? allowed.filter((i) => i === body.employer_id) : allowed;
      if (!ids.length) return json({ success: true, documents: [] });
      const { data } = await db.from("affiliation_company_documents")
        .select("id, employer_id, employer_cnpj, worker_name, source, title, version, approved_at, made_available_at, opened_at, ack_status, ack_at, ack_by_name, classification_notice, employers(name)")
        .in("employer_id", ids).order("made_available_at", { ascending: false }).limit(500);
      return json({ success: true, documents: data ?? [] });
    }

    if (action === "open") {
      const { data: doc } = await db.from("affiliation_company_documents").select("*").eq("id", body.document_id).maybeSingle();
      if (!doc || !allowed.includes(doc.employer_id)) return json({ success: false, error: "FORBIDDEN" }, 403);
      if (!doc.opened_at) {
        await db.from("affiliation_company_documents").update({ opened_at: new Date().toISOString(), opened_by_portal: portalType, updated_at: new Date().toISOString() }).eq("id", doc.id);
      }
      await logEvent(db, { clinic_id: doc.clinic_id, document_id: doc.id, associado_id: doc.associado_id, employer_id: doc.employer_id, event: "opened", actor: `${portalType}:${portalId}` });
      let fileUrl: string | null = null;
      if (doc.file_path) {
        const { data: s } = await db.storage.from("affiliation-documents").createSignedUrl(doc.file_path, 3600);
        fileUrl = s?.signedUrl ?? null;
      }
      const { snapshot, ...rest } = doc;
      return json({ success: true, document: { ...rest, snapshot, file_url: fileUrl } });
    }

    if (action === "acknowledge") {
      const ids: string[] = Array.isArray(body.document_ids) ? body.document_ids : [];
      const name = String(body.name || "").trim();
      if (!ids.length || !name || body.declaration !== true) return json({ success: false, error: "Informe o nome e marque a declaração de ciência." }, 400);
      const { data: docs } = await db.from("affiliation_company_documents").select("*").in("id", ids);
      const done: string[] = [];
      const skipped: string[] = [];
      for (const d of docs ?? []) {
        if (!allowed.includes(d.employer_id) || !d.opened_at || d.ack_status === "confirmed") { skipped.push(d.id); continue; }
        const now = new Date().toISOString();
        await db.from("affiliation_company_documents").update({
          ack_status: "confirmed", ack_at: now, ack_by_name: name.slice(0, 120), ack_portal_type: portalType,
          ack_portal_id: portalId, ack_document_version: d.version, updated_at: now,
        }).eq("id", d.id).eq("ack_status", "pending");
        await logEvent(db, { clinic_id: d.clinic_id, document_id: d.id, associado_id: d.associado_id, employer_id: d.employer_id, event: "acknowledged", actor: `${portalType}:${portalId}`, details: { name, version: d.version } });
        done.push(d.id);
      }
      return json({ success: true, confirmed: done, skipped });
    }

    return json({ success: false, error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("[affiliation-documents]", e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});
