import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    // ===== FETCH: Buscar filiação pendente por ID + CPF =====
    if (action === "fetch") {
      const { filiacao_id, cpf } = body;

      if (!filiacao_id || !cpf) {
        return jsonResponse({ error: "ID e CPF são obrigatórios." }, 400);
      }

      const cleanCpf = String(cpf).replace(/\D/g, "");
      if (cleanCpf.length !== 11) {
        return jsonResponse({ error: "CPF inválido." }, 400);
      }

      const { data: filiacao, error } = await supabase
        .from("sindical_associados")
        .select(
          "id, sindicato_id, nome, cpf, rg, data_nascimento, sexo, estado_civil, nome_pai, nome_mae, cep, logradouro, numero, complemento, bairro, cidade, uf, email, telefone, cargo, data_admissao, employer_id, empresa_cnpj, empresa_razao_social, empresa_nome_fantasia, empresa_endereco, empresa_matricula, forma_pagamento, documento_foto_url, documento_rg_url, documento_rg_verso_url, assinatura_digital_url, aceite_lgpd, status, created_at"
        )
        .eq("id", filiacao_id)
        .eq("cpf", cleanCpf)
        .eq("status", "pendente")
        .maybeSingle();

      if (error) {
        console.error("Fetch error:", error);
        return jsonResponse({ error: "Erro ao buscar filiação." }, 500);
      }

      if (!filiacao) {
        return jsonResponse(
          { error: "Filiação não encontrada. Verifique o ID e CPF, ou a solicitação já pode ter sido processada." },
          404
        );
      }

      // Also fetch dependents
      const { data: dependents } = await supabase
        .from("sindical_associado_dependentes")
        .select("id, nome, grau_parentesco, data_nascimento, cpf")
        .eq("associado_id", filiacao_id);

      return jsonResponse({ filiacao, dependents: dependents || [] });
    }

    // ===== UPDATE: Atualizar filiação pendente =====
    if (action === "update") {
      const { filiacao_id, cpf, data: updateData } = body;

      if (!filiacao_id || !cpf || !updateData) {
        return jsonResponse({ error: "ID, CPF e dados são obrigatórios." }, 400);
      }

      const cleanCpf = String(cpf).replace(/\D/g, "");
      if (cleanCpf.length !== 11) {
        return jsonResponse({ error: "CPF inválido." }, 400);
      }

      // Verify the record exists and is still pending
      const { data: existing, error: checkError } = await supabase
        .from("sindical_associados")
        .select("id, status")
        .eq("id", filiacao_id)
        .eq("cpf", cleanCpf)
        .eq("status", "pendente")
        .maybeSingle();

      if (checkError || !existing) {
        return jsonResponse(
          { error: "Filiação não encontrada ou já processada." },
          404
        );
      }

      // Whitelist of allowed fields for public update
      const allowedFields: Record<string, boolean> = {
        nome: true,
        rg: true,
        data_nascimento: true,
        sexo: true,
        estado_civil: true,
        nome_pai: true,
        nome_mae: true,
        cep: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        uf: true,
        email: true,
        telefone: true,
        cargo: true,
        data_admissao: true,
        employer_id: true,
        empresa_cnpj: true,
        empresa_razao_social: true,
        empresa_nome_fantasia: true,
        empresa_endereco: true,
        empresa_matricula: true,
        forma_pagamento: true,
        documento_foto_url: true,
        documento_rg_url: true,
        documento_rg_verso_url: true,
        assinatura_digital_url: true,
      };

      // Filter to only allowed fields
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields[key]) {
          // Sanitize string values
          if (typeof value === "string") {
            sanitized[key] = value.trim().slice(0, 1000);
          } else {
            sanitized[key] = value;
          }
        }
      }

      if (Object.keys(sanitized).length === 0) {
        return jsonResponse({ error: "Nenhum campo válido para atualizar." }, 400);
      }

      sanitized.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("sindical_associados")
        .update(sanitized)
        .eq("id", filiacao_id)
        .eq("cpf", cleanCpf)
        .eq("status", "pendente");

      if (updateError) {
        console.error("Update error:", updateError);
        return jsonResponse({ error: "Erro ao atualizar filiação." }, 500);
      }

      // Update dependents if provided
      if (body.dependents && Array.isArray(body.dependents)) {
        // Remove old dependents
        await supabase
          .from("sindical_associado_dependentes")
          .delete()
          .eq("associado_id", filiacao_id);

        // Insert new dependents
        if (body.dependents.length > 0) {
          const depsInsert = body.dependents
            .slice(0, 10) // max 10 dependents
            .map((dep: any) => ({
              associado_id: filiacao_id,
              nome: String(dep.nome || "").trim().slice(0, 255),
              grau_parentesco: String(dep.grau_parentesco || "").trim().slice(0, 100),
              data_nascimento: dep.data_nascimento || null,
              cpf: dep.cpf ? String(dep.cpf).replace(/\D/g, "").slice(0, 11) : null,
            }));

          await supabase
            .from("sindical_associado_dependentes")
            .insert(depsInsert);
        }
      }

      return jsonResponse({ success: true, message: "Filiação atualizada com sucesso." });
    }

    return jsonResponse({ error: "Ação inválida." }, 400);
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse({ error: "Erro interno do servidor." }, 500);
  }
});
