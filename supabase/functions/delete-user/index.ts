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
      console.error('[delete-user] Auth error:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if requesting user is super admin
    const { data: superAdmin } = await supabaseAdmin
      .from('super_admins')
      .select('id')
      .eq('user_id', requestingUser.id)
      .single();

    if (!superAdmin) {
      console.error('[delete-user] User is not super admin:', requestingUser.id);
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas super admins podem excluir usuários.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { targetUserId } = await req.json();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'ID do usuário não informado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent self-deletion
    if (targetUserId === requestingUser.id) {
      return new Response(
        JSON.stringify({ error: 'Você não pode excluir sua própria conta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if target is a super admin (prevent deleting other super admins)
    const { data: targetSuperAdmin } = await supabaseAdmin
      .from('super_admins')
      .select('id')
      .eq('user_id', targetUserId)
      .single();

    if (targetSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Não é permitido excluir outro Super Admin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get target user info for logging
    const { data: { user: targetUser }, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    
    if (targetUserError || !targetUser) {
      console.error('[delete-user] Target user not found:', targetUserError?.message);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get profile info for better logging
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('user_id', targetUserId)
      .single();

    const targetUserName = profile?.name || targetUser.email || 'Unknown';
    const targetUserEmail = targetUser.email || 'Unknown';

    console.log(`[delete-user] Super admin ${requestingUser.email} deleting user ${targetUserEmail} (${targetUserName})`);

    const safeNullOrDelete = async (table: string, column: string) => {
      // 1) Try NULLing the reference (keeps historical data)
      const { error: nullErr } = await supabaseAdmin
        .from(table)
        // deno-lint-ignore no-explicit-any
        .update({ [column]: null } as any)
        .eq(column, targetUserId);

      if (!nullErr) {
        console.log(`[delete-user] Cleared ${table}.${column} references for ${targetUserId}`);
        return;
      }

      console.warn(`[delete-user] Could not NULL ${table}.${column}: ${nullErr.message}. Trying DELETE...`);

      // 2) If NULL is not allowed, delete dependent rows
      const { error: delErr } = await supabaseAdmin.from(table).delete().eq(column, targetUserId);
      if (delErr) {
        console.error(`[delete-user] Could not DELETE ${table} rows for ${column}=${targetUserId}:`, delErr.message);
      } else {
        console.log(`[delete-user] Deleted ${table} rows for ${column}=${targetUserId}`);
      }
    };

    // Clean up related data before deleting user (avoid FK blocks)
    // Tables with FK -> auth.users
    await safeNullOrDelete('appointments', 'created_by');
    await safeNullOrDelete('addon_requests', 'requested_by');
    await safeNullOrDelete('clinic_addons', 'activated_by');
    await safeNullOrDelete('import_logs', 'created_by');
    await safeNullOrDelete('patient_cards', 'created_by');
    await safeNullOrDelete('smtp_settings', 'created_by');
    await safeNullOrDelete('upgrade_requests', 'requested_by');
    await safeNullOrDelete('upgrade_requests', 'processed_by');
    await safeNullOrDelete('webhooks', 'created_by');

    // Special: roles + profiles should be removed (not just nulled)
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', targetUserId);
    if (rolesError) {
      console.error('[delete-user] Error deleting user_roles:', rolesError.message);
    } else {
      console.log(`[delete-user] Deleted user_roles for ${targetUserId}`);
    }

    // Special: professional linkage (prefer unlink, fallback delete)
    await safeNullOrDelete('professionals', 'user_id');

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', targetUserId);
    if (profileError) {
      console.error('[delete-user] Error deleting profile:', profileError.message);
    } else {
      console.log(`[delete-user] Deleted profile for ${targetUserId}`);
    }

    // Delete the user using Admin API
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      console.error('[delete-user] Delete error:', deleteError.message);

      let errorMsg = deleteError.message;
      if (
        errorMsg.includes('violates foreign key constraint') ||
        errorMsg.toLowerCase().includes('foreign key') ||
        errorMsg.toLowerCase().includes('database error deleting user')
      ) {
        errorMsg = 'Não foi possível excluir porque ainda existem registros vinculados a este usuário no banco. Já tentei limpar vínculos comuns; verifique logs para qual tabela ainda está bloqueando.';
      }

      return new Response(
        JSON.stringify({ error: `Erro ao excluir usuário: ${errorMsg}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the action
    await supabaseAdmin.from('audit_logs').insert({
      user_id: requestingUser.id,
      action: 'delete_user',
      entity_type: 'user',
      entity_id: targetUserId,
      details: {
        deleted_user_email: targetUserEmail,
        deleted_user_name: targetUserName,
        deleted_by: requestingUser.email
      }
    });

    console.log(`[delete-user] Successfully deleted user ${targetUserEmail}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Usuário ${targetUserName} excluído com sucesso`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[delete-user] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
