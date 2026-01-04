import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, clinicId, dryRun = true } = await req.json();

    console.log(`[migrate-cpf-to-members] Action: ${action}, Clinic: ${clinicId}, DryRun: ${dryRun}`);

    if (action === 'analyze') {
      // Analisar quantas empresas com CPF existem
      const { data: employers, error } = await supabase
        .from('employers')
        .select(`
          id, 
          name, 
          cnpj, 
          email, 
          phone, 
          address, 
          city, 
          state, 
          cep,
          neighborhood,
          notes,
          is_active,
          category_id,
          clinic_id
        `)
        .eq(clinicId ? 'clinic_id' : 'id', clinicId || supabase.auth.getUser());

      if (error) throw error;

      // Filtrar apenas os que têm CPF (11 dígitos)
      const cpfEmployers = employers?.filter(e => {
        const cleanCnpj = e.cnpj?.replace(/\D/g, '') || '';
        return cleanCnpj.length === 11;
      }) || [];

      // Contar contribuições para cada um
      const results = await Promise.all(cpfEmployers.map(async (emp) => {
        const { count } = await supabase
          .from('employer_contributions')
          .select('*', { count: 'exact', head: true })
          .eq('employer_id', emp.id);

        return {
          ...emp,
          contribution_count: count || 0
        };
      }));

      return new Response(
        JSON.stringify({
          success: true,
          total_cpf_employers: results.length,
          total_contributions: results.reduce((sum, e) => sum + e.contribution_count, 0),
          employers: results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'migrate') {
      if (!clinicId) {
        return new Response(
          JSON.stringify({ success: false, error: 'clinicId é obrigatório para migração' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar empresas com CPF
      const { data: employers, error: empError } = await supabase
        .from('employers')
        .select('*')
        .eq('clinic_id', clinicId);

      if (empError) throw empError;

      const cpfEmployers = employers?.filter(e => {
        const cleanCnpj = e.cnpj?.replace(/\D/g, '') || '';
        return cleanCnpj.length === 11;
      }) || [];

      const migrationResults = {
        members_created: 0,
        contributions_migrated: 0,
        employers_deactivated: 0,
        errors: [] as string[]
      };

      for (const emp of cpfEmployers) {
        try {
          console.log(`[migrate] Processando: ${emp.name} (${emp.cnpj})`);

          // Verificar se já existe um sócio com este CPF
          const { data: existingMember } = await supabase
            .from('members')
            .select('id')
            .eq('clinic_id', clinicId)
            .eq('cpf', emp.cnpj)
            .single();

          let memberId: string;

          if (existingMember) {
            console.log(`[migrate] Sócio já existe: ${existingMember.id}`);
            memberId = existingMember.id;
          } else if (!dryRun) {
            // Criar novo sócio
            const { data: newMember, error: memberError } = await supabase
              .from('members')
              .insert({
                clinic_id: clinicId,
                cpf: emp.cnpj,
                name: emp.name,
                email: emp.email,
                phone: emp.phone,
                address: emp.address,
                city: emp.city,
                state: emp.state,
                cep: emp.cep,
                neighborhood: emp.neighborhood,
                notes: emp.notes,
                is_active: emp.is_active
              })
              .select()
              .single();

            if (memberError) throw memberError;
            memberId = newMember.id;
            migrationResults.members_created++;
            console.log(`[migrate] Sócio criado: ${memberId}`);
          } else {
            // Dry run - apenas simular
            memberId = 'dry-run-id';
            migrationResults.members_created++;
          }

          // Buscar contribuições desta empresa
          const { data: contributions, error: contribError } = await supabase
            .from('employer_contributions')
            .select('*')
            .eq('employer_id', emp.id);

          if (contribError) throw contribError;

          if (contributions && contributions.length > 0) {
            for (const contrib of contributions) {
              if (!dryRun) {
                // Criar contribuição para o sócio
                const { error: newContribError } = await supabase
                  .from('member_contributions')
                  .insert({
                    clinic_id: clinicId,
                    member_id: memberId,
                    contribution_type_id: contrib.contribution_type_id,
                    competence_month: contrib.competence_month,
                    competence_year: contrib.competence_year,
                    due_date: contrib.due_date,
                    value: contrib.value,
                    status: contrib.status,
                    paid_at: contrib.paid_at,
                    paid_value: contrib.paid_value,
                    payment_method: contrib.payment_method,
                    notes: contrib.notes ? `(Migrado de empresa) ${contrib.notes}` : '(Migrado de empresa)',
                    lytex_invoice_id: contrib.lytex_invoice_id,
                    lytex_invoice_url: contrib.lytex_invoice_url,
                    lytex_pix_code: contrib.lytex_pix_code,
                    lytex_pix_qrcode: contrib.lytex_pix_qrcode,
                    lytex_boleto_barcode: contrib.lytex_boleto_barcode,
                    lytex_boleto_digitable_line: contrib.lytex_boleto_digitable_line,
                    portal_reissue_count: contrib.portal_reissue_count || 0
                  });

                if (newContribError) {
                  console.error(`[migrate] Erro ao migrar contribuição:`, newContribError);
                  migrationResults.errors.push(`Contribuição ${contrib.id}: ${newContribError.message}`);
                  continue;
                }

                // Marcar contribuição antiga como cancelada
                await supabase
                  .from('employer_contributions')
                  .update({ 
                    status: 'cancelled', 
                    notes: `${contrib.notes || ''} [MIGRADO PARA SÓCIO ${memberId}]`.trim()
                  })
                  .eq('id', contrib.id);
              }

              migrationResults.contributions_migrated++;
            }
          }

          // Desativar a empresa antiga
          if (!dryRun) {
            await supabase
              .from('employers')
              .update({ 
                is_active: false, 
                notes: `${emp.notes || ''} [MIGRADO PARA SÓCIO - ${new Date().toISOString()}]`.trim()
              })
              .eq('id', emp.id);
          }
          migrationResults.employers_deactivated++;

        } catch (err: any) {
          console.error(`[migrate] Erro ao processar ${emp.name}:`, err);
          migrationResults.errors.push(`${emp.name}: ${err.message}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          dry_run: dryRun,
          ...migrationResults
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação inválida. Use: analyze ou migrate' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[migrate-cpf-to-members] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
