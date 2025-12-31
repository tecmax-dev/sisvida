import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TwilioRequest {
  clinicId: string;
  action: 'sendMessage' | 'sendInteractive' | 'testConnection';
  phone?: string;
  message?: string;
  buttons?: Array<{ id: string; title: string }>;
  imageUrl?: string;
}

interface TwilioConfig {
  account_sid: string;
  auth_token: string;
  phone_number: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { clinicId, action, phone, message, buttons, imageUrl }: TwilioRequest = await req.json();

    if (!clinicId || !action) {
      return new Response(
        JSON.stringify({ success: false, error: 'clinicId and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify clinic access
    const { data: hasAccess } = await supabase.rpc('has_clinic_access', {
      _user_id: user.id,
      _clinic_id: clinicId
    });

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Twilio config
    const { data: twilioConfig, error: configError } = await supabase
      .from('twilio_configs')
      .select('account_sid, auth_token, phone_number')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (configError || !twilioConfig) {
      return new Response(
        JSON.stringify({ success: false, error: 'Twilio not configured for this clinic' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { account_sid, auth_token, phone_number } = twilioConfig as TwilioConfig;
    const twilioAuth = btoa(`${account_sid}:${auth_token}`);

    switch (action) {
      case 'testConnection': {
        // Test connection by fetching account info
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${account_sid}.json`,
          {
            headers: {
              'Authorization': `Basic ${twilioAuth}`,
            },
          }
        );

        if (response.ok) {
          const accountData = await response.json();
          console.log(`[Twilio] Connection test successful for account: ${accountData.friendly_name}`);
          return new Response(
            JSON.stringify({ success: true, account: accountData.friendly_name }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const errorData = await response.json();
          console.error('[Twilio] Connection test failed:', errorData);
          return new Response(
            JSON.stringify({ success: false, error: errorData.message || 'Connection failed' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'sendMessage': {
        if (!phone || !message) {
          return new Response(
            JSON.stringify({ success: false, error: 'phone and message are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Format phone number
        let formattedPhone = phone.replace(/\D/g, '');
        if (!formattedPhone.startsWith('55')) {
          formattedPhone = '55' + formattedPhone;
        }
        const toNumber = `whatsapp:+${formattedPhone}`;

        const params = new URLSearchParams();
        params.append('To', toNumber);
        params.append('From', phone_number);
        params.append('Body', message);

        if (imageUrl) {
          params.append('MediaUrl', imageUrl);
        }

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${twilioAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        );

        const result = await response.json();

        if (response.ok) {
          console.log(`[Twilio] Message sent successfully: ${result.sid}`);
          
          // Log message
          const monthYear = new Date().toISOString().slice(0, 7);
          await supabase.from('message_logs').insert({
            clinic_id: clinicId,
            message_type: 'custom',
            phone: formattedPhone,
            month_year: monthYear,
          });

          return new Response(
            JSON.stringify({ success: true, data: result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.error('[Twilio] Send message failed:', result);
          return new Response(
            JSON.stringify({ success: false, error: result.message || 'Failed to send message' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      case 'sendInteractive': {
        if (!phone || !message || !buttons) {
          return new Response(
            JSON.stringify({ success: false, error: 'phone, message, and buttons are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Format phone number
        let formattedPhone = phone.replace(/\D/g, '');
        if (!formattedPhone.startsWith('55')) {
          formattedPhone = '55' + formattedPhone;
        }
        const toNumber = `whatsapp:+${formattedPhone}`;

        // Twilio Content API for interactive buttons
        // Note: This requires pre-approved templates in production
        const contentBody = {
          To: toNumber,
          From: phone_number,
          ContentSid: '', // Would need a pre-registered template SID
          ContentVariables: JSON.stringify({
            1: message,
          }),
        };

        // For now, fallback to regular message with button text
        const buttonText = buttons.map((b, i) => `${i + 1}️⃣ ${b.title}`).join('\n');
        const fullMessage = `${message}\n\n${buttonText}`;

        const params = new URLSearchParams();
        params.append('To', toNumber);
        params.append('From', phone_number);
        params.append('Body', fullMessage);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${twilioAuth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          }
        );

        const result = await response.json();

        if (response.ok) {
          console.log(`[Twilio] Interactive message sent: ${result.sid}`);
          
          // Log message
          const monthYear = new Date().toISOString().slice(0, 7);
          await supabase.from('message_logs').insert({
            clinic_id: clinicId,
            message_type: 'custom',
            phone: formattedPhone,
            month_year: monthYear,
          });

          return new Response(
            JSON.stringify({ success: true, data: result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.error('[Twilio] Send interactive failed:', result);
          return new Response(
            JSON.stringify({ success: false, error: result.message || 'Failed to send' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('[Twilio API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
