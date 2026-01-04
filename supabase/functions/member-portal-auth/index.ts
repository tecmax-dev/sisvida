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

    const { action, clinicSlug, cpf, accessCode, memberId } = await req.json();

    console.log(`[member-portal-auth] Action: ${action}, Clinic: ${clinicSlug}, CPF: ${cpf?.substring(0, 6)}...`);

    if (action === 'request_code') {
      // Buscar clínica pelo slug
      const { data: clinic, error: clinicError } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('slug', clinicSlug)
        .single();

      if (clinicError || !clinic) {
        console.error('[member-portal-auth] Clinic not found:', clinicError);
        return new Response(
          JSON.stringify({ success: false, error: 'Clínica não encontrada' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // Normalizar CPF
      const normalizedCpf = cpf.replace(/\D/g, '');

      // Buscar sócio pelo CPF
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('id, name, email, phone')
        .eq('clinic_id', clinic.id)
        .eq('is_active', true)
        .ilike('cpf', `%${normalizedCpf}%`)
        .single();

      if (memberError || !member) {
        console.error('[member-portal-auth] Member not found:', memberError);
        return new Response(
          JSON.stringify({ success: false, error: 'CPF não encontrado ou sócio inativo' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // Gerar código de acesso
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let newAccessCode = '';
      for (let i = 0; i < 6; i++) {
        newAccessCode += chars[Math.floor(Math.random() * chars.length)];
      }

      // Atualizar sócio com código de acesso (expira em 30 minutos)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      
      const { error: updateError } = await supabase
        .from('members')
        .update({
          access_code: newAccessCode,
          access_code_expires_at: expiresAt
        })
        .eq('id', member.id);

      if (updateError) {
        console.error('[member-portal-auth] Error updating access code:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao gerar código de acesso' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Enviar código via WhatsApp se tiver telefone
      if (member.phone) {
        try {
          const { data: evolutionConfig } = await supabase
            .from('evolution_configs')
            .select('*')
            .eq('clinic_id', clinic.id)
            .eq('is_connected', true)
            .single();

          if (evolutionConfig) {
            const formattedPhone = member.phone.replace(/\D/g, '');
            const message = `🔐 *Portal do Sócio*\n\nSeu código de acesso é: *${newAccessCode}*\n\n⏰ Este código expira em 30 minutos.\n\n_${clinic.name}_`;

            await fetch(`${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_name}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionConfig.api_key
              },
              body: JSON.stringify({
                number: `55${formattedPhone}`,
                text: message
              })
            });
            
            console.log(`[member-portal-auth] Access code sent via WhatsApp to ${formattedPhone.substring(0, 4)}...`);
          }
        } catch (whatsappError) {
          console.error('[member-portal-auth] WhatsApp error:', whatsappError);
          // Continua mesmo se WhatsApp falhar
        }
      }

      // Log da ação
      await supabase.from('member_portal_logs').insert({
        member_id: member.id,
        action: 'request_code',
        details: { member_name: member.name },
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
        user_agent: req.headers.get('user-agent')
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Código enviado com sucesso',
          memberName: member.name.split(' ')[0],
          hasWhatsApp: !!member.phone,
          // Em dev, retornar o código para facilitar testes
          ...(Deno.env.get('ENVIRONMENT') === 'development' ? { code: newAccessCode } : {})
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'validate_code') {
      // Buscar clínica pelo slug
      const { data: clinic, error: clinicError } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('slug', clinicSlug)
        .single();

      if (clinicError || !clinic) {
        return new Response(
          JSON.stringify({ success: false, error: 'Clínica não encontrada' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      const normalizedCpf = cpf.replace(/\D/g, '');

      // Buscar e validar sócio
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('clinic_id', clinic.id)
        .eq('is_active', true)
        .ilike('cpf', `%${normalizedCpf}%`)
        .eq('access_code', accessCode.toUpperCase())
        .single();

      if (memberError || !member) {
        console.error('[member-portal-auth] Invalid code:', memberError);
        
        // Log failed attempt
        await supabase.from('member_portal_logs').insert({
          action: 'invalid_code',
          details: { cpf: normalizedCpf.substring(0, 6), code: accessCode },
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
          user_agent: req.headers.get('user-agent')
        });

        return new Response(
          JSON.stringify({ success: false, error: 'Código inválido ou expirado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      // Verificar expiração
      if (member.access_code_expires_at && new Date(member.access_code_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: 'Código expirado. Solicite um novo.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      // Atualizar último acesso e limpar código
      await supabase
        .from('members')
        .update({
          portal_last_access_at: new Date().toISOString(),
          access_code: null,
          access_code_expires_at: null
        })
        .eq('id', member.id);

      // Log successful login
      await supabase.from('member_portal_logs').insert({
        member_id: member.id,
        action: 'login',
        details: { member_name: member.name },
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
        user_agent: req.headers.get('user-agent')
      });

      return new Response(
        JSON.stringify({
          success: true,
          member: {
            id: member.id,
            name: member.name,
            cpf: member.cpf,
            email: member.email,
            phone: member.phone
          },
          clinic: {
            id: clinic.id,
            name: clinic.name
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_contributions') {
      // Buscar contribuições do sócio
      const { data: contributions, error: contribError } = await supabase
        .from('member_contributions')
        .select(`
          *,
          contribution_type:contribution_types(id, name)
        `)
        .eq('member_id', memberId)
        .neq('status', 'cancelled')
        .order('due_date', { ascending: false });

      if (contribError) {
        console.error('[member-portal-auth] Error fetching contributions:', contribError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao buscar contribuições' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, contributions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação inválida' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('[member-portal-auth] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
