import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SpecialtyCategory = 'medical' | 'dental' | 'aesthetic' | 'therapy' | 'massage';

export interface Specialty {
  id: string;
  name: string;
  category: SpecialtyCategory;
  registration_prefix: string | null;
  is_dental: boolean | null;
  is_active: boolean | null;
}

export interface ProfessionalSpecialty {
  id: string;
  specialty_id: string;
  specialty: Specialty;
}

const CATEGORY_LABELS: Record<SpecialtyCategory, string> = {
  medical: 'Médico',
  dental: 'Odontológico',
  aesthetic: 'Estética',
  therapy: 'Terapias',
  massage: 'Massoterapia',
};

const CATEGORY_ORDER: SpecialtyCategory[] = ['medical', 'dental', 'aesthetic', 'therapy', 'massage'];

export function useSpecialties() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpecialties();
  }, []);

  const fetchSpecialties = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('specialties')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setSpecialties(data || []);
    } catch (error) {
      console.error('Error fetching specialties:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSpecialtiesByCategory = () => {
    const grouped: Record<SpecialtyCategory, Specialty[]> = {
      medical: [],
      dental: [],
      aesthetic: [],
      therapy: [],
      massage: [],
    };

    specialties.forEach((specialty) => {
      // Validate category exists and is a valid category before grouping
      const category = specialty?.category;
      if (category && CATEGORY_ORDER.includes(category) && grouped[category]) {
        grouped[category].push(specialty);
      }
    });

    return CATEGORY_ORDER.map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      specialties: grouped[category],
    }));
  };

  const fetchProfessionalSpecialties = async (professionalId: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('professional_specialties')
        .select('specialty_id')
        .eq('professional_id', professionalId);

      if (error) throw error;
      return (data || []).map((ps) => ps.specialty_id);
    } catch (error) {
      console.error('Error fetching professional specialties:', error);
      return [];
    }
  };

  const saveProfessionalSpecialties = async (
    professionalId: string,
    specialtyIds: string[]
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Delete existing specialties
      const { error: deleteError } = await supabase
        .from('professional_specialties')
        .delete()
        .eq('professional_id', professionalId);

      if (deleteError) {
        console.error('Error deleting professional specialties:', deleteError);
        return { success: false, error: deleteError.message };
      }

      // Insert new specialties
      if (specialtyIds.length > 0) {
        const { error: insertError } = await supabase
          .from('professional_specialties')
          .insert(
            specialtyIds.map((specialty_id) => ({
              professional_id: professionalId,
              specialty_id,
            }))
          );

        if (insertError) {
          console.error('Error inserting professional specialties:', insertError);
          return { success: false, error: insertError.message };
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error saving professional specialties:', error);
      return { success: false, error: error?.message || 'Erro desconhecido' };
    }
  };

  const hasDentalSpecialty = async (professionalId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('professional_specialties')
        .select('specialty:specialties(is_dental)')
        .eq('professional_id', professionalId);

      if (error) throw error;
      
      return (data || []).some((ps: any) => ps.specialty?.is_dental === true);
    } catch (error) {
      console.error('Error checking dental specialty:', error);
      return false;
    }
  };

  const getSpecialtyById = (id: string): Specialty | undefined => {
    return specialties.find((s) => s.id === id);
  };

  const getRegistrationPrefix = (specialtyIds: string[]): string | null => {
    for (const id of specialtyIds) {
      const specialty = getSpecialtyById(id);
      if (specialty?.registration_prefix) {
        return specialty.registration_prefix;
      }
    }
    return null;
  };

  return {
    specialties,
    loading,
    getSpecialtiesByCategory,
    fetchProfessionalSpecialties,
    saveProfessionalSpecialties,
    hasDentalSpecialty,
    getSpecialtyById,
    getRegistrationPrefix,
    categoryLabels: CATEGORY_LABELS,
  };
}
