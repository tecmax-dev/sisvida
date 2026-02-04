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
  // Flag to indicate if this came from payslip_requests fallback
  source?: 'history' | 'requests';
}

export function usePatientPayslipHistory(clinicId: string | undefined, patientId: string | undefined) {
  const { data: history, isLoading, refetch } = useQuery({
    queryKey: ['patient-payslip-history', clinicId, patientId],
    queryFn: async () => {
      if (!clinicId || !patientId) return [];

      // Fetch from patient_payslip_history
      const { data: historyData, error: historyError } = await supabase
        .from('patient_payslip_history')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .order('validated_at', { ascending: false });

      if (historyError) throw historyError;

      // Get IDs of requests that already have history records
      const existingRequestIds = new Set(
        (historyData || [])
          .map(h => h.payslip_request_id)
          .filter(Boolean)
      );

      // Fetch approved/rejected payslip_requests that DON'T have a history record
      const { data: requestsData, error: requestsError } = await supabase
        .from('payslip_requests')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .in('status', ['approved', 'rejected'])
        .order('reviewed_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Filter out requests that already have history records
      const orphanedRequests = (requestsData || []).filter(
        r => !existingRequestIds.has(r.id)
      );

      // Collect all validator IDs for name lookup
      const validatorIds = [
        ...new Set([
          ...(historyData || []).map(h => h.validated_by).filter(Boolean),
          ...(orphanedRequests || []).map(r => r.reviewed_by).filter(Boolean),
        ])
      ];

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

      // Map history items
      const historyItems: PatientPayslipHistoryItem[] = (historyData || []).map(item => ({
        ...item,
        validation_status: item.validation_status as 'approved' | 'rejected',
        validator_name: item.validated_by ? validatorNames[item.validated_by] || 'Usuário' : undefined,
        source: 'history' as const,
      }));

      // Map orphaned requests to history format
      const requestItems: PatientPayslipHistoryItem[] = orphanedRequests.map(req => ({
        id: req.id,
        clinic_id: req.clinic_id,
        patient_id: req.patient_id,
        payslip_request_id: req.id,
        card_id: null,
        attachment_path: req.attachment_path || '',
        attachment_url: null,
        validation_status: req.status as 'approved' | 'rejected',
        validation_notes: req.notes || null,
        validated_at: req.reviewed_at || req.created_at,
        validated_by: req.reviewed_by || null,
        previous_card_expiry: null,
        new_card_expiry: null,
        created_at: req.created_at,
        updated_at: req.updated_at || req.created_at,
        validator_name: req.reviewed_by ? validatorNames[req.reviewed_by] || 'Usuário' : undefined,
        source: 'requests' as const,
      }));

      // Combine and sort by validated_at descending
      const combined = [...historyItems, ...requestItems].sort((a, b) => 
        new Date(b.validated_at).getTime() - new Date(a.validated_at).getTime()
      );

      return combined;
    },
    enabled: !!clinicId && !!patientId,
  });

  const getAttachmentUrl = async (path: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-payslip-signed-url', {
        body: { path },
      });

      if (error) throw error;
      return (data as any)?.signedUrl || null;
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
