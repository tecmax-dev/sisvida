import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify super admin
    const { data: superAdmin } = await supabaseAdmin
      .from("super_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!superAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado - apenas super admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get clinic_id from query params
    const url = new URL(req.url);
    const clinicId = url.searchParams.get("clinic_id");
    
    if (!clinicId) {
      return new Response(JSON.stringify({ error: "clinic_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Starting complete AI backup v1.0 for clinic: ${clinicId}`);

    // Fetch clinic info
    const { data: clinicData, error: clinicError } = await supabaseAdmin
      .from("clinics")
      .select("*")
      .eq("id", clinicId)
      .single();

    if (clinicError || !clinicData) {
      return new Response(JSON.stringify({ error: "Clínica não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper function to fetch all data with pagination
    const fetchAllData = async (table: string, filter: { column: string; value: string }, orderBy?: string) => {
      const allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabaseAdmin.from(table).select("*").eq(filter.column, filter.value);
        
        if (orderBy) {
          query = query.order(orderBy, { ascending: true });
        }
        
        const { data, error } = await query.range(from, from + pageSize - 1);
        
        if (error) {
          console.error(`Error fetching ${table}:`, error);
          return [];
        }
        
        if (data && data.length > 0) {
          allData.push(...data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      
      return allData;
    };

    // Helper to format date only (YYYY-MM-DD)
    const formatDate = (d: string | null): string | null => {
      if (!d) return null;
      return d.split('T')[0];
    };

    // ==================== PHASE 1: Base Config and Catalogs ====================
    console.log("Phase 1: Fetching base config and catalogs...");
    
    const [
      specialtiesRaw,
      employerCategoriesRaw,
      insurancePlansRaw,
      proceduresRaw,
      contributionTypesRaw,
      anamneseTemplatesRaw,
      accessGroupsRaw,
      documentSettingsRaw,
      clinicHolidaysRaw,
      whatsappConfigRaw
    ] = await Promise.all([
      fetchAllData("specialties", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("employer_categories", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("insurance_plans", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("procedures", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("contribution_types", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("anamnese_templates", { column: "clinic_id", value: clinicId }, "title"),
      fetchAllData("access_groups", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("document_settings", { column: "clinic_id", value: clinicId }, "created_at"),
      fetchAllData("clinic_holidays", { column: "clinic_id", value: clinicId }, "holiday_date"),
      fetchAllData("whatsapp_config", { column: "clinic_id", value: clinicId }, "created_at")
    ]);

    // ==================== PHASE 2: Main Entities ====================
    console.log("Phase 2: Fetching main entities...");
    
    const [
      accountingOfficesRaw,
      employersRaw,
      professionalsRaw,
      patientsRaw
    ] = await Promise.all([
      fetchAllData("accounting_offices", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("employers", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("professionals", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("patients", { column: "clinic_id", value: clinicId }, "name")
    ]);

    // ==================== PHASE 3: Dependent Entities ====================
    console.log("Phase 3: Fetching dependent entities...");
    
    const [
      patientDependentsRaw,
      patientCardsRaw,
      professionalSchedulesRaw,
      professionalScheduleExceptionsRaw,
      accountingOfficeEmployersRaw,
      userRolesRaw
    ] = await Promise.all([
      fetchAllData("patient_dependents", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("patient_cards", { column: "clinic_id", value: clinicId }, "created_at"),
      fetchAllData("professional_schedules", { column: "clinic_id", value: clinicId }, "created_at"),
      fetchAllData("professional_schedule_exceptions", { column: "clinic_id", value: clinicId }, "exception_date"),
      fetchAllData("accounting_office_employers", { column: "accounting_office_id", value: accountingOfficesRaw.map(ao => ao.id).join(",") || "00000000-0000-0000-0000-000000000000" }, "created_at"),
      fetchAllData("user_roles", { column: "clinic_id", value: clinicId }, "created_at")
    ]);

    // Fix: Fetch accounting_office_employers properly (need to iterate)
    let accountingOfficeEmployersFinal: any[] = [];
    for (const ao of accountingOfficesRaw) {
      const { data } = await supabaseAdmin
        .from("accounting_office_employers")
        .select("*")
        .eq("accounting_office_id", ao.id);
      if (data) accountingOfficeEmployersFinal.push(...data);
    }

    // ==================== PHASE 4: Transactions and Records ====================
    console.log("Phase 4: Fetching transactions and records...");
    
    const [
      appointmentsRaw,
      medicalRecordsRaw,
      employerContributionsRaw,
      anamnesisRaw,
      waitingListRaw
    ] = await Promise.all([
      fetchAllData("appointments", { column: "clinic_id", value: clinicId }, "appointment_date"),
      fetchAllData("medical_records", { column: "clinic_id", value: clinicId }, "created_at"),
      fetchAllData("employer_contributions", { column: "clinic_id", value: clinicId }, "due_date"),
      fetchAllData("anamnesis", { column: "clinic_id", value: clinicId }, "filled_at"),
      fetchAllData("waiting_list", { column: "clinic_id", value: clinicId }, "created_at")
    ]);

    // ==================== PHASE 5: More Dependent Data ====================
    console.log("Phase 5: Fetching anamnese details and financial data...");
    
    // Fetch anamnese questions for templates
    let anamneseQuestionsRaw: any[] = [];
    for (const template of anamneseTemplatesRaw) {
      const { data } = await supabaseAdmin
        .from("anamnese_questions")
        .select("*")
        .eq("template_id", template.id)
        .order("order_index");
      if (data) anamneseQuestionsRaw.push(...data);
    }

    // Fetch question options
    let anamneseQuestionOptionsRaw: any[] = [];
    for (const question of anamneseQuestionsRaw) {
      const { data } = await supabaseAdmin
        .from("anamnese_question_options")
        .select("*")
        .eq("question_id", question.id)
        .order("order_index");
      if (data) anamneseQuestionOptionsRaw.push(...data);
    }

    // Fetch anamnese responses
    const anamneseResponsesRaw = await fetchAllData("anamnese_responses", { column: "clinic_id", value: clinicId }, "created_at");
    
    // Fetch anamnese answers for responses
    let anamneseAnswersRaw: any[] = [];
    for (const response of anamneseResponsesRaw) {
      const { data } = await supabaseAdmin
        .from("anamnese_answers")
        .select("*")
        .eq("response_id", response.id);
      if (data) anamneseAnswersRaw.push(...data);
    }

    // Financial data
    const [
      financialCategoriesRaw,
      cashRegistersRaw,
      financialTransactionsRaw,
      cashTransfersRaw
    ] = await Promise.all([
      fetchAllData("financial_categories", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("cash_registers", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("financial_transactions", { column: "clinic_id", value: clinicId }, "created_at"),
      fetchAllData("cash_transfers", { column: "clinic_id", value: clinicId }, "transfer_date")
    ]);

    // Access group permissions
    let accessGroupPermissionsRaw: any[] = [];
    for (const group of accessGroupsRaw) {
      const { data } = await supabaseAdmin
        .from("access_group_permissions")
        .select("*")
        .eq("access_group_id", group.id);
      if (data) accessGroupPermissionsRaw.push(...data);
    }

    // Debt negotiations
    const debtNegotiationsRaw = await fetchAllData("debt_negotiations", { column: "clinic_id", value: clinicId }, "created_at");
    
    // Negotiation items
    let negotiationItemsRaw: any[] = [];
    for (const negotiation of debtNegotiationsRaw) {
      const { data } = await supabaseAdmin
        .from("negotiation_items")
        .select("*")
        .eq("negotiation_id", negotiation.id);
      if (data) negotiationItemsRaw.push(...data);
    }

    // Negotiation installments
    let negotiationInstallmentsRaw: any[] = [];
    for (const negotiation of debtNegotiationsRaw) {
      const { data } = await supabaseAdmin
        .from("negotiation_installments")
        .select("*")
        .eq("negotiation_id", negotiation.id);
      if (data) negotiationInstallmentsRaw.push(...data);
    }

    // ==================== PHASE 6: Logs and History ====================
    console.log("Phase 6: Fetching logs and history...");
    
    const [
      whatsappBookingSessionsRaw,
      whatsappMessageLogsRaw,
      campaignsRaw,
      automationFlowsRaw,
      patientSegmentsRaw
    ] = await Promise.all([
      fetchAllData("whatsapp_booking_sessions", { column: "clinic_id", value: clinicId }, "created_at"),
      fetchAllData("whatsapp_message_logs", { column: "clinic_id", value: clinicId }, "sent_at"),
      fetchAllData("campaigns", { column: "clinic_id", value: clinicId }, "created_at"),
      fetchAllData("automation_flows", { column: "clinic_id", value: clinicId }, "created_at"),
      fetchAllData("patient_segments", { column: "clinic_id", value: clinicId }, "name")
    ]);

    console.log(`Fetched data summary: professionals=${professionalsRaw.length}, employers=${employersRaw.length}, patients=${patientsRaw.length}, appointments=${appointmentsRaw.length}`);

    // ==================== CREATE ID SETS FOR VALIDATION ====================
    const patientIds = new Set(patientsRaw.map((p: any) => p.id));
    const professionalIds = new Set(professionalsRaw.map((p: any) => p.id));
    const employerIds = new Set(employersRaw.map((e: any) => e.id));
    const contributionTypeIds = new Set(contributionTypesRaw.map((ct: any) => ct.id));
    const procedureIds = new Set(proceduresRaw.map((p: any) => p.id));
    const dependentIds = new Set(patientDependentsRaw.map((pd: any) => pd.id));
    const appointmentIds = new Set(appointmentsRaw.map((a: any) => a.id));
    const templateIds = new Set(anamneseTemplatesRaw.map((t: any) => t.id));
    const questionIds = new Set(anamneseQuestionsRaw.map((q: any) => q.id));
    const responseIds = new Set(anamneseResponsesRaw.map((r: any) => r.id));
    const accessGroupIds = new Set(accessGroupsRaw.map((ag: any) => ag.id));
    const accountingOfficeIds = new Set(accountingOfficesRaw.map((ao: any) => ao.id));
    const financialCategoryIds = new Set(financialCategoriesRaw.map((fc: any) => fc.id));
    const cashRegisterIds = new Set(cashRegistersRaw.map((cr: any) => cr.id));
    const negotiationIds = new Set(debtNegotiationsRaw.map((n: any) => n.id));
    const insurancePlanIds = new Set(insurancePlansRaw.map((ip: any) => ip.id));
    const specialtyIds = new Set(specialtiesRaw.map((s: any) => s.id));
    const categoryIds = new Set(employerCategoriesRaw.map((c: any) => c.id));

    // ==================== TRANSFORM DATA ====================

    // CLINIC - full data
    const clinics = [{
      id: clinicData.id,
      name: clinicData.name,
      slug: clinicData.slug,
      cnpj: clinicData.cnpj,
      email: clinicData.email,
      phone: clinicData.phone,
      address: clinicData.address,
      city: clinicData.city,
      state_code: clinicData.state_code,
      opening_time: clinicData.opening_time,
      closing_time: clinicData.closing_time,
      reminder_enabled: clinicData.reminder_enabled,
      reminder_hours: clinicData.reminder_hours,
      birthday_enabled: clinicData.birthday_enabled,
      birthday_message: clinicData.birthday_message
    }];

    // SPECIALTIES
    const specialties = specialtiesRaw.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      is_active: s.is_active
    }));

    // EMPLOYER_CATEGORIES
    const employerCategories = employerCategoriesRaw.map((ec: any) => ({
      id: ec.id,
      name: ec.name,
      description: ec.description,
      color: ec.color,
      is_active: ec.is_active
    }));

    // INSURANCE_PLANS
    const insurancePlans = insurancePlansRaw.map((ip: any) => ({
      id: ip.id,
      name: ip.name,
      code: ip.code,
      is_active: ip.is_active
    }));

    // PROCEDURES
    const procedures = proceduresRaw.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      duration_minutes: p.duration_minutes,
      price: p.price,
      is_active: p.is_active
    }));

    // CONTRIBUTION_TYPES
    const contributionTypes = contributionTypesRaw.map((ct: any) => ({
      id: ct.id,
      name: ct.name,
      description: ct.description,
      default_value: ct.default_value,
      is_active: ct.is_active
    }));

    // ANAMNESE_TEMPLATES
    const anamneseTemplates = anamneseTemplatesRaw.map((at: any) => ({
      id: at.id,
      title: at.title,
      description: at.description,
      is_active: at.is_active
    }));

    // ACCESS_GROUPS
    const accessGroups = accessGroupsRaw.map((ag: any) => ({
      id: ag.id,
      name: ag.name,
      description: ag.description,
      is_active: ag.is_active,
      is_system: ag.is_system
    }));

    // DOCUMENT_SETTINGS
    const documentSettings = documentSettingsRaw.map((ds: any) => ({
      id: ds.id,
      paper_size: ds.paper_size,
      show_logo: ds.show_logo,
      show_address: ds.show_address,
      show_phone: ds.show_phone,
      show_cnpj: ds.show_cnpj,
      show_footer: ds.show_footer,
      footer_text: ds.footer_text,
      prescription_title: ds.prescription_title,
      prescription_template: ds.prescription_template,
      certificate_title: ds.certificate_title,
      certificate_template: ds.certificate_template,
      exam_request_title: ds.exam_request_title,
      exam_request_template: ds.exam_request_template,
      attendance_title: ds.attendance_title,
      attendance_template: ds.attendance_template
    }));

    // CLINIC_HOLIDAYS
    const clinicHolidays = clinicHolidaysRaw.map((ch: any) => ({
      id: ch.id,
      name: ch.name,
      holiday_date: formatDate(ch.holiday_date),
      is_recurring: ch.is_recurring,
      recurring_day: ch.recurring_day,
      recurring_month: ch.recurring_month
    }));

    // WHATSAPP_CONFIG
    const whatsappConfig = whatsappConfigRaw.map((wc: any) => ({
      id: wc.id,
      instance_name: wc.instance_name,
      api_url: wc.api_url,
      is_active: wc.is_active
    }));

    // ACCOUNTING_OFFICES
    const accountingOffices = accountingOfficesRaw.map((ao: any) => ({
      id: ao.id,
      name: ao.name || "Escritório não informado",
      email: ao.email,
      cnpj: ao.cnpj,
      phone: ao.phone,
      contact_name: ao.contact_name,
      trade_name: ao.trade_name,
      address: ao.address,
      city: ao.city,
      state: ao.state,
      legacy_id: ao.legacy_id,
      is_active: ao.is_active
    }));

    // EMPLOYERS
    const employers = employersRaw.map((e: any) => ({
      id: e.id,
      name: e.name || "Empresa não informada",
      cnpj: e.cnpj || null,
      trade_name: e.trade_name,
      email: e.email,
      phone: e.phone,
      address: e.address,
      neighborhood: e.neighborhood,
      city: e.city,
      state: e.state,
      cep: e.cep,
      registration_number: e.registration_number,
      cnae_code: e.cnae_code,
      cnae_description: e.cnae_description,
      category_id: categoryIds.has(e.category_id) ? e.category_id : null,
      lytex_client_id: e.lytex_client_id,
      notes: e.notes,
      is_active: e.is_active
    }));

    // PROFESSIONALS
    const professionals = professionalsRaw.map((p: any) => ({
      id: p.id,
      name: p.name || "Profissional não informado",
      email: p.email || null,
      phone: p.phone,
      role: p.role || "medico",
      specialty_id: specialtyIds.has(p.specialty_id) ? p.specialty_id : null,
      registration_number: p.registration_number,
      registration_state: p.registration_state,
      appointment_duration: p.appointment_duration,
      schedule: p.schedule,
      is_active: p.is_active
    }));

    // PATIENTS - name and phone NEVER null
    const patients = patientsRaw.map((p: any) => ({
      id: p.id,
      name: p.name || "Nome não informado",
      phone: p.phone ?? "",
      cpf: p.cpf,
      birth_date: formatDate(p.birth_date),
      email: p.email,
      gender: p.gender,
      rg: p.rg,
      address: p.address,
      neighborhood: p.neighborhood,
      city: p.city,
      state: p.state,
      cep: p.cep,
      employer_id: employerIds.has(p.employer_id) ? p.employer_id : null,
      insurance_plan_id: insurancePlanIds.has(p.insurance_plan_id) ? p.insurance_plan_id : null,
      registration_number: p.registration_number,
      tag: p.tag,
      notes: p.notes,
      is_active: p.is_active ?? true,
      max_appointments_per_month: p.max_appointments_per_month,
      photo_url: p.photo_url
    }));

    // PATIENT_DEPENDENTS
    const patientDependents = patientDependentsRaw
      .filter((pd: any) => patientIds.has(pd.patient_id))
      .map((pd: any) => ({
        id: pd.id,
        patient_id: pd.patient_id,
        name: pd.name || "Dependente não informado",
        relationship: pd.relationship,
        birth_date: formatDate(pd.birth_date),
        cpf: pd.cpf,
        phone: pd.phone,
        email: pd.email,
        is_active: pd.is_active
      }));

    // PATIENT_CARDS
    const patientCards = patientCardsRaw
      .filter((pc: any) => patientIds.has(pc.patient_id))
      .map((pc: any) => ({
        id: pc.id,
        patient_id: pc.patient_id,
        card_number: pc.card_number,
        expires_at: pc.expires_at,
        is_active: pc.is_active
      }));

    // PROFESSIONAL_SCHEDULES
    const professionalSchedules = professionalSchedulesRaw
      .filter((ps: any) => professionalIds.has(ps.professional_id))
      .map((ps: any) => ({
        id: ps.id,
        professional_id: ps.professional_id,
        day_of_week: ps.day_of_week,
        start_time: ps.start_time,
        end_time: ps.end_time,
        is_active: ps.is_active
      }));

    // PROFESSIONAL_SCHEDULE_EXCEPTIONS
    const professionalScheduleExceptions = professionalScheduleExceptionsRaw
      .filter((pse: any) => professionalIds.has(pse.professional_id))
      .map((pse: any) => ({
        id: pse.id,
        professional_id: pse.professional_id,
        exception_date: formatDate(pse.exception_date),
        start_time: pse.start_time,
        end_time: pse.end_time,
        is_available: pse.is_available,
        reason: pse.reason
      }));

    // ACCOUNTING_OFFICE_EMPLOYERS
    const accountingOfficeEmployers = accountingOfficeEmployersFinal
      .filter((aoe: any) => accountingOfficeIds.has(aoe.accounting_office_id) && employerIds.has(aoe.employer_id))
      .map((aoe: any) => ({
        id: aoe.id,
        accounting_office_id: aoe.accounting_office_id,
        employer_id: aoe.employer_id
      }));

    // USER_ROLES
    const userRoles = userRolesRaw.map((ur: any) => ({
      id: ur.id,
      user_id: ur.user_id,
      role: ur.role,
      professional_id: professionalIds.has(ur.professional_id) ? ur.professional_id : null,
      access_group_id: accessGroupIds.has(ur.access_group_id) ? ur.access_group_id : null
    }));

    // APPOINTMENTS
    const appointments = appointmentsRaw
      .filter((a: any) => patientIds.has(a.patient_id) && professionalIds.has(a.professional_id))
      .map((a: any) => ({
        id: a.id,
        patient_id: a.patient_id,
        professional_id: a.professional_id,
        procedure_id: procedureIds.has(a.procedure_id) ? a.procedure_id : null,
        dependent_id: dependentIds.has(a.dependent_id) ? a.dependent_id : null,
        appointment_date: formatDate(a.appointment_date),
        start_time: a.start_time,
        end_time: a.end_time,
        duration_minutes: a.duration_minutes,
        status: a.status,
        type: a.type,
        notes: a.notes,
        cancellation_reason: a.cancellation_reason,
        is_recurring: a.is_recurring,
        recurrence_group_id: a.recurrence_group_id
      }));

    // MEDICAL_RECORDS
    const medicalRecords = medicalRecordsRaw
      .filter((mr: any) => patientIds.has(mr.patient_id))
      .map((mr: any) => ({
        id: mr.id,
        patient_id: mr.patient_id,
        professional_id: professionalIds.has(mr.professional_id) ? mr.professional_id : null,
        appointment_id: appointmentIds.has(mr.appointment_id) ? mr.appointment_id : null,
        dependent_id: dependentIds.has(mr.dependent_id) ? mr.dependent_id : null,
        record_date: formatDate(mr.record_date) || formatDate(mr.created_at),
        notes: mr.notes,
        diagnosis: mr.diagnosis,
        prescription: mr.prescription,
        vital_signs: mr.vital_signs,
        exams_requested: mr.exams_requested,
        created_at: mr.created_at
      }));

    // EMPLOYER_CONTRIBUTIONS
    const employerContributions = employerContributionsRaw
      .filter((ec: any) => employerIds.has(ec.employer_id) && contributionTypeIds.has(ec.contribution_type_id))
      .map((ec: any) => ({
        id: ec.id,
        employer_id: ec.employer_id,
        contribution_type_id: ec.contribution_type_id,
        negotiation_id: negotiationIds.has(ec.negotiation_id) ? ec.negotiation_id : null,
        value: ec.value,
        competence_month: ec.competence_month,
        competence_year: ec.competence_year,
        due_date: formatDate(ec.due_date),
        status: ec.status,
        paid_at: ec.paid_at,
        paid_value: ec.paid_value,
        payment_method: ec.payment_method,
        notes: ec.notes,
        lytex_invoice_id: ec.lytex_invoice_id,
        lytex_invoice_url: ec.lytex_invoice_url
      }));

    // ANAMNESIS (legacy format)
    const anamnesis = anamnesisRaw
      .filter((a: any) => patientIds.has(a.patient_id))
      .map((a: any) => ({
        id: a.id,
        patient_id: a.patient_id,
        filled_at: a.filled_at,
        blood_type: a.blood_type,
        allergies: a.allergies,
        chronic_diseases: a.chronic_diseases,
        current_medications: a.current_medications,
        previous_surgeries: a.previous_surgeries,
        family_history: a.family_history,
        smoking: a.smoking,
        alcohol: a.alcohol,
        physical_activity: a.physical_activity,
        emergency_contact_name: a.emergency_contact_name,
        emergency_contact_phone: a.emergency_contact_phone,
        additional_notes: a.additional_notes
      }));

    // WAITING_LIST
    const waitingList = waitingListRaw
      .filter((wl: any) => patientIds.has(wl.patient_id))
      .map((wl: any) => ({
        id: wl.id,
        patient_id: wl.patient_id,
        professional_id: professionalIds.has(wl.professional_id) ? wl.professional_id : null,
        procedure_id: procedureIds.has(wl.procedure_id) ? wl.procedure_id : null,
        preferred_date: formatDate(wl.preferred_date),
        preferred_time_start: wl.preferred_time_start,
        preferred_time_end: wl.preferred_time_end,
        status: wl.status,
        notes: wl.notes,
        priority: wl.priority
      }));

    // ANAMNESE_QUESTIONS
    const anamneseQuestions = anamneseQuestionsRaw
      .filter((q: any) => templateIds.has(q.template_id))
      .map((q: any) => ({
        id: q.id,
        template_id: q.template_id,
        question_text: q.question_text,
        question_type: q.question_type,
        order_index: q.order_index,
        is_required: q.is_required
      }));

    // ANAMNESE_QUESTION_OPTIONS
    const anamneseQuestionOptions = anamneseQuestionOptionsRaw
      .filter((o: any) => questionIds.has(o.question_id))
      .map((o: any) => ({
        id: o.id,
        question_id: o.question_id,
        option_text: o.option_text,
        order_index: o.order_index
      }));

    // ANAMNESE_RESPONSES
    const anamneseResponses = anamneseResponsesRaw
      .filter((r: any) => patientIds.has(r.patient_id) && templateIds.has(r.template_id))
      .map((r: any) => ({
        id: r.id,
        template_id: r.template_id,
        patient_id: r.patient_id,
        professional_id: professionalIds.has(r.professional_id) ? r.professional_id : null,
        filled_by_patient: r.filled_by_patient,
        responsibility_accepted: r.responsibility_accepted,
        signature_data: r.signature_data,
        signed_at: r.signed_at,
        created_at: r.created_at
      }));

    // ANAMNESE_ANSWERS
    const anamneseAnswers = anamneseAnswersRaw
      .filter((a: any) => responseIds.has(a.response_id) && questionIds.has(a.question_id))
      .map((a: any) => ({
        id: a.id,
        response_id: a.response_id,
        question_id: a.question_id,
        answer_text: a.answer_text,
        answer_option_ids: a.answer_option_ids
      }));

    // FINANCIAL_CATEGORIES
    const financialCategories = financialCategoriesRaw.map((fc: any) => ({
      id: fc.id,
      name: fc.name,
      type: fc.type,
      parent_id: fc.parent_id,
      is_active: fc.is_active
    }));

    // CASH_REGISTERS
    const cashRegisters = cashRegistersRaw.map((cr: any) => ({
      id: cr.id,
      name: cr.name,
      type: cr.type,
      initial_balance: cr.initial_balance,
      current_balance: cr.current_balance,
      bank_name: cr.bank_name,
      agency: cr.agency,
      account_number: cr.account_number,
      is_active: cr.is_active
    }));

    // FINANCIAL_TRANSACTIONS
    const financialTransactions = financialTransactionsRaw.map((ft: any) => ({
      id: ft.id,
      type: ft.type,
      amount: ft.amount,
      description: ft.description,
      transaction_date: formatDate(ft.transaction_date),
      category_id: financialCategoryIds.has(ft.category_id) ? ft.category_id : null,
      patient_id: patientIds.has(ft.patient_id) ? ft.patient_id : null,
      appointment_id: appointmentIds.has(ft.appointment_id) ? ft.appointment_id : null,
      payment_method: ft.payment_method,
      status: ft.status,
      notes: ft.notes
    }));

    // CASH_TRANSFERS
    const cashTransfers = cashTransfersRaw
      .filter((ct: any) => cashRegisterIds.has(ct.from_register_id) && cashRegisterIds.has(ct.to_register_id))
      .map((ct: any) => ({
        id: ct.id,
        from_register_id: ct.from_register_id,
        to_register_id: ct.to_register_id,
        amount: ct.amount,
        transfer_date: formatDate(ct.transfer_date),
        description: ct.description
      }));

    // ACCESS_GROUP_PERMISSIONS
    const accessGroupPermissions = accessGroupPermissionsRaw
      .filter((agp: any) => accessGroupIds.has(agp.access_group_id))
      .map((agp: any) => ({
        id: agp.id,
        access_group_id: agp.access_group_id,
        permission_key: agp.permission_key
      }));

    // DEBT_NEGOTIATIONS
    const debtNegotiations = debtNegotiationsRaw
      .filter((dn: any) => employerIds.has(dn.employer_id))
      .map((dn: any) => ({
        id: dn.id,
        employer_id: dn.employer_id,
        negotiation_code: dn.negotiation_code,
        status: dn.status,
        total_original_value: dn.total_original_value,
        total_negotiated_value: dn.total_negotiated_value,
        total_interest: dn.total_interest,
        total_late_fee: dn.total_late_fee,
        total_monetary_correction: dn.total_monetary_correction,
        applied_interest_rate: dn.applied_interest_rate,
        applied_late_fee_rate: dn.applied_late_fee_rate,
        applied_correction_rate: dn.applied_correction_rate,
        installments_count: dn.installments_count,
        installment_value: dn.installment_value,
        first_due_date: formatDate(dn.first_due_date),
        down_payment_value: dn.down_payment_value,
        down_payment_due_date: formatDate(dn.down_payment_due_date),
        approved_at: dn.approved_at,
        finalized_at: dn.finalized_at,
        cancelled_at: dn.cancelled_at,
        cancellation_reason: dn.cancellation_reason
      }));

    // NEGOTIATION_ITEMS
    const negotiationItems = negotiationItemsRaw
      .filter((ni: any) => negotiationIds.has(ni.negotiation_id))
      .map((ni: any) => ({
        id: ni.id,
        negotiation_id: ni.negotiation_id,
        contribution_id: ni.contribution_id,
        original_value: ni.original_value,
        interest_value: ni.interest_value,
        late_fee_value: ni.late_fee_value,
        correction_value: ni.correction_value,
        final_value: ni.final_value
      }));

    // NEGOTIATION_INSTALLMENTS
    const negotiationInstallments = negotiationInstallmentsRaw
      .filter((ni: any) => negotiationIds.has(ni.negotiation_id))
      .map((ni: any) => ({
        id: ni.id,
        negotiation_id: ni.negotiation_id,
        installment_number: ni.installment_number,
        value: ni.value,
        due_date: formatDate(ni.due_date),
        status: ni.status,
        paid_at: ni.paid_at,
        paid_value: ni.paid_value,
        lytex_invoice_id: ni.lytex_invoice_id,
        lytex_invoice_url: ni.lytex_invoice_url
      }));

    // WHATSAPP_BOOKING_SESSIONS
    const whatsappBookingSessions = whatsappBookingSessionsRaw.map((wbs: any) => ({
      id: wbs.id,
      phone: wbs.phone,
      state: wbs.state,
      context: wbs.context,
      patient_id: patientIds.has(wbs.patient_id) ? wbs.patient_id : null,
      expires_at: wbs.expires_at,
      created_at: wbs.created_at
    }));

    // WHATSAPP_MESSAGE_LOGS - limit to last 30 days for size
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const whatsappMessageLogs = whatsappMessageLogsRaw
      .filter((wml: any) => new Date(wml.sent_at) >= thirtyDaysAgo)
      .map((wml: any) => ({
        id: wml.id,
        phone: wml.phone,
        message_type: wml.message_type,
        status: wml.status,
        sent_at: wml.sent_at,
        error_message: wml.error_message
      }));

    // CAMPAIGNS
    const campaigns = campaignsRaw.map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      channel: c.channel,
      message_template: c.message_template,
      image_url: c.image_url,
      status: c.status,
      scheduled_at: c.scheduled_at,
      sent_count: c.sent_count,
      delivered_count: c.delivered_count,
      failed_count: c.failed_count
    }));

    // AUTOMATION_FLOWS
    const automationFlows = automationFlowsRaw.map((af: any) => ({
      id: af.id,
      name: af.name,
      trigger_type: af.trigger_type,
      trigger_config: af.trigger_config,
      channel: af.channel,
      message_template: af.message_template,
      delay_hours: af.delay_hours,
      is_active: af.is_active,
      execution_count: af.execution_count
    }));

    // PATIENT_SEGMENTS
    const patientSegments = patientSegmentsRaw.map((ps: any) => ({
      id: ps.id,
      name: ps.name,
      description: ps.description,
      filters: ps.filters,
      is_active: ps.is_active
    }));

    // ==================== BUILD BACKUP ====================
    const backup = {
      version: "1.0",
      clinic_name: clinicData.name,
      clinic_slug: clinicData.slug,
      backup_date: new Date().toISOString(),
      record_counts: {
        clinics: 1,
        specialties: specialties.length,
        employer_categories: employerCategories.length,
        insurance_plans: insurancePlans.length,
        procedures: procedures.length,
        contribution_types: contributionTypes.length,
        anamnese_templates: anamneseTemplates.length,
        access_groups: accessGroups.length,
        document_settings: documentSettings.length,
        clinic_holidays: clinicHolidays.length,
        whatsapp_config: whatsappConfig.length,
        accounting_offices: accountingOffices.length,
        employers: employers.length,
        professionals: professionals.length,
        patients: patients.length,
        patient_dependents: patientDependents.length,
        patient_cards: patientCards.length,
        professional_schedules: professionalSchedules.length,
        professional_schedule_exceptions: professionalScheduleExceptions.length,
        accounting_office_employers: accountingOfficeEmployers.length,
        user_roles: userRoles.length,
        appointments: appointments.length,
        medical_records: medicalRecords.length,
        employer_contributions: employerContributions.length,
        anamnesis: anamnesis.length,
        waiting_list: waitingList.length,
        anamnese_questions: anamneseQuestions.length,
        anamnese_question_options: anamneseQuestionOptions.length,
        anamnese_responses: anamneseResponses.length,
        anamnese_answers: anamneseAnswers.length,
        financial_categories: financialCategories.length,
        cash_registers: cashRegisters.length,
        financial_transactions: financialTransactions.length,
        cash_transfers: cashTransfers.length,
        access_group_permissions: accessGroupPermissions.length,
        debt_negotiations: debtNegotiations.length,
        negotiation_items: negotiationItems.length,
        negotiation_installments: negotiationInstallments.length,
        whatsapp_booking_sessions: whatsappBookingSessions.length,
        whatsapp_message_logs: whatsappMessageLogs.length,
        campaigns: campaigns.length,
        automation_flows: automationFlows.length,
        patient_segments: patientSegments.length
      },
      errors: [],
      data: {
        clinics,
        specialties,
        employer_categories: employerCategories,
        insurance_plans: insurancePlans,
        procedures,
        contribution_types: contributionTypes,
        anamnese_templates: anamneseTemplates,
        access_groups: accessGroups,
        document_settings: documentSettings,
        clinic_holidays: clinicHolidays,
        whatsapp_config: whatsappConfig,
        accounting_offices: accountingOffices,
        employers,
        professionals,
        patients,
        patient_dependents: patientDependents,
        patient_cards: patientCards,
        professional_schedules: professionalSchedules,
        professional_schedule_exceptions: professionalScheduleExceptions,
        accounting_office_employers: accountingOfficeEmployers,
        user_roles: userRoles,
        appointments,
        medical_records: medicalRecords,
        employer_contributions: employerContributions,
        anamnesis,
        waiting_list: waitingList,
        anamnese_questions: anamneseQuestions,
        anamnese_question_options: anamneseQuestionOptions,
        anamnese_responses: anamneseResponses,
        anamnese_answers: anamneseAnswers,
        financial_categories: financialCategories,
        cash_registers: cashRegisters,
        financial_transactions: financialTransactions,
        cash_transfers: cashTransfers,
        access_group_permissions: accessGroupPermissions,
        debt_negotiations: debtNegotiations,
        negotiation_items: negotiationItems,
        negotiation_installments: negotiationInstallments,
        whatsapp_booking_sessions: whatsappBookingSessions,
        whatsapp_message_logs: whatsappMessageLogs,
        campaigns,
        automation_flows: automationFlows,
        patient_segments: patientSegments
      }
    };

    const totalRecords = Object.values(backup.record_counts).reduce((a, b) => a + b, 0);
    console.log(`Backup complete v1.0: ${totalRecords} records across ${Object.keys(backup.record_counts).length} tables`);

    const jsonContent = JSON.stringify(backup, null, 2);
    const filename = `backup_${clinicData.slug}_${new Date().toISOString().split('T')[0]}.json`;

    return new Response(jsonContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error("Backup error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
