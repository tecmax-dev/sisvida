import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://czmnkrurkzuerrcjzbkp.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PHONE = "557388633535";
const CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

async function callFlow(phone: string, message: string, action?: string) {
  const url = SUPABASE_URL + "/functions/v1/boleto-whatsapp-flow";
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      clinic_id: CLINIC_ID,
      phone: phone,
      message: message,
      action: action
    })
  });
  if (!response.ok) {
    const text = await response.text();
    console.log('HTTP ERROR', response.status, text);
    return { error: text };
  }
  return await response.json();
}

async function getSession(phone: string) {
  const { data, error } = await supabase
    .from('whatsapp_boleto_sessions')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();
  if (error) console.log('DB ERROR', error);
  return data;
}

async function runTest() {
  console.log('Starting E2E Test...');

  // Reset session
  console.log('Deleting existing sessions for', PHONE);
  await supabase.from('whatsapp_boleto_sessions').delete().eq('phone', PHONE);
  
  // 1. Initial State
  console.log('\n--- STEP 1: START ---');
  let res = await callFlow(PHONE, 'segunda_via_btn', 'start');
  let session = await getSession(PHONE);
  
  console.log('[E2E_STATE]', 'START');
  console.log('[E2E_BUTTON]', 'segunda_via_btn');
  console.log('[E2E_NEXT]', res.newState);
  console.log('[E2E_SESSION]', session?.state);
  console.log('[E2E_RESPONSE]', res.response);

  if (res.newState !== 'SELECT_BOLETO_TYPE') {
    console.log('[E2E_FAIL] Expected SELECT_BOLETO_TYPE, received', res.newState);
    return;
  }

  // 2. Select Boleto Type
  console.log('\n--- STEP 2: SELECT_BOLETO_TYPE ---');
  res = await callFlow(PHONE, 'boleto_a_vencer');
  session = await getSession(PHONE);

  console.log('[E2E_STATE]', 'SELECT_BOLETO_TYPE');
  console.log('[E2E_BUTTON]', 'boleto_a_vencer');
  console.log('[E2E_NEXT]', res.newState);
  console.log('[E2E_SESSION]', session?.state);
  console.log('[E2E_RESPONSE]', res.response);

  if (res.newState !== 'WAITING_CNPJ') {
    console.log('[E2E_FAIL] Expected WAITING_CNPJ, received', res.newState);
    return;
  }

  // 3. Enter CNPJ
  console.log('\n--- STEP 3: WAITING_CNPJ ---');
  res = await callFlow(PHONE, '03025212000111');
  session = await getSession(PHONE);

  console.log('[E2E_STATE]', 'WAITING_CNPJ');
  console.log('[E2E_BUTTON]', '03025212000111');
  console.log('[E2E_NEXT]', res.newState);
  console.log('[E2E_SESSION]', session?.state);
  console.log('[E2E_RESPONSE]', res.response);

  if (res.newState !== 'CONFIRM_EMPLOYER') {
    console.log('[E2E_FAIL] Expected CONFIRM_EMPLOYER, received', res.newState);
    return;
  }

  // 4. Confirm Employer
  console.log('\n--- STEP 4: CONFIRM_EMPLOYER ---');
  res = await callFlow(PHONE, 'boleto_sim');
  session = await getSession(PHONE);

  console.log('[E2E_STATE]', 'CONFIRM_EMPLOYER');
  console.log('[E2E_BUTTON]', 'boleto_sim');
  console.log('[E2E_NEXT]', res.newState);
  console.log('[E2E_SESSION]', session?.state);
  console.log('[E2E_RESPONSE]', res.response);

  if (res.newState !== 'SELECT_CONTRIBUTION_TYPE') {
    console.log('[E2E_FAIL] Expected SELECT_CONTRIBUTION_TYPE, received', res.newState);
    return;
  }

  console.log('\n[E2E_SUCCESS] Flow reached SELECT_CONTRIBUTION_TYPE successfully');
}

runTest();
