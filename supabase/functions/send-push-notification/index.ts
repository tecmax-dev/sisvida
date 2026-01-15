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

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// Create JWT for OAuth2 authentication
async function createJWT(serviceAccount: ServiceAccount): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = serviceAccount.private_key
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${signatureB64}`;
}

// Get OAuth2 access token
async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const jwt = await createJWT(serviceAccount);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OAuth2 token error:', response.status, errorText);
    throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Send notification using FCM v1 API
async function sendFCMNotificationV1(
  token: string,
  title: string,
  body: string,
  projectId: string,
  accessToken: string,
  data?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const message = {
    message: {
      token: token,
      notification: {
        title,
        body,
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          default_vibrate_timings: true,
          default_light_settings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      data: data ? { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' } : { click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    },
  };

  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('FCM v1 API error:', response.status, JSON.stringify(errorData));
      
      // Check for unregistered token
      const errorCode = errorData?.error?.details?.[0]?.errorCode || errorData?.error?.code;
      if (errorCode === 'UNREGISTERED' || errorCode === 'INVALID_ARGUMENT') {
        return { success: false, error: errorCode };
      }
      
      return { success: false, error: errorData?.error?.message || 'Unknown error' };
    }

    return { success: true };
  } catch (error) {
    console.error('FCM request error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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

    // Get Firebase Service Account
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      console.error('FIREBASE_SERVICE_ACCOUNT not configured');
      return new Response(
        JSON.stringify({ 
          error: 'FIREBASE_SERVICE_ACCOUNT not configured',
          message: 'Please configure the Firebase Service Account JSON in your project secrets.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let serviceAccount: ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (parseError) {
      console.error('Failed to parse service account JSON:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid service account JSON',
          message: 'The FIREBASE_SERVICE_ACCOUNT secret contains invalid JSON.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OAuth2 access token
    console.log('Getting OAuth2 access token...');
    const accessToken = await getAccessToken(serviceAccount);
    console.log('Successfully obtained access token');

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

    const uniquePatientIds = [...new Set(tokensData.map(t => t.patient_id))];
    console.log(`Found ${tokensData.length} tokens for ${uniquePatientIds.length} patients`);

    // Send notifications one by one (FCM v1 API requires individual sends)
    let totalSuccess = 0;
    let totalFailed = 0;
    const invalidTokens: string[] = [];

    for (const tokenData of tokensData) {
      const result = await sendFCMNotificationV1(
        tokenData.token,
        title,
        body,
        serviceAccount.project_id,
        accessToken,
        data
      );

      if (result.success) {
        totalSuccess++;
      } else {
        totalFailed++;
        console.log(`Token failed:`, result.error);
        
        // Mark tokens with permanent errors for deactivation
        if (result.error === 'UNREGISTERED' || result.error === 'INVALID_ARGUMENT') {
          invalidTokens.push(tokenData.token);
        }
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
