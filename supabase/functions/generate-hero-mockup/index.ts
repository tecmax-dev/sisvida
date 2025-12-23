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

    console.log('Starting hero mockup generation...');

    const prompt = `Create a professional SaaS dashboard mockup composition image for a Brazilian healthcare clinic management system called "Eclini".

COMPOSITION LAYOUT:
- Desktop dashboard screen in the background, slightly tilted/angled for depth
- Two modern smartphones (iPhone style) in the foreground, overlapping each other at angles
- The phones should be positioned in front-right, casting subtle shadows
- Clean white/light gray background with subtle gradient

DESKTOP DASHBOARD (main background element):
- Dark teal (#0F4C4C) or deep cyan sidebar on the left with white navigation icons
- Top header bar showing "Clínica Eclini" with user avatar and notification bell
- Main content area with white background containing:
  - Row of 4 colorful metric cards: "Clientes Atendidos" (teal), "A Pagar" (pink/coral), "A Receber" (cyan), "Receita Total" (yellow/amber)
  - Bar chart showing "Agendamentos x Faltas" with teal and coral colored bars
  - Circular donut chart showing "NPS" or satisfaction metrics
  - Table section with "Próximos Agendamentos" with colored status badges (confirmado=green, pendente=yellow, cancelado=red)

MOBILE PHONES (foreground elements):
- Two iPhones with thin bezels, modern design
- First phone (slightly larger, front): Shows appointment agenda with colorful appointment cards, patient names, times
- Second phone (behind, tilted): Shows charts/metrics view with graphs and numbers
- Both phones have the teal sidebar visible
- Phones casting realistic soft shadows

STYLE & COLORS:
- Primary color: Teal/Cyan (#20A39E)
- Secondary: White backgrounds, light gray accents
- Accent colors: Coral/Pink (#FF6B6B), Yellow (#FFD93D), Green (#6BCB77)
- Modern, clean, minimalist UI design
- High contrast, sharp edges
- Professional healthcare SaaS aesthetic
- Similar to enterprise software marketing images (like Salesforce, HubSpot mockups)

TECHNICAL:
- 16:9 aspect ratio, landscape orientation
- Ultra high resolution, crisp and sharp
- Photorealistic render quality
- The mockup should look like a premium marketing image for a SaaS product
- Subtle depth of field effect to emphasize the phones

The image should convey: modern technology, efficiency, Brazilian healthcare professional software, trust and reliability.`;

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

    const fileName = `hero-mockup-${Date.now()}.${imageFormat}`;
    
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

    console.log('Hero mockup uploaded successfully:', publicUrlData.publicUrl);

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
    console.error('Error generating hero mockup:', error);
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
