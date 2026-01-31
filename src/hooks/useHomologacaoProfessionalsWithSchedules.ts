import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProfessionalSchedule {
  id: string;
  professional_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
  is_active: boolean;
}

export interface HomologacaoProfessional {
  id: string;
  name: string;
  function?: string | null;
  avatar_url?: string | null;
  specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  schedules?: ProfessionalSchedule[];
}

interface UseHomologacaoProfessionalsOptions {
  clinicId: string | undefined;
  enabled?: boolean;
}

/**
 * Hook to fetch homologacao professionals with their schedules
 */
export function useHomologacaoProfessionalsWithSchedules({
  clinicId,
  enabled = true,
}: UseHomologacaoProfessionalsOptions) {
  return useQuery({
    queryKey: ["homologacao-professionals-with-schedules", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];

      // Fetch professionals
      const { data: professionals, error: profError } = await supabase
        .from("homologacao_professionals")
        .select("id, name, function, avatar_url, phone, email, is_active")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (profError) throw profError;
      if (!professionals || professionals.length === 0) return [];

      // Fetch schedules for all professionals
      const professionalIds = professionals.map((p) => p.id);
      const { data: schedules, error: schedError } = await supabase
        .from("homologacao_schedules")
        .select("id, professional_id, day_of_week, start_time, end_time, capacity, is_active")
        .in("professional_id", professionalIds)
        .eq("is_active", true);

      if (schedError) throw schedError;

      // Map schedules to professionals
      const professionalsWithSchedules: HomologacaoProfessional[] = professionals.map((prof) => ({
        ...prof,
        schedules: (schedules || []).filter((s) => s.professional_id === prof.id),
      }));

      return professionalsWithSchedules;
    },
    enabled: !!clinicId && enabled,
  });
}

/**
 * Filters professionals that have schedules for a specific day of week
 * @param professionals - List of professionals with schedules
 * @param dayOfWeek - Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * @returns Filtered list of professionals that work on the specified day
 */
export function filterProfessionalsByDayOfWeek(
  professionals: HomologacaoProfessional[],
  dayOfWeek: number
): HomologacaoProfessional[] {
  return professionals.filter((prof) =>
    prof.schedules?.some((s) => s.day_of_week === dayOfWeek && s.is_active)
  );
}

/**
 * Gets the schedule for a specific professional on a specific day
 * @param professional - Professional with schedules
 * @param dayOfWeek - Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * @returns Schedule for that day or undefined
 */
export function getProfessionalScheduleForDay(
  professional: HomologacaoProfessional,
  dayOfWeek: number
): ProfessionalSchedule | undefined {
  return professional.schedules?.find((s) => s.day_of_week === dayOfWeek && s.is_active);
}

/**
 * Checks if a professional works on a specific day
 * @param professional - Professional with schedules
 * @param dayOfWeek - Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * @returns true if the professional works on that day
 */
export function professionalWorksOnDay(
  professional: HomologacaoProfessional,
  dayOfWeek: number
): boolean {
  return professional.schedules?.some((s) => s.day_of_week === dayOfWeek && s.is_active) ?? false;
}

/**
 * Gets human-readable day names for a professional's working days
 */
export function getProfessionalWorkingDays(professional: HomologacaoProfessional): string[] {
  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const workingDays = professional.schedules
    ?.filter((s) => s.is_active)
    .map((s) => dayNames[s.day_of_week])
    .sort((a, b) => {
      const order = dayNames.indexOf(a) - dayNames.indexOf(b);
      return order;
    });
  return [...new Set(workingDays || [])];
}
