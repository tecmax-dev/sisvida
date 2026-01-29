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
  url?: string;
}

interface OneSignalNotificationResponse {
  id: string;
  recipients?: number;
  // OneSignal may return either an array of error strings or an object with details (e.g. invalid_player_ids)
  errors?:
    | string[]
    | {
        invalid_player_ids?: string[];
      };
}

// Send notification using OneSignal REST API
async function sendOneSignalNotification(
  playerIds: string[],
  title: string,
  body: string,
  appId: string,
  restApiKey: string,
  data?: Record<string, string>,
  url?: string
): Promise<{ success: boolean; recipients?: number; error?: string; invalidPlayerIds?: string[] }> {
  if (playerIds.length === 0) {
    return { success: false, error: 'No player IDs provided' };
  }

  const payload: Record<string, unknown> = {
    app_id: appId,
    include_subscription_ids: playerIds,
    headings: { en: title, pt: title },
    contents: { en: body, pt: body },
    data: data || {},
  };

  // Add URL if provided
  if (url) {
    payload.url = url;
  }

  try {
    console.log('OneSignal: Sending notification to', playerIds.length, 'devices');
    
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${restApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

     const responseData: OneSignalNotificationResponse = await response.json();
    
    if (!response.ok) {
      console.error('OneSignal API error:', response.status, JSON.stringify(responseData));
      return { 
        success: false, 
         error: Array.isArray(responseData.errors)
           ? responseData.errors.join(', ')
           : (responseData.errors as any)?.invalid_player_ids?.join(', ') || `HTTP ${response.status}` 
      };
    }

     const invalidPlayerIds =
       !Array.isArray(responseData.errors) && responseData.errors?.invalid_player_ids
         ? responseData.errors.invalid_player_ids
         : [];

    console.log('OneSignal: Notification sent successfully', responseData);
    return { 
      success: true, 
       recipients: responseData.recipients || playerIds.length,
       invalidPlayerIds,
    };
  } catch (error) {
    console.error('OneSignal: Request error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
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

    // Get OneSignal credentials
    const oneSignalAppId = Deno.env.get('ONESIGNAL_APP_ID');
    const oneSignalRestApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');

    if (!oneSignalAppId || !oneSignalRestApiKey) {
      console.error('OneSignal credentials not configured');
      return new Response(
        JSON.stringify({
          error: 'OneSignal not configured',
          message: 'Please configure ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY in your project secrets.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('OneSignal: App ID configured:', oneSignalAppId.substring(0, 8) + '...');

    const payload: PushNotificationRequest = await req.json();
    console.log('Push notification request:', JSON.stringify(payload));

    const { clinic_id, title, body, data, target_type, target_patient_ids, url } = payload;

    if (!clinic_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: clinic_id, title, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query for tokens - only get OneSignal web tokens
    let tokensQuery = supabase
      .from('push_notification_tokens')
      .select('token, patient_id, platform, device_info')
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

    // Separate tokens by type
    const oneSignalTokens: string[] = [];
    const legacyFcmTokens: string[] = [];

    for (const tokenData of tokensData) {
      const deviceInfo = tokenData.device_info as Record<string, unknown> | null;
      const isOneSignal = deviceInfo?.type === 'onesignal-web';
      
      if (isOneSignal) {
        oneSignalTokens.push(tokenData.token);
      } else if (tokenData.platform === 'web') {
        // Skip legacy FCM web tokens - they won't work with OneSignal
        console.log('Skipping legacy FCM web token');
      } else {
        // Native tokens (Android/iOS) - these are FCM tokens
        legacyFcmTokens.push(tokenData.token);
      }
    }

    console.log(`Found ${oneSignalTokens.length} OneSignal tokens, ${legacyFcmTokens.length} legacy FCM tokens`);

    let totalSuccess = 0;
    let totalFailed = 0;

    // Send to OneSignal tokens (batch send)
    if (oneSignalTokens.length > 0) {
      const result = await sendOneSignalNotification(
        oneSignalTokens,
        title,
        body,
        oneSignalAppId,
        oneSignalRestApiKey,
        data,
        url
      );

      if (result.success) {
        totalSuccess += result.recipients || oneSignalTokens.length;
        console.log(`OneSignal: Successfully sent to ${result.recipients} devices`);

        // Deactivate invalid OneSignal IDs so we stop sending to stale devices
        if (result.invalidPlayerIds && result.invalidPlayerIds.length > 0) {
          console.log('OneSignal: Deactivating invalid player IDs:', result.invalidPlayerIds.length);
          const { error: deactivateError } = await supabase
            .from('push_notification_tokens')
            .update({
              is_active: false,
              updated_at: new Date().toISOString(),
            })
            .eq('clinic_id', clinic_id)
            .eq('platform', 'web')
            .in('token', result.invalidPlayerIds);

          if (deactivateError) {
            console.error('Error deactivating invalid player IDs:', deactivateError);
          } else {
            // Count invalid IDs as failed attempts (best-effort metric)
            totalFailed += result.invalidPlayerIds.length;
          }
        }
      } else {
        totalFailed += oneSignalTokens.length;
        console.error(`OneSignal: Failed to send:`, result.error);
      }
    }

    // Note: Legacy FCM tokens are skipped as we've migrated to OneSignal
    // If native app support is needed in future, implement FCM v1 API here
    if (legacyFcmTokens.length > 0) {
      console.log(`Skipping ${legacyFcmTokens.length} legacy FCM tokens - migration to OneSignal required`);
      totalFailed += legacyFcmTokens.length;
    }

    // Save notifications to patient_notifications table for in-app display
    const patientIds = new Set<string>();
    for (const tokenData of tokensData) {
      if (tokenData.patient_id) {
        patientIds.add(tokenData.patient_id);
      }
    }

    if (patientIds.size > 0) {
      const notificationsToInsert = Array.from(patientIds).map((pid) => ({
        clinic_id,
        patient_id: pid,
        title,
        body,
        type: 'push',
        data: data || {},
        is_read: false,
      }));

      const { error: notifError } = await supabase
        .from('patient_notifications')
        .insert(notificationsToInsert);

      if (notifError) {
        console.error('Error saving patient notifications:', notifError);
      } else {
        console.log(`Saved ${notificationsToInsert.length} notifications to patient_notifications table`);
      }
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
        total_sent: tokensData.length,
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
        total_sent: tokensData.length,
        total_success: totalSuccess,
        total_failed: totalFailed,
        onesignal_tokens: oneSignalTokens.length,
        legacy_fcm_tokens: legacyFcmTokens.length,
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
