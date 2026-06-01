import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

    const BUILD_VERSION = 'FLOW_V3_BUILD_20260515_PROSIND_IDEMPOTENT';
    const DEFAULT_CONTRIBUTION_TYPE_ID = "48bda88b-1cf9-47b6-b930-781d8a0eb55a";
    const TAXA_NEGOCIAL_CONTRIBUTION_TYPE_ID = "b9c234de-e13b-4c10-a880-616ec4abc66b";

    const pickCanonicalContribution = (rows: any[] | null | undefined) => {
      const activeRows = (rows || []).filter((row) => row.status !== 'cancelled');
      if (activeRows.length === 0) return null;
      // Prioridade: boleto em aberto (pending/overdue) com link válido — esse é o que o usuário quer pagar
      const openWithLink = activeRows.find(
        (row) => row.lytex_invoice_url && row.status !== 'paid'
      );
      if (openWithLink) return openWithLink;
      // Se TODOS estão pagos, retorna o pago
      const allPaid = activeRows.every((row) => row.status === 'paid');
      if (allPaid) return activeRows.find((row) => row.status === 'paid') || null;
      // Caso contrário, qualquer ativo não-pago
      return activeRows.find((row) => row.status !== 'paid') || activeRows[0];
    };
 
 serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
     console.log(`[ENTRYPOINT][boleto-whatsapp-flow]`, BUILD_VERSION);
    const body = await req.json();
    const { clinic_id, phone, message, action, explicit_phone_id } = body;

    console.log('[USER_ID_RAW]', phone);
    console.log('[STATE_BEFORE_CLICK]', 'Fetching state from DB...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawText = (message || "").trim();
    const text = rawText.toLowerCase();
    
    // 1. Obter ou criar sessão
    let { data: session } = await supabase
      .from('whatsapp_boleto_sessions')
      .select('*')
      .eq('clinic_id', clinic_id)
      .eq('phone', phone)
      // Removed expiration check for debugging/stability
      // .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    const isNewSession = !session || (session.state === 'SUCCESS' && action !== 'button');
    const isStartAction = action === 'start' || text === 'recomeçar' || text === 'inicio';
    
     if (isNewSession || isStartAction) {
       console.log('[SESSION_INIT_OR_RESET]', session ? 'Resetting' : 'Creating');
       const newState = 'SELECT_BOLETO_TYPE';
       
       const upsertData: any = {
         clinic_id,
         phone,
         state: newState,
         expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
         updated_at: new Date().toISOString(),
         employer_id: null,
         employer_name: null,
         employer_cnpj: null,
          contribution_id: null,
          contribution_type_id: null,
         competence_month: null,
         competence_year: null,
         value_cents: null,
         new_due_date: null,
         boleto_type: null
       };
 
       const { data: updatedSession, error: upsertError } = await supabase
         .from('whatsapp_boleto_sessions')
         .upsert(upsertData, { onConflict: 'clinic_id,phone' })
         .select()
         .single();
 
       if (upsertError) {
         console.error('[SESSION_UPSERT_FAILED]', upsertError);
         throw new Error("Session persistence failed");
       }
       session = updatedSession;
     }

    if (!session) {
      console.error('[SESSION_LOAD_FAILED]');
      throw new Error("Could not create session");
    }
    console.log('[SESSION_LOAD_SUCCESS]', session.id);

    console.log('[STATE_BEFORE_CLICK]', session.state);
    console.log('[BUTTON_CLICKED]', message);

    // Global escape hatch: "Menu Principal" clears session and exits flow
    if (text === 'menu_principal') {
      await supabase.from('whatsapp_boleto_sessions').delete().eq('id', session.id);
      return new Response(
        JSON.stringify({ success: true, response: '👋 Voltando ao menu principal...', buttons: [], newState: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let responseText = "";
    let buttons: any[] = [];
    
    console.log('[NORMALIZED_ACTION]', text);

    // 2. Máquina de Estados Simplificada e Robusta
    // Máquina de Estados com mapeamento explícito de botões
     // --- MANDATORY BOLETO STATE MACHINE ---
     const transitions: Record<string, Record<string, string>> = {
       'EMPRESA_MENU': {
         'segunda_via_btn': 'SELECT_BOLETO_TYPE'
       },
       'SELECT_BOLETO_TYPE': {
         'boleto_a_vencer': 'WAITING_CNPJ',
         'boleto_vencido': 'WAITING_CNPJ'
       },
      'CONFIRM_EMPLOYER': {
        'boleto_sim': 'SELECT_CONTRIBUTION_TYPE',
        'boleto_nao': 'WAITING_CNPJ'
      },
      'SELECT_CONTRIBUTION_TYPE': {
        'boleto_type_1': 'WAITING_PERIODO',
        'boleto_type_2': 'WAITING_PERIODO'
      },
      'CONFIRM_DATA': {
        'data_sim': 'SUCCESS',
        'data_nao': 'SELECT_BOLETO_TYPE'
      },
      'SUCCESS': {
        'recomecar': 'CONFIRM_REUSE_CNPJ'
      },
      'CONFIRM_REUSE_CNPJ': {
        'reuse_cnpj_sim': 'SELECT_BOLETO_TYPE',
        'reuse_cnpj_nao': 'SELECT_BOLETO_TYPE'
      }
     };

    // --- ROUTER ---
    console.log('[ROUTER_INPUT]', { state: session.state, input: text });
    
    let nextState = transitions[session.state]?.[text] || null;

    // Start logic override
    if (isStartAction) nextState = 'SELECT_BOLETO_TYPE';

    // Persist boleto_type selection ('a_vencer' = auto due date, 'vencido' = ask user)
    if (session.state === 'SELECT_BOLETO_TYPE' && (text === 'boleto_a_vencer' || text === 'boleto_vencido')) {
      const tipo = text === 'boleto_a_vencer' ? 'a_vencer' : 'vencido';
      await supabase.from('whatsapp_boleto_sessions').update({
        boleto_type: tipo,
        contribution_id: null,
        contribution_type_id: null,
        competence_month: null,
        competence_year: null,
        value_cents: null,
        new_due_date: null
      }).eq('id', session.id);
      session.boleto_type = tipo;
      // If employer already known (reuse flow), skip CNPJ step
      if (session.employer_id) {
        nextState = 'SELECT_CONTRIBUTION_TYPE';
      }
    }

    // Handle "Emitir Outro" → ask if reuse same CNPJ
    if (session.state === 'SUCCESS' && text === 'recomecar') {
      // Clear period/value/contribution but KEEP employer for possible reuse
      await supabase.from('whatsapp_boleto_sessions').update({
        contribution_id: null,
        contribution_type_id: null,
        competence_month: null,
        competence_year: null,
        value_cents: null,
        new_due_date: null,
        boleto_type: null
      }).eq('id', session.id);
    }

    // Handle reuse CNPJ choice
    if (session.state === 'CONFIRM_REUSE_CNPJ' && text === 'reuse_cnpj_nao') {
      // Clear employer so user is asked for a new CNPJ
      await supabase.from('whatsapp_boleto_sessions').update({
        employer_id: null,
        employer_name: null,
        employer_cnpj: null
      }).eq('id', session.id);
      session.employer_id = null;
      session.employer_name = null;
      session.employer_cnpj = null;
    }

    if (session.state === 'SELECT_CONTRIBUTION_TYPE' && (text === 'boleto_type_1' || text === 'boleto_type_2')) {
      const selectedTypeId = text === 'boleto_type_2'
        ? TAXA_NEGOCIAL_CONTRIBUTION_TYPE_ID
        : DEFAULT_CONTRIBUTION_TYPE_ID;
      await supabase.from('whatsapp_boleto_sessions').update({
        contribution_type_id: selectedTypeId,
        contribution_id: null,
        competence_month: null,
        competence_year: null,
        value_cents: null,
        new_due_date: null
      }).eq('id', session.id);
      session.contribution_type_id = selectedTypeId;
    }

    // Text input states persistence (allow state to persist while waiting for text)
    const textInputStates = ['WAITING_CNPJ', 'WAITING_PERIODO', 'WAITING_VENCIMENTO', 'WAITING_VALOR', 'WAITING_CONTRIBUICAO', 'CONFIRM_DATA'];
    if (!nextState && textInputStates.includes(session.state)) {
      nextState = session.state;
    }

    console.log('[NEXT_STATE]', nextState);

    // 3. TRANSITION ERROR (NO STATE FOUND)
    if (!nextState) {
      const errorMsg = `[DEBUG] TRANSITION_NOT_FOUND\nEstado: ${session.state}\nBotão: ${text}`;
      return new Response(
        JSON.stringify({ success: true, response: errorMsg, buttons: [], newState: session.state }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. VIEWS / RENDERERS

     const forensicPrefix = `[FORENSIC_BOLETO] ${session.state} -> ${nextState} | Input: "${text}"\n\n`;

     // STATE VIEWS (LOGIC)
     if (nextState === 'SELECT_BOLETO_TYPE') {
       const reusing = session.state === 'CONFIRM_REUSE_CNPJ' && text === 'reuse_cnpj_sim' && session.employer_name;
       responseText = reusing
         ? `Vamos lá! Boleto para *${session.employer_name}*. É *a vencer* (novo) ou *vencido* (2ª via)?`
         : `Vou te ajudar com o seu boleto. O boleto é *a vencer* (novo) ou *vencido* (2ª via)?`;
       buttons = [
         { id: 'boleto_a_vencer', title: 'A Vencer (Novo)' },
         { id: 'boleto_vencido', title: 'Vencido (2ª Via)' },
         { id: 'menu_principal', title: 'Menu Principal' }
       ];
     } else if (nextState === 'CONFIRM_REUSE_CNPJ') {
       const empName = session.employer_name || 'a empresa anterior';
       const empCnpj = session.employer_cnpj
         ? session.employer_cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
         : '';
       responseText = `Deseja emitir outro boleto para a mesma empresa?\n\n🏢 *${empName}*${empCnpj ? `\n📄 CNPJ: ${empCnpj}` : ''}`;
       buttons = [
         { id: 'reuse_cnpj_sim', title: '✅ Mesmo CNPJ' },
         { id: 'reuse_cnpj_nao', title: '🔄 Outro CNPJ' },
         { id: 'menu_principal', title: 'Menu Principal' }
       ];
     } else if (nextState === 'WAITING_CNPJ' && session.state !== 'WAITING_CNPJ') {
       responseText = "📋 Por favor, informe o *CNPJ* da empresa (apenas números):";
     } else if (nextState === 'SELECT_CONTRIBUTION_TYPE') {
       responseText = "📝 Qual o *tipo de contribuição*?";
       buttons = [
         { id: 'boleto_type_1', title: 'Mensalidade' },
         { id: 'boleto_type_2', title: 'Taxa' },
         { id: 'menu_principal', title: 'Menu Principal' }
       ];
     } else if (session.state === 'WAITING_CNPJ') {
      const cleanCnpj = text.replace(/\D/g, '');
      if (cleanCnpj.length === 14) {
        const { data: employer } = await supabase
          .from('employers')
          .select('id, name')
          .eq('clinic_id', clinic_id)
          .eq('cnpj', cleanCnpj)
          .maybeSingle();

        if (employer) {
          responseText = `✅ *Empresa identificada!*\n\n🏢 *${employer.name}*\n\nÉ essa a empresa correta?`;
          buttons = [
            { id: 'boleto_sim', title: '✅ Sim' },
           { id: 'boleto_nao', title: '❌ Não' },
           { id: 'menu_principal', title: 'Menu Principal' }
          ];
          nextState = 'CONFIRM_EMPLOYER';
          await supabase.from('whatsapp_boleto_sessions').update({ 
            employer_id: employer.id, 
            employer_name: employer.name,
            employer_cnpj: cleanCnpj 
          }).eq('id', session.id);
        } else {
          responseText = "❌ Empresa não encontrada com este CNPJ. Por favor, verifique o número e digite novamente:";
        }
      } else {
        responseText = "❌ CNPJ inválido. Digite os 14 números do CNPJ da empresa:";
      }
    } else if (session.state === 'CONFIRM_EMPLOYER') {
      // Caso onde clicou no botão mas não foi mapeado acima
      responseText = "Ok, vamos tentar outro CNPJ. Por favor, digite o CNPJ correto:";
      nextState = 'WAITING_CNPJ';
      } else if (nextState === 'WAITING_PERIODO' && session.state === 'SELECT_CONTRIBUTION_TYPE') {
        responseText = "📅 Informe o *período* do boleto (ex: 05/2026):";
      } else if (session.state === 'WAITING_PERIODO') {
        const periodRegex = /^(0[1-9]|1[0-2])\/\d{4}$/;
        if (periodRegex.test(text)) {
          const cMonth = parseInt(text.split('/')[0]);
          const cYear = parseInt(text.split('/')[1]);
          await supabase.from('whatsapp_boleto_sessions').update({ 
            competence_month: cMonth, 
            competence_year: cYear 
          }).eq('id', session.id);

          const selectedContributionTypeId = session.contribution_type_id || DEFAULT_CONTRIBUTION_TYPE_ID;

          // Verificar se já existe a contribuição (período/tipo) no sistema ProSind/Supabase
          const { data: existingContribRows, error: existingContribError } = await supabase
            .from('employer_contributions')
            .select('id, lytex_invoice_url, lytex_invoice_id, value, due_date, status')
            .eq('employer_id', session.employer_id)
            .eq('contribution_type_id', selectedContributionTypeId)
            .eq('competence_month', cMonth)
            .eq('competence_year', cYear)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: true });

          if (existingContribError) {
            console.error('[EXISTING_CONTRIB_LOOKUP_FAILED]', existingContribError);
          }

          const existingContrib = pickCanonicalContribution(existingContribRows);

          if (existingContrib) {
            if (existingContrib.status === 'paid') {
               responseText = `✅ *Este período (${text}) já consta como PAGO!* \n\nNão é necessário emitir um novo boleto.`;
               buttons = [{ id: 'menu_principal', title: 'Menu Principal' }];
               nextState = 'SUCCESS';
            } else {
              // Verificar se está vencido
              const today = new Date();
              const dueDate = existingContrib.due_date ? new Date(existingContrib.due_date) : null;
              const isOverdue = dueDate && dueDate < today;

               if (existingContrib.value === 0) {
                 responseText = `📍 *Encontrei este período no sistema, mas o valor está zerado.*\n\nPor favor, informe a *nova data de vencimento* desejada (ex: 10/06/2026):`;
                 
                 await supabase.from('whatsapp_boleto_sessions').update({ 
                   contribution_id: existingContrib.id,
                   value_cents: 0
                 }).eq('id', session.id);
                 
                 nextState = 'WAITING_VENCIMENTO';
               } else if (isOverdue) {
                 responseText = `📍 *Encontrei este período no sistema, mas ele está VENCIDO.*\n\n📅 Vencimento original: *${dueDate ? dueDate.toLocaleDateString('pt-BR') : 'N/A'}*\n💰 Valor: *R$ ${(existingContrib.value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\nPor favor, informe a *nova data de vencimento* desejada (ex: 10/06/2026):`;
                 
                 // Salvar dados na sessão para reutilizar
                 await supabase.from('whatsapp_boleto_sessions').update({ 
                   contribution_id: existingContrib.id,
                   value_cents: existingContrib.value
                 }).eq('id', session.id);
                 
                 nextState = 'WAITING_VENCIMENTO';
               } else if (existingContrib.lytex_invoice_url) {
                responseText = `📍 *Boleto já existente e dentro do prazo!*\n\n📅 Vencimento: *${dueDate?.toLocaleDateString('pt-BR')}*\n💰 Valor: *R$ ${(existingContrib.value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n🔗 *Link:* ${existingContrib.lytex_invoice_url}\n\nO que deseja fazer?`;
                buttons = [
                  { id: 'recomecar', title: 'Emitir Outro' },
                  { id: 'menu_principal', title: 'Menu Principal' }
                ];
                nextState = 'SUCCESS';
              } else {
                // Existe mas não tem link (raro), pedir valor
                responseText = `📍 *Encontrei o registro deste período.*\n\nInforme o *valor* para emissão (ex: 150,00):`;
                await supabase.from('whatsapp_boleto_sessions').update({ contribution_id: existingContrib.id }).eq('id', session.id);
                nextState = 'WAITING_VALOR';
              }
            }
          } else {
            // Caso não exista a contribuição, fluxo normal
            if (session.boleto_type === 'a_vencer') {
              let dueYear = cYear;
              let dueMonth = cMonth + 1;
              if (dueMonth > 12) { dueMonth = 1; dueYear += 1; }
              const due = new Date(Date.UTC(dueYear, dueMonth - 1, 10, 12, 0, 0));
              const dow = due.getUTCDay();
              if (dow === 6) due.setUTCDate(due.getUTCDate() + 2);
              else if (dow === 0) due.setUTCDate(due.getUTCDate() + 1);
              const isoDate = due.toISOString();
              await supabase.from('whatsapp_boleto_sessions').update({ new_due_date: isoDate }).eq('id', session.id);

               responseText = "💰 Informe o *valor* do boleto (ex: 150,00):";
              nextState = 'WAITING_VALOR';
            } else {
              responseText = "📅 Informe a *data de vencimento* desejada (ex: 10/06/2026):";
              nextState = 'WAITING_VENCIMENTO';
            }
          }
        } else {
          responseText = "❌ Formato inválido. Informe o período como MM/AAAA (ex: 05/2026):";
        }
      } else if (session.state === 'WAITING_VENCIMENTO') {
        const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        if (dateRegex.test(text)) {
           const [d, m, y] = text.split('/');
           const isoDate = `${y}-${m}-${d}T12:00:00Z`;
           
           // Obter sessão atualizada para checar se temos contribution_id (reemissão)
           const { data: updatedSession } = await supabase.from('whatsapp_boleto_sessions').select('contribution_id, value_cents, employer_name, competence_month, competence_year').eq('id', session.id).single();

           if (updatedSession?.contribution_id && updatedSession?.value_cents) {
             // Se estamos reemitindo, pulamos a pergunta do valor
             await supabase.from('whatsapp_boleto_sessions').update({ new_due_date: isoDate }).eq('id', session.id);
             
             const formattedValor = (updatedSession.value_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
             const competencia = `${String(updatedSession.competence_month).padStart(2, '0')}/${updatedSession.competence_year}`;
             const displayDate = text;

             responseText = `🔍 *Confirmação de Dados (Reemissão)*\n\n🏢 Empresa: *${updatedSession.employer_name}*\n📅 Competência: *${competencia}*\n📅 Vencimento: *${displayDate}*\n💰 Valor: *R$ ${formattedValor}*\n\nOs dados estão corretos?`;
             buttons = [
               { id: 'data_sim', title: '✅ Sim' },
               { id: 'data_nao', title: '❌ Não, Recomeçar' },
               { id: 'menu_principal', title: 'Menu Principal' }
             ];
             nextState = 'CONFIRM_DATA';
           } else {
             // Fluxo normal: pedir valor
             responseText = "💰 Informe o *valor* do boleto (ex: 150,00):";
             nextState = 'WAITING_VALOR';
             await supabase.from('whatsapp_boleto_sessions').update({ new_due_date: isoDate }).eq('id', session.id);
           }
        } else {
          responseText = "❌ Data inválida. Informe no formato DD/MM/AAAA (ex: 10/06/2026):";
          nextState = 'WAITING_VENCIMENTO';
        }
      } else if (session.state === 'WAITING_VALOR') {
        const cleanValor = text.replace(',', '.');
        const valorNum = parseFloat(cleanValor);
        if (!isNaN(valorNum) && valorNum > 0) {
          const valorCents = Math.round(valorNum * 100);
          await supabase.from('whatsapp_boleto_sessions').update({ 
            value_cents: valorCents 
          }).eq('id', session.id);
          
          const formattedValor = valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
          const competencia = `${String(session.competence_month).padStart(2, '0')}/${session.competence_year}`;
          
          // Get the due date from the session (we just saved it in nextState logic above, but session variable is old)
          const { data: updatedSession } = await supabase.from('whatsapp_boleto_sessions').select('new_due_date').eq('id', session.id).single();
          const displayDate = updatedSession?.new_due_date ? new Date(updatedSession.new_due_date).toLocaleDateString('pt-BR') : 'Não informada';

          responseText = `🔍 *Confirmação de Dados*\n\n🏢 Empresa: *${session.employer_name}*\n📅 Competência: *${competencia}*\n📅 Vencimento: *${displayDate}*\n💰 Valor: *R$ ${formattedValor}*\n\nOs dados estão corretos?`;
          buttons = [
            { id: 'data_sim', title: '✅ Sim' },
           { id: 'data_nao', title: '❌ Não, Recomeçar' },
           { id: 'menu_principal', title: 'Menu Principal' }
          ];
          nextState = 'CONFIRM_DATA';
        } else {
          responseText = "❌ Valor inválido. Informe o valor numérico (ex: 150,00):";
          nextState = 'WAITING_VALOR';
        }
    } else if (session.state === 'CONFIRM_DATA') {
      if (text === 'data_sim') {
        const { data: processingLock, error: processingLockError } = await supabase
          .from('whatsapp_boleto_sessions')
          .update({ state: 'PROCESSING', updated_at: new Date().toISOString() })
          .eq('id', session.id)
          .eq('state', 'CONFIRM_DATA')
          .select('id')
          .maybeSingle();

        if (processingLockError) {
          console.error('[PROCESSING_LOCK_FAILED]', processingLockError);
        }

        if (!processingLock) {
          return new Response(
            JSON.stringify({
              success: true,
              response: '⏳ Sua solicitação de boleto já está sendo processada. Aguarde a próxima mensagem para evitar geração duplicada.',
              buttons: [],
              newState: session.state
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[LYTEX_INTEGRATION] Calling lytex-api for', session.employer_cnpj);
        
        try {
          const { data: finalSession } = await supabase
            .from('whatsapp_boleto_sessions')
            .select('*')
            .eq('id', session.id)
            .single();
          
          let contributionId = finalSession.contribution_id;
          const selectedContributionTypeId = finalSession.contribution_type_id || DEFAULT_CONTRIBUTION_TYPE_ID;
          let reusedExistingContrib: any = null;

          if (!contributionId) {
            // Última checagem idempotente: reaproveita o período/tipo se ele já existir no ProSindWeb
            const { data: existingContribRows, error: existingContribError } = await supabase
              .from('employer_contributions')
              .select('id, lytex_invoice_url, lytex_invoice_id, value, due_date, status')
              .eq('employer_id', finalSession.employer_id)
              .eq('contribution_type_id', selectedContributionTypeId)
              .eq('competence_month', finalSession.competence_month)
              .eq('competence_year', finalSession.competence_year)
              .neq('status', 'cancelled')
              .order('created_at', { ascending: true });

            if (existingContribError) console.error('[FINAL_EXISTING_CONTRIB_LOOKUP_FAILED]', existingContribError);

            const existingContrib = pickCanonicalContribution(existingContribRows);
            if (existingContrib) {
              reusedExistingContrib = existingContrib;
              contributionId = existingContrib.id;
              await supabase.from('whatsapp_boleto_sessions').update({ contribution_id: contributionId }).eq('id', session.id);
            }
          }

          if (reusedExistingContrib?.status === 'paid') {
            responseText = `✅ *Este período já consta como PAGO!*\n\nNão é necessário emitir um novo boleto.`;
            buttons = [{ id: 'menu_principal', title: 'Menu Principal' }];
            nextState = 'SUCCESS';
          } else if (reusedExistingContrib?.lytex_invoice_url && reusedExistingContrib?.due_date && new Date(reusedExistingContrib.due_date) >= new Date()) {
            const dueDate = new Date(reusedExistingContrib.due_date + 'T12:00:00');
            responseText = `📍 *Boleto já existente para este período!*\n\n📅 Vencimento: *${dueDate.toLocaleDateString('pt-BR')}*\n💰 Valor: *R$ ${(reusedExistingContrib.value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n🔗 *Link:* ${reusedExistingContrib.lytex_invoice_url}`;
            buttons = [{ id: 'menu_principal', title: 'Menu Principal' }];
            nextState = 'SUCCESS';
          } else if (false) {
            // placeholder to keep the mutually exclusive generation branch below explicit
          }

          if (!responseText && !contributionId) {
            // Criar novo registro somente se o período/tipo ainda não existir
            const { data: newContrib, error: contribError } = await supabase
              .from('employer_contributions')
              .insert({
                clinic_id: clinic_id,
                employer_id: finalSession.employer_id,
                contribution_type_id: selectedContributionTypeId,
                competence_month: finalSession.competence_month,
                competence_year: finalSession.competence_year,
                value: finalSession.value_cents,
                due_date: finalSession.new_due_date ? finalSession.new_due_date.split('T')[0] : new Date().toISOString().split('T')[0],
                status: 'pending',
                origin: 'lytex',
                notes: `[Gerado via WhatsApp em ${new Date().toLocaleDateString('pt-BR')}]`
              })
              .select('id')
              .maybeSingle();

            if (contribError) {
              console.error('[CONTRIB_CREATE_FAILED]', contribError);
            }
            contributionId = newContrib?.id;
          } else if (!responseText) {
            // Atualizar registro existente
            const { error: updateError } = await supabase
              .from('employer_contributions')
              .update({
                value: finalSession.value_cents,
                due_date: finalSession.new_due_date ? finalSession.new_due_date.split('T')[0] : new Date().toISOString().split('T')[0],
                notes: `[Reemitido via WhatsApp em ${new Date().toLocaleDateString('pt-BR')}]`
              })
              .eq('id', contributionId);
            
            if (updateError) console.error('[CONTRIB_UPDATE_FAILED]', updateError);
          }

          if (!contributionId) {
            console.error('[CONTRIB_ID_MISSING_AFTER_IDEMPOTENT_CREATE]');
            responseText = "❌ Não foi possível localizar ou criar o período no ProSindWeb. Tente novamente em instantes.";
            nextState = 'CONFIRM_DATA';
            await supabase.from('whatsapp_boleto_sessions').update({ state: 'CONFIRM_DATA' }).eq('id', session.id);
            return new Response(
              JSON.stringify({ success: true, response: responseText, buttons: [], newState: nextState }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (!responseText) {
            const lytexResponse = await fetch(`${supabaseUrl}/functions/v1/lytex-api`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
              },
              body: JSON.stringify({
                action: 'createInvoice',
                clientName: finalSession.employer_name,
                clientDocument: finalSession.employer_cnpj,
                value: finalSession.value_cents,
                valueIsInCents: true,
                dueDate: finalSession.new_due_date ? finalSession.new_due_date.split('T')[0] : new Date().toISOString().split('T')[0],
                description: `Mensalidade ${String(finalSession.competence_month).padStart(2, '0')}/${finalSession.competence_year}`,
                clientId: contributionId,
                installmentId: contributionId
              })
            });

          const lytexData = await lytexResponse.json();
          console.log('[LYTEX_API_RESPONSE]', lytexData);

            if (lytexData.success && lytexData.invoice) {
            const invoiceUrl = lytexData.invoice.linkBoleto || lytexData.invoice.invoiceUrl || lytexData.invoice.linkCheckout || lytexData.invoice.url;
            const lytexInvoiceId = lytexData.invoice._id || lytexData.invoice.id;

            // Atualizar a contribuição com os dados da Lytex para que apareça no ProSind
            await supabase
              .from('employer_contributions')
              .update({
                lytex_invoice_id: lytexInvoiceId,
                lytex_invoice_url: invoiceUrl,
                status: 'pending' // Garante que o status está pendente ao reemitir
              })
              .eq('id', contributionId);

            responseText = `✅ *Boleto Gerado com Sucesso!*\n\n🔗 *Link do Boleto:* ${invoiceUrl}\n\nO boleto já está disponível no ProSindWeb.`;
            } else {
              console.error('[LYTEX_FAILURE]', lytexData);
              responseText = `❌ *Erro ao gerar boleto na Lytex*\n\nDetalhe: ${lytexData.error || 'Erro desconhecido'}\n\nPor favor, tente novamente mais tarde ou entre em contato com o suporte.`;
            }
          }
        } catch (e) {
          console.error('[LYTEX_INTEGRATION_CRITICAL_ERROR]', e);
          responseText = "❌ Desculpe, ocorreu um erro técnico ao processar sua solicitação com a Lytex. Por favor, tente novamente em instantes.";
        }
        
        nextState = 'SUCCESS';
      } else {
        responseText = "Entendido. Vamos recomeçar o processo do boleto.";
        nextState = 'SELECT_BOLETO_TYPE';
      }
     } else if (session.state === 'SUCCESS') {
       // Reset flow if user types anything after success
       responseText = "Vou te ajudar com um novo boleto. O boleto é *a vencer* (novo) ou *vencido* (2ª via)?";
       buttons = [
         { id: 'boleto_a_vencer', title: 'A Vencer (Novo)' },
         { id: 'boleto_vencido', title: 'Vencido (2ª Via)' },
         { id: 'menu_principal', title: 'Menu Principal' }
       ];
       nextState = 'SELECT_BOLETO_TYPE';
     } else {
       // SE NÃO EXISTIR TRANSIÇÃO: APENAS DEBUG
       if (nextState === session.state && !responseText) {
         responseText = `[DEBUG] TRANSITION_NOT_FOUND\nEstado: ${session.state}\nBotão: ${text}`;
       }
     }

    // 3. Atualizar estado no banco
    const { error: updateError } = await supabase.from('whatsapp_boleto_sessions')
      .update({ state: nextState, updated_at: new Date().toISOString() })
      .eq('id', session.id);
    
    if (updateError) {
      console.error('[SESSION_UPDATE_FAILED]', updateError);
    } else {
      console.log('[SESSION_SAVE_SUCCESS]', { id: session.id, nextState });
    }

    // 4. Retornar resposta limpa para o webhook enviar (removendo prefixo forensic)
    console.log('[DEBUG_NOVA_STATE_MACHINE][RESPONSE]', responseText);

    return new Response(
      JSON.stringify({ 
        success: true, 
        response: responseText, 
        buttons: buttons,
        newState: nextState 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[DEBUG_BOLETO_FLOW][ERROR]', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
