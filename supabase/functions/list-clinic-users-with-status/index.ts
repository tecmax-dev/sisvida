import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { clinic_id } = await req.json();
    
    if (!clinic_id) {
      return new Response(
        JSON.stringify({ error: "clinic_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Get the requesting user
    const { data: { user: requestingUser }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is admin of the clinic
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("clinic_id", clinic_id)
      .single();

    if (roleError || !userRole || !['owner', 'admin'].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores podem listar usuários." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user roles for this clinic
    const { data: clinicRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, access_group_id, created_at")
      .eq("clinic_id", clinic_id);

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar usuários" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!clinicRoles || clinicRoles.length === 0) {
      return new Response(
        JSON.stringify({ users: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = clinicRoles.map(r => r.user_id);

    // Get auth users to check email confirmation status
    const { data: { users: authUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Failed to list auth users:", listError);
      return new Response(
        JSON.stringify({ error: "Erro ao listar usuários" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter to only users in this clinic
    const clinicAuthUsers = authUsers?.filter(u => userIds.includes(u.id)) || [];

    // Get profiles
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, name, phone, avatar_url")
      .in("user_id", userIds);

    // Get access groups
    const accessGroupIds = clinicRoles
      .map(r => r.access_group_id)
      .filter((id): id is string => !!id);

    let accessGroupsMap: Record<string, { name: string }> = {};
    
    if (accessGroupIds.length > 0) {
      const { data: accessGroupsData } = await supabaseAdmin
        .from("access_groups")
        .select("id, name")
        .in("id", accessGroupIds);

      accessGroupsMap = (accessGroupsData || []).reduce((acc, group) => {
        acc[group.id] = { name: group.name };
        return acc;
      }, {} as Record<string, { name: string }>);
    }

    // Combine all data
    const usersWithStatus = clinicRoles.map(role => {
      const authUser = clinicAuthUsers.find(u => u.id === role.user_id);
      const profile = profiles?.find(p => p.user_id === role.user_id);
      
      return {
        user_id: role.user_id,
        role: role.role,
        access_group_id: role.access_group_id,
        created_at: role.created_at,
        profile: profile || null,
        access_group: role.access_group_id ? accessGroupsMap[role.access_group_id] || null : null,
        email: authUser?.email || null,
        email_confirmed_at: authUser?.email_confirmed_at || null,
        last_sign_in_at: authUser?.last_sign_in_at || null,
      };
    });

    return new Response(
      JSON.stringify({ users: usersWithStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
