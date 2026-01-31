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

interface OneSignalResponse {
  id?: string;
  recipients?: number;
  errors?: {
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
): Promise<{ success: boolean; recipients?: number; invalidPlayerIds?: string[]; error?: string }> {
  if (playerIds.length === 0) {
    return { success: false, error: 'No player IDs provided' };
  }

  const payload: Record<string, unknown> = {
    app_id: appId,
    include_player_ids: playerIds,
    headings: { en: title },
    contents: { en: body },
    data: data || {},
  };

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

    const responseData: OneSignalResponse = await response.json();
    
    if (!response.ok) {
      console.error('OneSignal API error:', response.status, JSON.stringify(responseData));
      return { 
        success: false, 
        error: `HTTP ${response.status}` 
      };
    }

    console.log('OneSignal: Notification sent successfully', responseData);
    
    // Handle invalid player IDs
    const invalidPlayerIds = responseData.errors?.invalid_player_ids || [];
    
    return { 
      success: true, 
      recipients: responseData.recipients || playerIds.length - invalidPlayerIds.length,
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
    const appId = Deno.env.get('ONESIGNAL_APP_ID');
    const restApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');

    if (!appId || !restApiKey) {
      console.error('OneSignal credentials not configured');
      return new Response(
        JSON.stringify({
          error: 'OneSignal not configured',
          message: 'Please configure ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY in your project secrets.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('OneSignal: App ID configured:', appId.substring(0, 8) + '...');

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

    // Always save notifications for specific patients, even if no tokens
    if (target_type === 'specific' && target_patient_ids && target_patient_ids.length > 0) {
      const notificationsToInsert = target_patient_ids.map((pid) => ({
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
        console.error('Error saving patient notifications (no tokens):', notifError);
      } else {
        console.log(`Saved ${notificationsToInsert.length} notifications to patient_notifications table`);
      }
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
          message: 'No active tokens found, but notifications saved for in-app display',
          total_sent: 0,
          total_success: 0,
          total_failed: 0,
          notifications_saved: target_type === 'specific' ? target_patient_ids?.length || 0 : 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Separate tokens by type
    const oneSignalTokens: string[] = [];
    const legacyTokens: string[] = [];

    for (const tokenData of tokensData) {
      const deviceInfo = tokenData.device_info as Record<string, unknown> | null;
      const isOneSignal = deviceInfo?.type === 'onesignal-web';
      const isPusherBeams = deviceInfo?.type === 'pusher-beams-web';
      
      if (isOneSignal || tokenData.platform === 'web') {
        // OneSignal web tokens
        oneSignalTokens.push(tokenData.token);
      } else if (isPusherBeams) {
        // Skip Pusher Beams tokens - they won't work with OneSignal
        console.log('Skipping Pusher Beams token');
        legacyTokens.push(tokenData.token);
      } else {
        // Native tokens (Android/iOS) - these are FCM tokens
        legacyTokens.push(tokenData.token);
      }
    }

    console.log(`Found ${oneSignalTokens.length} OneSignal tokens, ${legacyTokens.length} legacy/other tokens`);

    let totalSuccess = 0;
    let totalFailed = 0;
    const invalidPlayerIds: string[] = [];

    // Send via OneSignal
    if (oneSignalTokens.length > 0) {
      const result = await sendOneSignalNotification(
        oneSignalTokens,
        title,
        body,
        appId,
        restApiKey,
        data,
        url
      );

      if (result.success) {
        totalSuccess += result.recipients || 0;
        
        // Deactivate invalid player IDs
        if (result.invalidPlayerIds && result.invalidPlayerIds.length > 0) {
          console.log('OneSignal: Deactivating invalid player IDs:', result.invalidPlayerIds.length);
          invalidPlayerIds.push(...result.invalidPlayerIds);
          totalFailed += result.invalidPlayerIds.length;
          
          await supabase
            .from('push_notification_tokens')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .in('token', result.invalidPlayerIds);
        }
      } else {
        totalFailed += oneSignalTokens.length;
        console.error('OneSignal: Failed to send:', result.error);
      }
    }

    // Note: Legacy tokens are skipped
    if (legacyTokens.length > 0) {
      console.log(`Skipping ${legacyTokens.length} legacy/other tokens`);
    }

    // Save notifications to patient_notifications table for in-app display
    const patientIds = new Set<string>();
    for (const tokenData of tokensData) {
      if (tokenData.patient_id) {
        patientIds.add(tokenData.patient_id);
      }
    }

    if (patientIds.size > 0 && target_type !== 'specific') {
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
        legacy_tokens: legacyTokens.length,
        invalid_player_ids: invalidPlayerIds.length,
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
