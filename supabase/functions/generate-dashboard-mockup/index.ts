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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting dashboard mockup generation...');

    const prompt = `Create a professional, high-quality UI screenshot of a medical clinic management dashboard software interface. The design must be:

LAYOUT:
- Clean WHITE sidebar on the left side (about 20% width) with teal/cyan (#20A39E) colored icons
- Menu items in Portuguese: "Visão Geral", "Agenda" (highlighted/active), "Pacientes", "Profissionais", "Prontuário", "Financeiro"
- The "Agenda" menu item should have a light teal background indicating it's selected
- Main content area (80% width) showing an appointment calendar/schedule view

MAIN CONTENT - AGENDA VIEW:
- Header showing "Agenda" title with current date
- A bright orange/coral button labeled "Novo Agendamento" in top right
- Calendar view or list of appointments showing:
  - Patient cards with names like "Maria Silva", "João Santos", "Ana Costa"
  - Appointment times (09:00, 10:30, 14:00, etc.)
  - Status badges: "Confirmado" (green), "Pendente" (yellow), "Agendado" (blue)
  - Professional name for each appointment

STYLE:
- Modern, clean, minimalist healthcare software aesthetic
- Light gray background (#F8FAFC or #FAFBFC)
- White cards with very subtle shadows
- Rounded corners on cards and buttons
- Professional Brazilian clinic management software look
- Crisp, high-resolution UI design
- NO device frames, NO mockup elements - just the pure interface
- 16:9 aspect ratio, landscape orientation

The overall feel should be modern, trustworthy, and professional - like a real SaaS product for healthcare clinics.`;

    console.log('Calling Lovable AI Gateway for image generation...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('AI response received');

    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData) {
      console.error('No image in response:', JSON.stringify(data));
      throw new Error('No image generated in response');
    }

    // Extract base64 data
    const base64Match = imageData.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid image data format');
    }

    const imageFormat = base64Match[1];
    const base64Data = base64Match[2];
    
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const fileName = `dashboard-mockup-${Date.now()}.${imageFormat}`;
    
    console.log(`Uploading image to storage: ${fileName}`);

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('carousel-images')
      .upload(fileName, bytes, {
        contentType: `image/${imageFormat}`,
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('carousel-images')
      .getPublicUrl(fileName);

    console.log('Image uploaded successfully:', publicUrlData.publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: publicUrlData.publicUrl,
        fileName 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error generating dashboard mockup:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
