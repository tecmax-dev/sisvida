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
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for user creation
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create regular client to verify requesting user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    // Get requesting user
    const { data: { user: requestingUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { email, password, name, phone, role, clinicId, accessGroupId, professionalId } = body;

    // Validate required fields
    if (!email || !password || !name || !role || !clinicId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user has permission (owner or admin of the clinic)
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("clinic_id", clinicId)
      .single();

    if (roleError || !userRole || !["owner", "admin"].includes(userRole.role)) {
      // Also check for super admin
      const { data: superAdmin } = await supabaseAdmin
        .from("super_admins")
        .select("id")
        .eq("user_id", requestingUser.id)
        .single();

      if (!superAdmin) {
        return new Response(
          JSON.stringify({ error: "Permission denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create user using Admin API - this doesn't affect current session
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { name },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      
      if (createError.message.includes("already been registered") || 
          createError.message.includes("already registered")) {
        return new Response(
          JSON.stringify({ error: "Este email já está cadastrado no sistema" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = newUser.user.id;

    // Create user role for the clinic
    const { error: roleInsertError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        clinic_id: clinicId,
        role: role,
        access_group_id: accessGroupId || null,
        professional_id: professionalId || null,
      });

    if (roleInsertError) {
      console.error("Error creating user role:", roleInsertError);
      // Try to clean up the created user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Error creating user role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or update profile with name and phone
    // First try to get existing profile
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({
          name: name,
          phone: phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Error updating profile:", updateError);
      } else {
        console.log(`Profile updated for user ${userId} with name: ${name}`);
      }
    } else {
      // Insert new profile
      const { error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert({
          user_id: userId,
          name: name,
          phone: phone || null,
        });

      if (insertError) {
        console.error("Error inserting profile:", insertError);
        // Try to clean up the created user if profile creation fails
        console.error("Profile creation failed, but user was created. Manual intervention may be needed.");
      } else {
        console.log(`Profile created for user ${userId} with name: ${name}`);
      }
    }

    // Auto-create professional record when role is 'professional'
    if (role === "professional") {
      const { error: professionalError } = await supabaseAdmin
        .from("professionals")
        .insert({
          clinic_id: clinicId,
          user_id: userId,
          name: name,
          email: email,
          phone: phone || null,
          is_active: true,
        });

      if (professionalError) {
        console.error("Error creating professional record:", professionalError);
      }
    }

    console.log(`User ${email} created successfully for clinic ${clinicId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        message: "User created successfully" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
