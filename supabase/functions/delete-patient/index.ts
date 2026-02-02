import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    // Client for user authentication
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the requesting user
    const { data: { user: requestingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !requestingUser) {
      console.error('[delete-patient] Auth error:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { patientId, clinicId } = await req.json();

    if (!patientId) {
      return new Response(
        JSON.stringify({ error: 'ID do paciente não informado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!clinicId) {
      return new Response(
        JSON.stringify({ error: 'ID da clínica não informado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has permission (is admin or super_admin of the clinic)
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

    const isAuthorized = superAdmin || userRole?.role === 'admin';

    if (!isAuthorized) {
      console.error('[delete-patient] User not authorized:', requestingUser.id);
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores podem excluir pacientes/associados.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get patient info for logging
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

    console.log(`[delete-patient] User ${requestingUser.email} deleting patient ${patient.name} (${patient.cpf || 'no-cpf'})`);

    // Delete related data in order (respecting foreign key constraints)
    const deleteRelatedData = async (table: string, column: string = 'patient_id') => {
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(column, patientId);
      
      if (error) {
        console.warn(`[delete-patient] Could not delete from ${table}: ${error.message}`);
      } else {
        console.log(`[delete-patient] Deleted ${table} records for patient ${patientId}`);
      }
    };

    // Delete anamnese data
    const { data: anamneseResponses } = await supabaseAdmin
      .from('anamnese_responses')
      .select('id')
      .eq('patient_id', patientId);

    if (anamneseResponses && anamneseResponses.length > 0) {
      const responseIds = anamneseResponses.map(r => r.id);
      await supabaseAdmin
        .from('anamnese_answers')
        .delete()
        .in('response_id', responseIds);
      console.log(`[delete-patient] Deleted anamnese_answers for responses`);
    }

    await deleteRelatedData('anamnese_responses');
    await deleteRelatedData('anamnesis');

    // Delete appointments
    await deleteRelatedData('appointments');

    // Delete patient cards and related notifications
    const { data: patientCards } = await supabaseAdmin
      .from('patient_cards')
      .select('id')
      .eq('patient_id', patientId);

    if (patientCards && patientCards.length > 0) {
      const cardIds = patientCards.map(c => c.id);
      await supabaseAdmin
        .from('card_expiry_notifications')
        .delete()
        .in('card_id', cardIds);
      console.log(`[delete-patient] Deleted card_expiry_notifications`);
    }

    await deleteRelatedData('patient_cards');

    // Delete patient attachments
    const { data: attachments } = await supabaseAdmin
      .from('patient_attachments')
      .select('id, file_path')
      .eq('patient_id', patientId);

    if (attachments && attachments.length > 0) {
      const attachmentIds = attachments.map(a => a.id);
      await supabaseAdmin
        .from('attachment_access_logs')
        .delete()
        .in('attachment_id', attachmentIds);

      // Delete files from storage
      const filePaths = attachments.map(a => a.file_path).filter(Boolean);
      if (filePaths.length > 0) {
        await supabaseAdmin.storage
          .from('patient-attachments')
          .remove(filePaths);
        console.log(`[delete-patient] Deleted ${filePaths.length} attachment files from storage`);
      }
    }

    await deleteRelatedData('patient_attachments');

    // Delete dependents
    await deleteRelatedData('patient_dependents');

    // Delete birthday message logs
    await deleteRelatedData('birthday_message_logs');

    // Delete union-related data
    await deleteRelatedData('union_contributions');
    await deleteRelatedData('union_filiacao_signatures');

    // Delete patient credentials
    await deleteRelatedData('patient_credentials');

    // Finally, delete the patient record
    const { error: deleteError } = await supabaseAdmin
      .from('patients')
      .delete()
      .eq('id', patientId)
      .eq('clinic_id', clinicId);

    if (deleteError) {
      console.error('[delete-patient] Delete error:', deleteError.message);

      let errorMsg = deleteError.message;
      if (
        errorMsg.includes('violates foreign key constraint') ||
        errorMsg.toLowerCase().includes('foreign key')
      ) {
        errorMsg = 'Não foi possível excluir porque ainda existem registros vinculados a este paciente/associado. Verifique os logs para mais detalhes.';
      }

      return new Response(
        JSON.stringify({ error: `Erro ao excluir: ${errorMsg}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the action
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
        deleted_by: requestingUser.email
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
