import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, pragma, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

const uuidSchema = z.string().uuid();

const bodySchema = z.object({
  id: uuidSchema.optional(),
  clinic_id: uuidSchema,
  professional_id: uuidSchema,
  service_type_id: uuidSchema.nullable().optional(),
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  employee_name: z.string().trim().min(1).max(255),
  employee_cpf: z.string().trim().max(32).nullable().optional(),
  employee_phone: z.string().max(32).nullable().optional(),
  employee_prior_notice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  company_name: z.string().trim().min(1).max(255),
  company_cnpj: z.string().trim().max(32).nullable().optional(),
  company_phone: z.string().max(32).optional(),
  company_email: z.string().email().nullable().optional().or(z.literal("")),
  company_contact_name: z.string().trim().max(255).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  confirmation_token: uuidSchema.optional(),
  protocol_number: z.string().trim().max(64).nullable().optional(),
});

const normalizeTime = (value: string) => (value.length === 5 ? `${value}:00` : value);
const timeToMinutes = (value: string) => {
  const [hours, minutes] = normalizeTime(value).split(":").map(Number);
  return hours * 60 + minutes;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(rawBody);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "invalid_payload",
          details: parsed.error.flatten().fieldErrors,
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = parsed.data;

    const { data: professional, error: professionalError } = await supabase
      .from("homologacao_professionals")
      .select("id, clinic_id, is_active")
      .eq("id", body.professional_id)
      .single();

    if (professionalError || !professional || !professional.is_active || professional.clinic_id !== body.clinic_id) {
      return new Response(
        JSON.stringify({ success: false, error: "invalid_professional" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    if (body.service_type_id) {
      const { data: serviceType, error: serviceTypeError } = await supabase
        .from("homologacao_service_types")
        .select("id, clinic_id, is_active")
        .eq("id", body.service_type_id)
        .single();

      if (serviceTypeError || !serviceType || !serviceType.is_active || serviceType.clinic_id !== body.clinic_id) {
        return new Response(
          JSON.stringify({ success: false, error: "invalid_service_type" }),
          { status: 400, headers: jsonHeaders }
        );
      }
    }

    const dayOfWeek = new Date(`${body.appointment_date}T12:00:00`).getDay();
    const { data: schedule, error: scheduleError } = await supabase
      .from("homologacao_schedules")
      .select("capacity, start_time, end_time")
      .eq("clinic_id", body.clinic_id)
      .eq("professional_id", body.professional_id)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true)
      .maybeSingle();

    if (scheduleError || !schedule) {
      return new Response(
        JSON.stringify({ success: false, error: "invalid_schedule" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const startMinutes = timeToMinutes(body.start_time);
    const endMinutes = timeToMinutes(body.end_time);
    const scheduleStart = timeToMinutes(schedule.start_time);
    const scheduleEnd = timeToMinutes(schedule.end_time);

    if (startMinutes < scheduleStart || endMinutes > scheduleEnd || startMinutes >= endMinutes) {
      return new Response(
        JSON.stringify({ success: false, error: "invalid_time_range" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const { data: existingAppointments, error: existingError } = await supabase
      .from("homologacao_appointments")
      .select("id, start_time, end_time")
      .eq("clinic_id", body.clinic_id)
      .eq("professional_id", body.professional_id)
      .eq("appointment_date", body.appointment_date)
      .neq("status", "cancelled");

    if (existingError) {
      console.error("[create-homologacao-appointment] existing appointments error:", existingError);
      return new Response(
        JSON.stringify({ success: false, error: "availability_check_failed" }),
        { status: 500, headers: jsonHeaders }
      );
    }

    const overlappingCount = (existingAppointments || []).filter((appointment) => {
      const existingStart = timeToMinutes(appointment.start_time);
      const existingEnd = timeToMinutes(appointment.end_time);
      return startMinutes < existingEnd && endMinutes > existingStart;
    }).length;

    if (overlappingCount >= schedule.capacity) {
      return new Response(
        JSON.stringify({ success: false, error: "slot_unavailable" }),
        { status: 409, headers: jsonHeaders }
      );
    }

    let protocolNumber = body.protocol_number ?? null;
    if (!protocolNumber) {
      const { data: generatedProtocol, error: protocolError } = await supabase.rpc("generate_homologacao_protocol", {
        p_clinic_id: body.clinic_id,
      });

      if (protocolError) {
        console.error("[create-homologacao-appointment] protocol generation error:", protocolError);
      } else {
        protocolNumber = generatedProtocol ?? null;
      }
    }

    const insertPayload = {
      id: body.id ?? crypto.randomUUID(),
      clinic_id: body.clinic_id,
      professional_id: body.professional_id,
      service_type_id: body.service_type_id ?? null,
      appointment_date: body.appointment_date,
      start_time: normalizeTime(body.start_time),
      end_time: normalizeTime(body.end_time),
      employee_name: body.employee_name.trim(),
      employee_cpf: body.employee_cpf?.trim() || null,
      employee_phone: body.employee_phone?.trim() || null,
      employee_prior_notice_date: body.employee_prior_notice_date ?? null,
      company_name: body.company_name.trim(),
      company_cnpj: body.company_cnpj?.trim() || null,
      company_phone: body.company_phone?.trim() || "",
      company_email: body.company_email?.trim() || null,
      company_contact_name: body.company_contact_name?.trim() || null,
      notes: body.notes?.trim() || null,
      status: "scheduled",
      confirmation_token: body.confirmation_token ?? crypto.randomUUID(),
      protocol_number: protocolNumber,
    };

    const { data: appointment, error: insertError } = await supabase
      .from("homologacao_appointments")
      .insert(insertPayload)
      .select("id, clinic_id, professional_id, service_type_id, appointment_date, start_time, end_time, employee_name, employee_cpf, employee_phone, employee_prior_notice_date, company_name, company_cnpj, company_phone, company_email, company_contact_name, notes, status, confirmation_token, protocol_number")
      .single();

    if (insertError) {
      console.error("[create-homologacao-appointment] insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "insert_failed", details: insertError.message }),
        { status: 500, headers: jsonHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true, appointment }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error) {
    console.error("[create-homologacao-appointment] unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "internal_error" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});