import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create regular client to verify user
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
      console.error("Failed to get requesting user:", userError);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Requesting user:", requestingUser.id);

    // Verify super admin status
    const { data: superAdminData, error: superAdminError } = await supabaseAdmin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", requestingUser.id)
      .single();

    if (superAdminError || !superAdminData) {
      console.error("User is not a super admin:", requestingUser.id);
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas Super Admins podem listar emails de usuários." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Super admin verified, listing users...");

    // Get all users from auth.users using Admin API
    const { data: { users: authUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error("Failed to list users:", listError);
      return new Response(
        JSON.stringify({ error: "Erro ao listar usuários" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("*");

    if (profilesError) {
      console.error("Failed to get profiles:", profilesError);
      return new Response(
        JSON.stringify({ error: "Erro ao obter perfis" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get super admins
    const { data: superAdmins } = await supabaseAdmin
      .from("super_admins")
      .select("user_id");

    const superAdminIds = new Set(superAdmins?.map(sa => sa.user_id) || []);

    // Get user roles with clinic info
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, clinic_id, role");

    // Get all clinics
    const { data: clinics } = await supabaseAdmin
      .from("clinics")
      .select("id, name, slug");

    const clinicsMap = new Map(clinics?.map(c => [c.id, c]) || []);

    // Build user-clinic relationships
    const userClinicsMap: Record<string, Array<{ clinic_id: string; clinic_name: string; clinic_slug: string; role: string }>> = {};
    userRoles?.forEach(role => {
      if (!userClinicsMap[role.user_id]) {
        userClinicsMap[role.user_id] = [];
      }
      const clinic = clinicsMap.get(role.clinic_id);
      if (clinic) {
        userClinicsMap[role.user_id].push({
          clinic_id: role.clinic_id,
          clinic_name: clinic.name,
          clinic_slug: clinic.slug,
          role: role.role
        });
      }
    });

    // Count clinics per user
    const clinicsPerUser: Record<string, number> = {};
    userRoles?.forEach(role => {
      clinicsPerUser[role.user_id] = (clinicsPerUser[role.user_id] || 0) + 1;
    });

    // Combine data
    const usersWithEmails = authUsers?.map(authUser => {
      const profile = profiles?.find(p => p.user_id === authUser.id);
      
      return {
        id: profile?.id || authUser.id,
        user_id: authUser.id,
        email: authUser.email,
        name: profile?.name || authUser.email?.split("@")[0] || "Sem nome",
        phone: profile?.phone || null,
        created_at: profile?.created_at || authUser.created_at,
        isSuperAdmin: superAdminIds.has(authUser.id),
        clinicsCount: clinicsPerUser[authUser.id] || 0,
        clinics: userClinicsMap[authUser.id] || [],
        email_confirmed_at: authUser.email_confirmed_at,
        last_sign_in_at: authUser.last_sign_in_at
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Build clinics list with users
    const clinicsList = clinics?.map(clinic => ({
      id: clinic.id,
      name: clinic.name,
      slug: clinic.slug,
      usersCount: userRoles?.filter(r => r.clinic_id === clinic.id).length || 0
    })).sort((a, b) => a.name.localeCompare(b.name)) || [];

    console.log(`Returning ${usersWithEmails?.length || 0} users, ${clinicsList.length} clinics`);

    return new Response(
      JSON.stringify({ users: usersWithEmails, clinics: clinicsList }),
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
