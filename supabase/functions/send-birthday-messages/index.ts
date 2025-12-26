import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Logo padrão do sistema Eclini para cabeçalho de mensagens WhatsApp
const DEFAULT_SYSTEM_LOGO = 'https://eclini.lovable.app/birthday-header.webp';

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  is_connected: boolean;
}

interface ClinicWithBirthday {
  id: string;
  name: string;
  birthday_enabled: boolean;
  birthday_message: string;
  logo_url: string | null;
}

// Get Brazil time (UTC-3)
function getBrazilTime(): Date {
  const now = new Date();
  const brazilOffsetMinutes = -3 * 60;
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcTime + (brazilOffsetMinutes * 60000));
}

// Format birthday message with placeholders
function formatBirthdayMessage(template: string, patientName: string, clinicName: string): string {
  return template
    .replace(/{nome}/gi, patientName)
    .replace(/{clinica}/gi, clinicName)
    .replace(/{paciente}/gi, patientName);
}

async function sendWhatsAppWithImage(
  config: EvolutionConfig,
  phone: string,
  imageUrl: string,
  caption: string
): Promise<boolean> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`Sending birthday WhatsApp with image to ${formattedPhone}`);

    const response = await fetch(`${config.api_url}/message/sendMedia/${config.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.api_key,
      },
      body: JSON.stringify({
        number: formattedPhone,
        mediatype: 'image',
        media: imageUrl,
        caption: caption,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp API error:', errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending WhatsApp with image:', error);
    return false;
  }
}

async function sendWhatsAppText(
  config: EvolutionConfig,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`Sending birthday WhatsApp text to ${formattedPhone}`);

    const response = await fetch(`${config.api_url}/message/sendText/${config.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.api_key,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp API error:', errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending WhatsApp text:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = getBrazilTime();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const todayMonthDay = today.slice(5); // MM-DD
    const monthYear = today.slice(0, 7); // YYYY-MM

    console.log(`[Brazil time: ${now.toISOString()}] Checking birthdays for ${todayMonthDay}`);

    // Get clinics with birthday messages enabled
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, birthday_enabled, birthday_message, logo_url')
      .eq('birthday_enabled', true);

    if (clinicsError) {
      console.error('Error fetching clinics:', clinicsError);
      throw clinicsError;
    }

    console.log(`Found ${clinics?.length || 0} clinics with birthday messages enabled`);

    let sentCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const clinic of (clinics || []) as ClinicWithBirthday[]) {
      // Check message limit for this clinic
      const { data: usageData, error: usageError } = await supabase.rpc('get_clinic_message_usage', {
        _clinic_id: clinic.id,
        _month_year: monthYear
      });

      if (usageError) {
        console.error(`[Clinic ${clinic.name}] Error checking message usage:`, usageError);
        continue;
      }

      const usage = usageData && usageData.length > 0 ? usageData[0] : null;
      
      if (usage && usage.max_allowed > 0 && usage.remaining <= 0) {
        console.log(`[Clinic ${clinic.name}] Message limit reached, skipping birthday messages`);
        continue;
      }

      // Fetch clinic's Evolution API config
      const { data: evolutionConfig } = await supabase
        .from('evolution_configs')
        .select('api_url, api_key, instance_name, is_connected')
        .eq('clinic_id', clinic.id)
        .maybeSingle();

      if (!evolutionConfig || !evolutionConfig.is_connected) {
        console.log(`Clinic ${clinic.name} has no connected WhatsApp, skipping`);
        skippedCount++;
        continue;
      }

      // Fetch first active professional's avatar for the header image
      const { data: professional } = await supabase
        .from('professionals')
        .select('avatar_url')
        .eq('clinic_id', clinic.id)
        .eq('is_active', true)
        .not('avatar_url', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      // Use professional's avatar, clinic logo, or default system logo
      const headerImageUrl = professional?.avatar_url || clinic.logo_url || DEFAULT_SYSTEM_LOGO;

      console.log(`[Clinic ${clinic.name}] Header image: ${professional?.avatar_url ? 'professional avatar' : (clinic.logo_url ? 'clinic logo' : 'system default')}`);

      // Check if we already sent birthday messages today for this clinic
      const { data: existingSent } = await supabase
        .from('birthday_message_logs')
        .select('id')
        .eq('clinic_id', clinic.id)
        .gte('sent_at', today + 'T00:00:00')
        .lt('sent_at', today + 'T23:59:59')
        .limit(1);

      // Get patients with birthday today (matching month and day)
      const { data: patients, error: patientsError } = await supabase
        .from('patients')
        .select('id, name, phone, birth_date')
        .eq('clinic_id', clinic.id)
        .eq('send_notifications', true)
        .not('phone', 'is', null)
        .not('birth_date', 'is', null);

      if (patientsError) {
        console.error(`Error fetching patients for clinic ${clinic.id}:`, patientsError);
        continue;
      }

      // Filter patients by birthday (month-day match)
      const birthdayPatients = (patients || []).filter(patient => {
        if (!patient.birth_date) return false;
        const patientMonthDay = patient.birth_date.slice(5); // MM-DD
        return patientMonthDay === todayMonthDay;
      });

      console.log(`Found ${birthdayPatients.length} patients with birthday today for clinic ${clinic.name}`);

      // Check which patients already received message today
      const patientIds = birthdayPatients.map(p => p.id);
      const { data: alreadySent } = await supabase
        .from('birthday_message_logs')
        .select('patient_id')
        .eq('clinic_id', clinic.id)
        .in('patient_id', patientIds)
        .gte('sent_at', today + 'T00:00:00');

      const alreadySentIds = new Set((alreadySent || []).map(s => s.patient_id));

      let remainingMessages = usage ? usage.remaining : 999999;

      for (const patient of birthdayPatients) {
        // Skip if already sent today
        if (alreadySentIds.has(patient.id)) {
          console.log(`Already sent birthday message to ${patient.name} today`);
          continue;
        }

        // Check message limit
        if (usage && usage.max_allowed > 0 && remainingMessages <= 0) {
          console.log(`[Clinic ${clinic.name}] No more messages available`);
          break;
        }

        const message = formatBirthdayMessage(
          clinic.birthday_message || 'Feliz aniversário, {nome}! 🎂',
          patient.name,
          clinic.name
        );

        let success = false;

        // Sempre envia com imagem (headerImageUrl sempre terá um valor devido ao DEFAULT_SYSTEM_LOGO)
        success = await sendWhatsAppWithImage(
          evolutionConfig as EvolutionConfig,
          patient.phone,
          headerImageUrl,
          message
        );

        // Log the attempt
        const formattedPhone = patient.phone.replace(/\D/g, '');
        await supabase
          .from('birthday_message_logs')
          .insert({
            clinic_id: clinic.id,
            patient_id: patient.id,
            patient_name: patient.name,
            patient_phone: formattedPhone.startsWith('55') ? formattedPhone : '55' + formattedPhone,
            success: success,
            error_message: success ? null : 'Failed to send WhatsApp message'
          });

        if (success) {
          // Also log in message_logs for quota tracking
          await supabase
            .from('message_logs')
            .insert({
              clinic_id: clinic.id,
              message_type: 'birthday',
              phone: formattedPhone.startsWith('55') ? formattedPhone : '55' + formattedPhone,
              month_year: monthYear
            });

          remainingMessages--;
          sentCount++;
          console.log(`✓ Birthday message sent to ${patient.name}`);
        } else {
          errorCount++;
          console.error(`✗ Failed to send birthday message to ${patient.name}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const summary = {
      success: true,
      sent: sentCount,
      errors: errorCount,
      skipped: skippedCount,
      date: today,
      timestamp: now.toISOString()
    };

    console.log('Summary:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in send-birthday-messages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});