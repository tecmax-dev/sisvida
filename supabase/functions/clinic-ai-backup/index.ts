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

    console.log(`Starting simplified AI backup for clinic: ${clinicId}`);

    // Fetch clinic info
    const { data: clinicData, error: clinicError } = await supabaseAdmin
      .from("clinics")
      .select("id, name, slug")
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

    // Fetch all data in parallel
    console.log("Fetching all data...");
    
    const [
      professionalsRaw,
      proceduresRaw,
      employersRaw,
      patientsRaw,
      patientDependentsRaw,
      patientCardsRaw,
      accountingOfficesRaw,
      contributionTypesRaw,
      employerContributionsRaw,
      medicalRecordsRaw,
      appointmentsRaw,
      accessGroupsRaw,
      anamneseTemplatesRaw,
      professionalSchedulesRaw
    ] = await Promise.all([
      fetchAllData("professionals", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("procedures", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("employers", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("patients", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("patient_dependents", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("patient_cards", { column: "clinic_id", value: clinicId }, "created_at"),
      fetchAllData("accounting_offices", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("contribution_types", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("employer_contributions", { column: "clinic_id", value: clinicId }, "due_date"),
      fetchAllData("medical_records", { column: "clinic_id", value: clinicId }, "created_at"),
      fetchAllData("appointments", { column: "clinic_id", value: clinicId }, "appointment_date"),
      fetchAllData("access_groups", { column: "clinic_id", value: clinicId }, "name"),
      fetchAllData("anamnese_templates", { column: "clinic_id", value: clinicId }, "title"),
      fetchAllData("professional_schedules", { column: "clinic_id", value: clinicId }, "created_at")
    ]);

    console.log(`Fetched: professionals=${professionalsRaw.length}, employers=${employersRaw.length}, patients=${patientsRaw.length}`);

    // Create sets of valid IDs for referential integrity validation
    const patientIds = new Set(patientsRaw.map((p: any) => p.id));
    const professionalIds = new Set(professionalsRaw.map((p: any) => p.id));
    const employerIds = new Set(employersRaw.map((e: any) => e.id));
    const contributionTypeIds = new Set(contributionTypesRaw.map((ct: any) => ct.id));

    // Transform and validate data according to the simplified structure

    // CLINIC
    const clinic = {
      name: clinicData.name,
      slug: clinicData.slug
    };

    // PROFESSIONALS - simplified
    const professionals = professionalsRaw.map((p: any) => ({
      id: p.id,
      name: p.name || "Profissional não informado",
      email: p.email || null,
      role: p.role || "medico"
    }));

    // PROCEDURES - keep original structure
    const procedures = proceduresRaw.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      duration_minutes: p.duration_minutes,
      price: p.price,
      is_active: p.is_active
    }));

    // EMPLOYERS - simplified
    const employers = employersRaw.map((e: any) => ({
      id: e.id,
      name: e.name || "Empresa não informada",
      cnpj: e.cnpj || null,
      trade_name: e.trade_name,
      email: e.email,
      phone: e.phone,
      address: e.address,
      city: e.city,
      state: e.state,
      is_active: e.is_active
    }));

    // PATIENTS - CRITICAL: name and phone NEVER null
    const patients = patientsRaw.map((p: any) => ({
      id: p.id,
      name: p.name || "Nome não informado",  // NEVER null
      phone: p.phone ?? "",  // NEVER null, use empty string
      cpf: p.cpf,
      birth_date: formatDate(p.birth_date),
      email: p.email,
      employer_id: employerIds.has(p.employer_id) ? p.employer_id : null,  // Validate FK
      insurance_plan_id: p.insurance_plan_id,
      is_active: p.is_active ?? true,
      gender: p.gender,
      address: p.address,
      city: p.city,
      state: p.state,
      cep: p.cep,
      rg: p.rg,
      registration_number: p.registration_number
    }));

    // PATIENT_DEPENDENTS - validate patient_id exists
    const patientDependents = patientDependentsRaw
      .filter((pd: any) => patientIds.has(pd.patient_id))
      .map((pd: any) => ({
        id: pd.id,
        patient_id: pd.patient_id,
        name: pd.name || "Dependente não informado",
        relationship: pd.relationship,
        birth_date: formatDate(pd.birth_date),
        cpf: pd.cpf
      }));

    // PATIENT_CARDS - validate patient_id exists
    const patientCards = patientCardsRaw
      .filter((pc: any) => patientIds.has(pc.patient_id))
      .map((pc: any) => ({
        id: pc.id,
        patient_id: pc.patient_id,
        card_number: pc.card_number,
        expires_at: pc.expires_at,
        is_active: pc.is_active
      }));

    // ACCOUNTING_OFFICES
    const accountingOffices = accountingOfficesRaw.map((ao: any) => ({
      id: ao.id,
      name: ao.name || "Escritório não informado",
      email: ao.email,
      cnpj: ao.cnpj,
      phone: ao.phone,
      contact_name: ao.contact_name,
      is_active: ao.is_active
    }));

    // EMPLOYER_CONTRIBUTIONS - validate employer_id and contribution_type_id exist
    const employerContributions = employerContributionsRaw
      .filter((ec: any) => employerIds.has(ec.employer_id) && contributionTypeIds.has(ec.contribution_type_id))
      .map((ec: any) => ({
        id: ec.id,
        employer_id: ec.employer_id,
        contribution_type_id: ec.contribution_type_id,
        value: ec.value,
        competence_month: ec.competence_month,
        competence_year: ec.competence_year,
        due_date: formatDate(ec.due_date),
        status: ec.status,
        paid_at: ec.paid_at,
        paid_value: ec.paid_value,
        notes: ec.notes
      }));

    // MEDICAL_RECORDS - CRITICAL: validate patient_id exists
    const medicalRecords = medicalRecordsRaw
      .filter((mr: any) => patientIds.has(mr.patient_id))
      .map((mr: any) => ({
        id: mr.id,
        patient_id: mr.patient_id,
        professional_id: professionalIds.has(mr.professional_id) ? mr.professional_id : null,
        record_date: formatDate(mr.record_date) || formatDate(mr.created_at),
        notes: mr.notes,
        diagnosis: mr.diagnosis,
        prescription: mr.prescription,
        vital_signs: mr.vital_signs,
        exams_requested: mr.exams_requested,
        created_at: mr.created_at
      }));

    // APPOINTMENTS - CRITICAL: validate patient_id and professional_id exist
    const appointments = appointmentsRaw
      .filter((a: any) => patientIds.has(a.patient_id) && professionalIds.has(a.professional_id))
      .map((a: any) => ({
        id: a.id,
        patient_id: a.patient_id,
        professional_id: a.professional_id,
        procedure_id: a.procedure_id,
        appointment_date: formatDate(a.appointment_date),
        start_time: a.start_time,
        end_time: a.end_time,
        status: a.status,
        type: a.type,
        notes: a.notes
      }));

    // ACCESS_GROUPS
    const accessGroups = accessGroupsRaw.map((ag: any) => ({
      id: ag.id,
      name: ag.name,
      description: ag.description,
      is_active: ag.is_active,
      is_system: ag.is_system
    }));

    // ANAMNESE_TEMPLATES
    const anamneseTemplates = anamneseTemplatesRaw.map((at: any) => ({
      id: at.id,
      title: at.title,
      description: at.description,
      is_active: at.is_active
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

    // Log validation summary
    const orphanedMedicalRecords = medicalRecordsRaw.length - medicalRecords.length;
    const orphanedAppointments = appointmentsRaw.length - appointments.length;
    const orphanedContributions = employerContributionsRaw.length - employerContributions.length;
    
    if (orphanedMedicalRecords > 0) {
      console.log(`Filtered ${orphanedMedicalRecords} orphaned medical records`);
    }
    if (orphanedAppointments > 0) {
      console.log(`Filtered ${orphanedAppointments} orphaned appointments`);
    }
    if (orphanedContributions > 0) {
      console.log(`Filtered ${orphanedContributions} orphaned contributions`);
    }

    // Build the simplified backup structure
    const backup = {
      clinic,
      professionals,
      procedures,
      employers,
      patients,
      patient_dependents: patientDependents,
      patient_cards: patientCards,
      accounting_offices: accountingOffices,
      employer_contributions: employerContributions,
      medical_records: medicalRecords,
      appointments,
      access_groups: accessGroups,
      anamnese_templates: anamneseTemplates,
      professional_schedules: professionalSchedules,
      
      // Metadata for import validation
      _metadata: {
        generated_at: new Date().toISOString(),
        source_clinic_id: clinicId,
        record_counts: {
          professionals: professionals.length,
          procedures: procedures.length,
          employers: employers.length,
          patients: patients.length,
          patient_dependents: patientDependents.length,
          patient_cards: patientCards.length,
          accounting_offices: accountingOffices.length,
          employer_contributions: employerContributions.length,
          medical_records: medicalRecords.length,
          appointments: appointments.length,
          access_groups: accessGroups.length,
          anamnese_templates: anamneseTemplates.length,
          professional_schedules: professionalSchedules.length
        },
        validation_notes: {
          orphaned_records_filtered: {
            medical_records: orphanedMedicalRecords,
            appointments: orphanedAppointments,
            employer_contributions: orphanedContributions
          }
        },
        import_order: [
          "1. clinic",
          "2. professionals",
          "3. procedures", 
          "4. employers",
          "5. patients",
          "6. patient_dependents",
          "7. patient_cards",
          "8. accounting_offices",
          "9. employer_contributions",
          "10. medical_records",
          "11. appointments",
          "12. access_groups",
          "13. anamnese_templates",
          "14. professional_schedules"
        ]
      }
    };

    const totalRecords = professionals.length + procedures.length + employers.length + 
      patients.length + patientDependents.length + patientCards.length + 
      accountingOffices.length + employerContributions.length + medicalRecords.length + 
      appointments.length + accessGroups.length + anamneseTemplates.length + professionalSchedules.length;

    console.log(`Backup complete: ${totalRecords} records total`);

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
