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

interface PusherBeamsResponse {
  publishId?: string;
  error?: string;
  description?: string;
}

// Send notification using Pusher Beams REST API
async function sendPusherBeamsNotification(
  deviceIds: string[],
  title: string,
  body: string,
  instanceId: string,
  secretKey: string,
  data?: Record<string, string>,
  url?: string
): Promise<{ success: boolean; recipients?: number; error?: string }> {
  if (deviceIds.length === 0) {
    return { success: false, error: 'No device IDs provided' };
  }

  // Pusher Beams uses "interests" for targeting groups, or "users" for authenticated users
  // For device-specific targeting, we need to use the publish to users API
  // But since we're storing device IDs, we'll use interests approach
  
  const webPayload: Record<string, unknown> = {
    notification: {
      title,
      body,
      deep_link: url || undefined,
    },
    data: data || {},
  };

  try {
    console.log('Pusher Beams: Sending notification to', deviceIds.length, 'devices');
    
    // Pusher Beams API for publishing to specific device IDs
    // We'll publish to all devices in the clinic interest
    const response = await fetch(
      `https://${instanceId}.pushnotifications.pusher.com/publish_api/v1/instances/${instanceId}/publishes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interests: deviceIds, // Using device IDs as interests
          web: webPayload,
        }),
      }
    );

    const responseData: PusherBeamsResponse = await response.json();
    
    if (!response.ok) {
      console.error('Pusher Beams API error:', response.status, JSON.stringify(responseData));
      return { 
        success: false, 
        error: responseData.description || responseData.error || `HTTP ${response.status}` 
      };
    }

    console.log('Pusher Beams: Notification sent successfully', responseData);
    return { 
      success: true, 
      recipients: deviceIds.length,
    };
  } catch (error) {
    console.error('Pusher Beams: Request error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Send to interests (for group targeting)
async function sendToInterests(
  interests: string[],
  title: string,
  body: string,
  instanceId: string,
  secretKey: string,
  data?: Record<string, string>,
  url?: string
): Promise<{ success: boolean; error?: string }> {
  const webPayload: Record<string, unknown> = {
    notification: {
      title,
      body,
      deep_link: url || undefined,
    },
    data: data || {},
  };

  try {
    console.log('Pusher Beams: Sending notification to interests:', interests);
    
    const response = await fetch(
      `https://${instanceId}.pushnotifications.pusher.com/publish_api/v1/instances/${instanceId}/publishes/interests`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interests,
          web: webPayload,
        }),
      }
    );

    const responseData: PusherBeamsResponse = await response.json();
    
    if (!response.ok) {
      console.error('Pusher Beams API error:', response.status, JSON.stringify(responseData));
      return { 
        success: false, 
        error: responseData.description || responseData.error || `HTTP ${response.status}` 
      };
    }

    console.log('Pusher Beams: Notification sent to interests successfully', responseData);
    return { success: true };
  } catch (error) {
    console.error('Pusher Beams: Request error:', error);
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

    // Get Pusher Beams credentials
    const instanceId = Deno.env.get('PUSHER_BEAMS_INSTANCE_ID');
    const secretKey = Deno.env.get('PUSHER_BEAMS_SECRET_KEY');

    if (!instanceId || !secretKey) {
      console.error('Pusher Beams credentials not configured');
      return new Response(
        JSON.stringify({
          error: 'Pusher Beams not configured',
          message: 'Please configure PUSHER_BEAMS_INSTANCE_ID and PUSHER_BEAMS_SECRET_KEY in your project secrets.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Pusher Beams: Instance ID configured:', instanceId.substring(0, 8) + '...');

    const payload: PushNotificationRequest = await req.json();
    console.log('Push notification request:', JSON.stringify(payload));

    const { clinic_id, title, body, data, target_type, target_patient_ids, url } = payload;

    if (!clinic_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: clinic_id, title, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query for tokens - only get Pusher Beams web tokens
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
    const pusherBeamsTokens: string[] = [];
    const legacyTokens: string[] = [];

    for (const tokenData of tokensData) {
      const deviceInfo = tokenData.device_info as Record<string, unknown> | null;
      const isPusherBeams = deviceInfo?.type === 'pusher-beams-web';
      const isOneSignal = deviceInfo?.type === 'onesignal-web';
      
      if (isPusherBeams) {
        pusherBeamsTokens.push(tokenData.token);
      } else if (isOneSignal || tokenData.platform === 'web') {
        // Skip legacy OneSignal/FCM web tokens - they won't work with Pusher Beams
        console.log('Skipping legacy web token (OneSignal/FCM)');
        legacyTokens.push(tokenData.token);
      } else {
        // Native tokens (Android/iOS) - these are FCM tokens
        legacyTokens.push(tokenData.token);
      }
    }

    console.log(`Found ${pusherBeamsTokens.length} Pusher Beams tokens, ${legacyTokens.length} legacy tokens`);

    let totalSuccess = 0;
    let totalFailed = 0;

    // Send to Pusher Beams using interests
    if (target_type === 'all') {
      // Send to clinic interest
      const result = await sendToInterests(
        [`clinic-${clinic_id}`],
        title,
        body,
        instanceId,
        secretKey,
        data,
        url
      );

      if (result.success) {
        totalSuccess = pusherBeamsTokens.length;
        console.log(`Pusher Beams: Successfully sent to clinic interest`);
      } else {
        totalFailed = pusherBeamsTokens.length;
        console.error(`Pusher Beams: Failed to send:`, result.error);
      }
    } else if (target_type === 'specific' && target_patient_ids && target_patient_ids.length > 0) {
      // Send to specific patient interests
      const patientInterests = target_patient_ids.map(pid => `patient-${pid}`);
      
      const result = await sendToInterests(
        patientInterests,
        title,
        body,
        instanceId,
        secretKey,
        data,
        url
      );

      if (result.success) {
        totalSuccess = pusherBeamsTokens.length;
        console.log(`Pusher Beams: Successfully sent to patient interests`);
      } else {
        totalFailed = pusherBeamsTokens.length;
        console.error(`Pusher Beams: Failed to send:`, result.error);
      }
    }

    // Note: Legacy tokens are skipped as we've migrated to Pusher Beams
    if (legacyTokens.length > 0) {
      console.log(`Skipping ${legacyTokens.length} legacy tokens - migration to Pusher Beams required`);
      totalFailed += legacyTokens.length;
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
        pusher_beams_tokens: pusherBeamsTokens.length,
        legacy_tokens: legacyTokens.length,
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
