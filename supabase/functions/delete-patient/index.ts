import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user: requestingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !requestingUser) {
      console.error('[delete-patient] Auth error:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { patientId, clinicId } = await req.json();

    if (!patientId || typeof patientId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'ID do paciente não informado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!clinicId || typeof clinicId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'ID da clínica não informado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(patientId) || !uuidRegex.test(clinicId)) {
      return new Response(
        JSON.stringify({ error: 'IDs inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check authorization: super_admin, admin, owner, or administrative
    const { data: superAdmin } = await supabaseAdmin
      .from('super_admins')
      .select('id')
      .eq('user_id', requestingUser.id)
      .single();

    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('clinic_id', clinicId)
      .single();

    const allowedRoles = ['admin', 'owner', 'administrative'];
    const isAuthorized = superAdmin || (userRole && allowedRoles.includes(userRole.role));

    if (!isAuthorized) {
      console.error('[delete-patient] User not authorized:', requestingUser.id, 'role:', userRole?.role);
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores podem excluir pacientes/associados.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get patient info
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select('id, name, cpf, phone, email, clinic_id')
      .eq('id', patientId)
      .eq('clinic_id', clinicId)
      .single();

    if (patientError || !patient) {
      console.error('[delete-patient] Patient not found:', patientError?.message);
      return new Response(
        JSON.stringify({ error: 'Paciente/Associado não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[delete-patient] User ${requestingUser.email} (${userRole?.role || 'super_admin'}) deleting patient ${patient.name} (${patient.cpf || 'no-cpf'})`);

    // Helper to delete related data with error handling
    const deleteRelated = async (table: string, column: string = 'patient_id') => {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(column, patientId);
      if (error) {
        console.warn(`[delete-patient] Could not delete from ${table}: ${error.message}`);
      }
    };

    // --- Delete anamnese chain ---
    const { data: anamneseResponses } = await supabaseAdmin
      .from('anamnese_responses')
      .select('id')
      .eq('patient_id', patientId);

    if (anamneseResponses && anamneseResponses.length > 0) {
      const responseIds = anamneseResponses.map(r => r.id);
      // batch in groups of 500
      for (let i = 0; i < responseIds.length; i += 500) {
        await supabaseAdmin.from('anamnese_answers').delete().in('response_id', responseIds.slice(i, i + 500));
      }
    }
    await deleteRelated('anamnese_responses');
    await deleteRelated('anamnesis');

    // --- Delete cards chain ---
    const { data: patientCards } = await supabaseAdmin
      .from('patient_cards')
      .select('id')
      .eq('patient_id', patientId);

    if (patientCards && patientCards.length > 0) {
      const cardIds = patientCards.map(c => c.id);
      for (let i = 0; i < cardIds.length; i += 500) {
        await supabaseAdmin.from('card_expiry_notifications').delete().in('card_id', cardIds.slice(i, i + 500));
      }
    }
    await deleteRelated('patient_cards');

    // --- Delete attachments chain (with storage cleanup) ---
    const { data: attachments } = await supabaseAdmin
      .from('patient_attachments')
      .select('id, file_path')
      .eq('patient_id', patientId);

    if (attachments && attachments.length > 0) {
      const attachmentIds = attachments.map(a => a.id);
      for (let i = 0; i < attachmentIds.length; i += 500) {
        await supabaseAdmin.from('attachment_access_logs').delete().in('attachment_id', attachmentIds.slice(i, i + 500));
      }
      const filePaths = attachments.map(a => a.file_path).filter(Boolean);
      if (filePaths.length > 0) {
        for (let i = 0; i < filePaths.length; i += 100) {
          await supabaseAdmin.storage.from('patient-attachments').remove(filePaths.slice(i, i + 100));
        }
        console.log(`[delete-patient] Deleted ${filePaths.length} attachment files from storage`);
      }
    }
    await deleteRelated('patient_attachments');

    // --- Delete dependent approvals and dependents ---
    await deleteRelated('pending_dependent_approvals');
    await deleteRelated('patient_dependents');

    // --- Delete all other related tables (no FK constraints, safe to delete) ---
    const relatedTables = [
      'appointments',
      'birthday_message_logs',
      'exam_results',
      'financial_transactions',
      'first_access_tokens',
      'marketing_consents',
      'medical_documents',
      'medical_records',
      'nps_surveys',
      'odontogram_records',
      'ouvidoria_messages',
      'patient_first_access_tokens',
      'patient_folders',
      'patient_notifications',
      'patient_packages',
      'patient_password_resets',
      'patient_payslip_history',
      'patient_credentials',
      'payment_plans',
      'payslip_requests',
      'pre_attendance',
      'prescriptions',
      'push_notification_tokens',
      'queue_calls',
      'quotes',
      'scheduled_automations',
      'segment_patients',
      'signature_request_tokens',
      'tiss_guides',
      'union_authorizations',
      'union_contributions',
      'union_filiacao_signatures',
      'union_member_audit_logs',
      'waiting_list',
      'whatsapp_ai_conversations',
      'whatsapp_booking_sessions',
      'whatsapp_contacts',
    ];

    // Process in parallel batches of 5 for speed
    for (let i = 0; i < relatedTables.length; i += 5) {
      const batch = relatedTables.slice(i, i + 5);
      await Promise.all(batch.map(table => deleteRelated(table)));
    }

    // --- Finally delete the patient ---
    const { error: deleteError } = await supabaseAdmin
      .from('patients')
      .delete()
      .eq('id', patientId)
      .eq('clinic_id', clinicId);

    if (deleteError) {
      console.error('[delete-patient] Delete error:', deleteError.message);
      let errorMsg = deleteError.message;
      if (errorMsg.includes('foreign key') || errorMsg.includes('violates')) {
        errorMsg = 'Não foi possível excluir porque ainda existem registros vinculados. Verifique os logs.';
      }
      return new Response(
        JSON.stringify({ error: `Erro ao excluir: ${errorMsg}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: requestingUser.id,
      action: 'delete_patient',
      entity_type: 'patient',
      entity_id: patientId,
      details: {
        deleted_patient_name: patient.name,
        deleted_patient_cpf: patient.cpf,
        deleted_patient_phone: patient.phone,
        deleted_patient_email: patient.email,
        clinic_id: clinicId,
        deleted_by: requestingUser.email,
        user_role: userRole?.role || 'super_admin'
      }
    });

    console.log(`[delete-patient] Successfully deleted patient ${patient.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Paciente/Associado ${patient.name} excluído com sucesso`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[delete-patient] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
