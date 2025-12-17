import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
      console.error('Evolution API credentials not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution API not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    console.log(`Looking for appointments on ${tomorrowDate}`);

    // Get clinics with reminders enabled
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, reminder_enabled, reminder_hours')
      .eq('reminder_enabled', true);

    if (clinicsError) {
      console.error('Error fetching clinics:', clinicsError);
      throw clinicsError;
    }

    console.log(`Found ${clinics?.length || 0} clinics with reminders enabled`);

    let sentCount = 0;
    let errorCount = 0;

    for (const clinic of clinics || []) {
      // Get appointments for tomorrow that haven't been reminded yet
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          start_time,
          reminder_sent,
          patient:patients (
            name,
            phone
          ),
          professional:professionals (
            name
          )
        `)
        .eq('clinic_id', clinic.id)
        .eq('appointment_date', tomorrowDate)
        .in('status', ['scheduled', 'confirmed'])
        .eq('reminder_sent', false);

      if (appointmentsError) {
        console.error(`Error fetching appointments for clinic ${clinic.id}:`, appointmentsError);
        continue;
      }

      console.log(`Found ${appointments?.length || 0} appointments for clinic ${clinic.name}`);

      for (const appointment of appointments || []) {
        const patient = appointment.patient as any;
        const professional = appointment.professional as any;

        if (!patient?.phone) {
          console.log(`No phone for appointment ${appointment.id}`);
          continue;
        }

        // Format phone number
        let formattedPhone = patient.phone.replace(/\D/g, '');
        if (!formattedPhone.startsWith('55')) {
          formattedPhone = '55' + formattedPhone;
        }

        // Format time
        const time = appointment.start_time.substring(0, 5);

        // Create message
        const message = `Olá ${patient.name}! 👋\n\nLembramos que você tem consulta agendada para *amanhã* às *${time}* com ${professional?.name || 'nosso profissional'}.\n\nClínica: ${clinic.name}\n\nPor favor, confirme sua presença respondendo esta mensagem.\n\nCaso precise reagendar, entre em contato conosco.`;

        try {
          const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              number: formattedPhone,
              text: message,
            }),
          });

          if (response.ok) {
            // Mark as sent
            await supabase
              .from('appointments')
              .update({ reminder_sent: true })
              .eq('id', appointment.id);
            
            sentCount++;
            console.log(`Reminder sent to ${patient.name} (${formattedPhone})`);
          } else {
            const errorResult = await response.json();
            console.error(`Failed to send reminder to ${patient.name}:`, errorResult);
            errorCount++;
          }
        } catch (error) {
          console.error(`Error sending reminder to ${patient.name}:`, error);
          errorCount++;
        }
      }
    }

    console.log(`Reminders sent: ${sentCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        errors: errorCount,
        date: tomorrowDate 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in send-appointment-reminders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
