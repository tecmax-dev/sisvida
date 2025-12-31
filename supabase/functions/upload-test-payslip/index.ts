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

    const { clinic_id, patient_id, image_url, image_base64 } = await req.json();

    if (!clinic_id || !patient_id) {
      return new Response(
        JSON.stringify({ error: 'clinic_id and patient_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let imageBuffer: Uint8Array;
    let contentType = 'image/png';
    
    // Option 1: Download from URL
    if (image_url) {
      console.log(`[upload-test-payslip] Fetching image from URL: ${image_url}`);
      const response = await fetch(image_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = new Uint8Array(arrayBuffer);
      contentType = response.headers.get('content-type') || 'image/png';
      console.log(`[upload-test-payslip] Downloaded ${imageBuffer.length} bytes`);
    } 
    // Option 2: Base64 encoded
    else if (image_base64) {
      const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      contentType = 'image/jpeg';
    } 
    else {
      return new Response(
        JSON.stringify({ error: 'Either image_url or image_base64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate file path
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const fileName = `${Date.now()}.${ext}`;
    const filePath = `${clinic_id}/${patient_id}/${fileName}`;

    console.log(`[upload-test-payslip] Uploading to: ${filePath} (${imageBuffer.length} bytes)`);

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('contra-cheques')
      .upload(filePath, imageBuffer, {
        contentType,
        upsert: true
      });

    if (uploadError) {
      console.error('[upload-test-payslip] Upload error:', uploadError);
      throw uploadError;
    }

    console.log(`[upload-test-payslip] Upload successful: ${filePath}`);

    // Update payslip request
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
      .select()
      .single();

    if (updateError && updateError.code !== 'PGRST116') {
      console.log('[upload-test-payslip] Update warning:', updateError.message);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        path: filePath,
        size: imageBuffer.length,
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