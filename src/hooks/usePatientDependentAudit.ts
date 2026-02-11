import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DependentAuditItem {
  id: string;
  clinic_id: string;
  patient_id: string;
  dependent_id: string;
  dependent_name: string;
  dependent_cpf: string | null;
  dependent_relationship: string;
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewer_name?: string;
  reviewed_at: string | null;
  created_at: string;
  requester_phone: string | null;
  cpf_photo_url: string | null;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  'child': 'Filho(a)',
  'spouse': 'Cônjuge',
  'parent': 'Pai/Mãe',
  'sibling': 'Irmão(ã)',
  'other': 'Outro',
  'filho(a)': 'Filho(a)',
  'cônjuge': 'Cônjuge',
  'pai/mãe': 'Pai/Mãe',
  'irmão(ã)': 'Irmão(ã)',
  'outro': 'Outro',
};

export function translateRelationship(rel: string): string {
  return RELATIONSHIP_LABELS[rel?.toLowerCase().trim()] || rel;
}

export function usePatientDependentAudit(clinicId: string | undefined, patientId: string | undefined) {
  const { data: auditItems, isLoading, refetch } = useQuery({
    queryKey: ['patient-dependent-audit', clinicId, patientId],
    queryFn: async () => {
      if (!clinicId || !patientId) return [];

      const { data: approvals, error } = await supabase
        .from('pending_dependent_approvals')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!approvals || approvals.length === 0) return [];

      // Get dependent details
      const dependentIds = [...new Set(approvals.map(a => a.dependent_id))];
      const { data: dependents } = await supabase
        .from('patient_dependents')
        .select('id, name, cpf, relationship')
        .in('id', dependentIds);

      const depMap = new Map(dependents?.map(d => [d.id, d]) || []);

      // Get reviewer names
      const reviewerIds = [...new Set(approvals.map(a => a.reviewed_by).filter(Boolean))] as string[];
      let reviewerNames: Record<string, string> = {};
      if (reviewerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', reviewerIds);
        reviewerNames = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = p.name;
          return acc;
        }, {} as Record<string, string>);
      }

      return approvals.map((a): DependentAuditItem => {
        const dep = depMap.get(a.dependent_id);
        return {
          id: a.id,
          clinic_id: a.clinic_id,
          patient_id: a.patient_id,
          dependent_id: a.dependent_id,
          dependent_name: dep?.name || 'Desconhecido',
          dependent_cpf: dep?.cpf || null,
          dependent_relationship: dep?.relationship || '',
          status: a.status,
          rejection_reason: a.rejection_reason,
          reviewed_by: a.reviewed_by,
          reviewer_name: a.reviewed_by ? reviewerNames[a.reviewed_by] || 'Usuário' : undefined,
          reviewed_at: a.reviewed_at,
          created_at: a.created_at,
          requester_phone: a.requester_phone,
          cpf_photo_url: a.cpf_photo_url,
        };
      });
    },
    enabled: !!clinicId && !!patientId,
  });

  return { auditItems, isLoading, refetch };
}
