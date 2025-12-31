import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clinic_id, patient_id, image_base64 } = await req.json();

    if (!clinic_id || !patient_id || !image_base64) {
      return new Response(
        JSON.stringify({ error: 'clinic_id, patient_id and image_base64 are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode base64 image
    const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Generate file path
    const fileName = `${Date.now()}.jpg`;
    const filePath = `${clinic_id}/${patient_id}/${fileName}`;

    console.log(`[upload-test-payslip] Uploading to: ${filePath}`);

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('contra-cheques')
      .upload(filePath, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('[upload-test-payslip] Upload error:', uploadError);
      throw uploadError;
    }

    console.log(`[upload-test-payslip] Upload successful: ${filePath}`);

    // Update payslip request if exists
    const { data: updateData, error: updateError } = await supabase
      .from('payslip_requests')
      .update({ 
        attachment_path: filePath,
        status: 'received',
        received_at: new Date().toISOString()
      })
      .eq('clinic_id', clinic_id)
      .eq('patient_id', patient_id)
      .eq('status', 'received')
      .is('attachment_path', null)
      .or(`attachment_path.ilike.%teste%`)
      .select()
      .single();

    if (updateError && updateError.code !== 'PGRST116') {
      console.log('[upload-test-payslip] Update warning:', updateError.message);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        path: filePath,
        updated: updateData ? true : false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[upload-test-payslip] Error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
