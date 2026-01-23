import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PatientPayslipHistoryItem {
  id: string;
  clinic_id: string;
  patient_id: string;
  payslip_request_id: string | null;
  card_id: string | null;
  attachment_path: string;
  attachment_url: string | null;
  validation_status: 'approved' | 'rejected';
  validation_notes: string | null;
  validated_at: string;
  validated_by: string | null;
  previous_card_expiry: string | null;
  new_card_expiry: string | null;
  created_at: string;
  updated_at: string;
  validator_name?: string;
}

export function usePatientPayslipHistory(clinicId: string | undefined, patientId: string | undefined) {
  const { data: history, isLoading, refetch } = useQuery({
    queryKey: ['patient-payslip-history', clinicId, patientId],
    queryFn: async () => {
      if (!clinicId || !patientId) return [];

      const { data, error } = await supabase
        .from('patient_payslip_history')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .order('validated_at', { ascending: false });

      if (error) throw error;

      // Fetch validator names
      const validatorIds = [...new Set((data || []).map(h => h.validated_by).filter(Boolean))];
      let validatorNames: Record<string, string> = {};

      if (validatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', validatorIds);

        validatorNames = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = p.name;
          return acc;
        }, {} as Record<string, string>);
      }

      return (data || []).map(item => ({
        ...item,
        validator_name: item.validated_by ? validatorNames[item.validated_by] || 'Usuário' : undefined
      })) as PatientPayslipHistoryItem[];
    },
    enabled: !!clinicId && !!patientId,
  });

  const getAttachmentUrl = async (path: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('contra-cheques')
        .createSignedUrl(path, 3600);

      if (error) throw error;
      return data?.signedUrl || null;
    } catch (error) {
      console.error('Error getting attachment URL:', error);
      return null;
    }
  };

  return {
    history,
    isLoading,
    refetch,
    getAttachmentUrl,
  };
}

// Function to save payslip history when reviewing
export async function savePayslipHistory({
  clinicId,
  patientId,
  payslipRequestId,
  cardId,
  attachmentPath,
  validationStatus,
  validationNotes,
  previousCardExpiry,
  newCardExpiry,
}: {
  clinicId: string;
  patientId: string;
  payslipRequestId: string;
  cardId: string | null;
  attachmentPath: string;
  validationStatus: 'approved' | 'rejected';
  validationNotes?: string;
  previousCardExpiry?: string | null;
  newCardExpiry?: string | null;
}): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('patient_payslip_history')
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        payslip_request_id: payslipRequestId,
        card_id: cardId,
        attachment_path: attachmentPath,
        validation_status: validationStatus,
        validation_notes: validationNotes || null,
        validated_by: user?.id,
        previous_card_expiry: previousCardExpiry || null,
        new_card_expiry: newCardExpiry || null,
      });

    if (error) {
      console.error('Error saving payslip history:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving payslip history:', error);
    return false;
  }
}
