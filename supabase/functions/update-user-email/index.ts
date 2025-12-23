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
        JSON.stringify({ error: "Acesso negado. Apenas Super Admins podem editar emails." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Super admin verified:", requestingUser.id);

    // Parse request body
    const { targetUserId, newEmail } = await req.json();

    if (!targetUserId || !newEmail) {
      return new Response(
        JSON.stringify({ error: "targetUserId e newEmail são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return new Response(
        JSON.stringify({ error: "Formato de email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Updating email for user:", targetUserId, "to:", newEmail);

    // Get current user info before update for audit log
    const { data: { user: targetUser }, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    
    if (targetUserError || !targetUser) {
      console.error("Target user not found:", targetUserError);
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const oldEmail = targetUser.email;

    // Check if new email is already in use
    const { data: { users: existingUsers } } = await supabaseAdmin.auth.admin.listUsers();
    const emailInUse = existingUsers?.some(u => u.email?.toLowerCase() === newEmail.toLowerCase() && u.id !== targetUserId);
    
    if (emailInUse) {
      return new Response(
        JSON.stringify({ error: "Este email já está em uso por outro usuário" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the user's email using Admin API
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { 
        email: newEmail,
        email_confirm: true // Automatically confirm the new email
      }
    );

    if (updateError) {
      console.error("Failed to update email:", updateError);
      return new Response(
        JSON.stringify({ error: `Erro ao atualizar email: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email updated successfully for user:", targetUserId);

    // Log the action in audit_logs
    await supabaseAdmin.from("audit_logs").insert({
      user_id: requestingUser.id,
      action: "update_user_email",
      entity_type: "user",
      entity_id: targetUserId,
      details: {
        old_email: oldEmail,
        new_email: newEmail,
        updated_by: requestingUser.email
      }
    });

    console.log("Audit log created for email update");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email atualizado com sucesso",
        user: {
          id: updatedUser.user.id,
          email: updatedUser.user.email
        }
      }),
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
