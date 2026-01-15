import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationRequest {
  clinic_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  target_type: 'all' | 'specific' | 'segment';
  target_patient_ids?: string[];
}

interface FCMResponse {
  success: number;
  failure: number;
  results?: Array<{ error?: string; message_id?: string }>;
}

async function sendFCMNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<FCMResponse> {
  const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
  
  if (!fcmServerKey) {
    console.error('FCM_SERVER_KEY not configured');
    throw new Error('FCM_SERVER_KEY not configured. Please add the Firebase Cloud Messaging Server Key.');
  }

  console.log(`Sending FCM notification to ${tokens.length} tokens`);
  
  // Use the legacy FCM API for simplicity with server keys
  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `key=${fcmServerKey}`,
    },
    body: JSON.stringify({
      registration_ids: tokens,
      notification: {
        title,
        body,
        sound: 'default',
        badge: 1,
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      priority: 'high',
      content_available: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('FCM API error:', response.status, errorText);
    throw new Error(`FCM API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('FCM response:', JSON.stringify(result));
  
  return result as FCMResponse;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if FCM_SERVER_KEY is configured
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
    if (!fcmServerKey) {
      console.error('FCM_SERVER_KEY not configured');
      return new Response(
        JSON.stringify({ 
          error: 'FCM_SERVER_KEY not configured',
          message: 'Please configure the Firebase Cloud Messaging Server Key in your project secrets.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: PushNotificationRequest = await req.json();
    console.log('Push notification request:', JSON.stringify(payload));

    const { clinic_id, title, body, data, target_type, target_patient_ids } = payload;

    if (!clinic_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: clinic_id, title, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query for tokens
    let tokensQuery = supabase
      .from('push_notification_tokens')
      .select('token, patient_id, platform')
      .eq('clinic_id', clinic_id)
      .eq('is_active', true);

    // Filter by specific patients if needed
    if (target_type === 'specific' && target_patient_ids && target_patient_ids.length > 0) {
      tokensQuery = tokensQuery.in('patient_id', target_patient_ids);
    }

    const { data: tokensData, error: tokensError } = await tokensQuery;

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch device tokens', details: tokensError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokensData || tokensData.length === 0) {
      console.log('No active tokens found for clinic:', clinic_id);
      
      // Still record in history
      await supabase
        .from('push_notification_history')
        .insert({
          clinic_id,
          title,
          body,
          data,
          target_type,
          target_patient_ids: target_type === 'specific' ? target_patient_ids : null,
          total_sent: 0,
          total_success: 0,
          total_failed: 0,
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active tokens found',
          total_sent: 0,
          total_success: 0,
          total_failed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokens = tokensData.map(t => t.token);
    const uniquePatientIds = [...new Set(tokensData.map(t => t.patient_id))];
    
    console.log(`Found ${tokens.length} tokens for ${uniquePatientIds.length} patients`);

    // Send notifications in batches of 500 (FCM limit)
    const batchSize = 500;
    let totalSuccess = 0;
    let totalFailed = 0;
    const invalidTokens: string[] = [];

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      
      try {
        const result = await sendFCMNotification(batch, title, body, data);
        totalSuccess += result.success || 0;
        totalFailed += result.failure || 0;
        
        // Track invalid tokens for cleanup
        if (result.results) {
          result.results.forEach((r, idx) => {
            if (r.error) {
              console.log(`Token ${i + idx} failed:`, r.error);
              // Mark tokens with permanent errors for deactivation
              if (r.error === 'NotRegistered' || r.error === 'InvalidRegistration') {
                invalidTokens.push(batch[idx]);
              }
            }
          });
        }
      } catch (batchError) {
        console.error(`Batch ${i / batchSize + 1} failed:`, batchError);
        totalFailed += batch.length;
      }
    }

    // Deactivate invalid tokens
    if (invalidTokens.length > 0) {
      console.log(`Deactivating ${invalidTokens.length} invalid tokens`);
      await supabase
        .from('push_notification_tokens')
        .update({ is_active: false })
        .in('token', invalidTokens);
    }

    // Record in history
    const { error: historyError } = await supabase
      .from('push_notification_history')
      .insert({
        clinic_id,
        title,
        body,
        data,
        target_type,
        target_patient_ids: target_type === 'specific' ? target_patient_ids : null,
        total_sent: tokens.length,
        total_success: totalSuccess,
        total_failed: totalFailed,
      });

    if (historyError) {
      console.error('Error saving notification history:', historyError);
    }

    console.log(`Push notification completed: ${totalSuccess} success, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total_sent: tokens.length,
        total_success: totalSuccess,
        total_failed: totalFailed,
        invalid_tokens_removed: invalidTokens.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
