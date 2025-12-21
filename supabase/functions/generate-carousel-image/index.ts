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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration is missing');
    }

    console.log('Starting image generation with Lovable AI...');

    const prompt = `A modern MacBook Pro laptop computer on a clean minimal white desk, displaying a medical clinic scheduling interface on the screen.

The screen shows a professional healthcare scheduling dashboard with:
- Left sidebar in dark navy blue (#1E293B) with navigation menu items and icons
- Main content area with clean white/light gray background
- A calendar view visible in the background
- A scheduling form/modal in the center with a DROPDOWN MENU CLEARLY OPEN AND VISIBLE showing appointment types:
  • "Primeira Consulta" (First Visit) with a calendar icon
  • "Retorno" (Return) with a refresh icon  
  • "Exame" (Exam) with a clipboard icon
  • "Procedimento" (Procedure) with a medical cross icon
  • "Telemedicina" (Telemedicine) with a video camera icon

The dropdown should be the focal point of the image, clearly showing the 5 options with good contrast and readability.

Color scheme:
- Primary teal/turquoise accent color (#22B8A6) for buttons and highlights
- Clean white cards with subtle shadows
- Dark navy sidebar (#1E293B)
- Light gray background (#F8FAFC)

Style: Modern SaaS dashboard, clean minimalist UI, professional medical software aesthetic
The laptop should be shown at a 3/4 angle with the screen clearly visible
Ultra high resolution, photorealistic render, premium quality
16:9 aspect ratio image suitable for a hero banner`;

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
            content: prompt,
          },
        ],
        modalities: ['image', 'text'],
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
      console.error('No image data in response:', JSON.stringify(data));
      throw new Error('No image generated in response');
    }

    // Extract base64 data from data URL
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid image data format');
    }

    const imageType = base64Match[1];
    const base64Data = base64Match[2];
    
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('Image extracted, uploading to storage...');

    // Upload to Supabase Storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const fileName = `scheduling-mockup-${Date.now()}.${imageType}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('carousel-images')
      .upload(fileName, bytes, {
        contentType: `image/${imageType}`,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    console.log('Image uploaded successfully:', uploadData.path);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('carousel-images')
      .getPublicUrl(fileName);

    console.log('Public URL:', urlData.publicUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: urlData.publicUrl,
        fileName: fileName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating carousel image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
