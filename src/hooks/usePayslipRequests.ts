import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PayslipRequest {
  id: string;
  clinic_id: string;
  patient_id: string;
  card_id: string | null;
  status: 'pending' | 'received' | 'approved' | 'rejected';
  attachment_path: string | null;
  notes: string | null;
  requested_at: string;
  received_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  patients?: {
    id: string;
    name: string;
    phone: string;
    cpf: string | null;
  };
  patient_cards?: {
    id: string;
    card_number: string;
    expires_at: string;
  } | null;
}

export function usePayslipRequests(clinicId: string | undefined, patientId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ['payslip-requests', clinicId, patientId],
    queryFn: async () => {
      if (!clinicId) return [];

      let query = supabase
        .from('payslip_requests')
        .select(`
          *,
          patients!payslip_requests_patient_id_fkey(id, name, phone, cpf),
          patient_cards!payslip_requests_card_id_fkey(id, card_number, expires_at)
        `)
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });

      if (patientId) {
        query = query.eq('patient_id', patientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as PayslipRequest[];
    },
    enabled: !!clinicId,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      status, 
      notes,
      newExpiresAt 
    }: { 
      requestId: string; 
      status: 'approved' | 'rejected'; 
      notes?: string;
      newExpiresAt?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update payslip request
      const { error: requestError } = await supabase
        .from('payslip_requests')
        .update({
          status,
          notes,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', requestId);

      if (requestError) throw requestError;

      // If approved and has new expiry date, update the card
      if (status === 'approved' && newExpiresAt) {
        // Get the request to find the card_id
        const { data: request } = await supabase
          .from('payslip_requests')
          .select('card_id')
          .eq('id', requestId)
          .single();

        if (request?.card_id) {
          const { error: cardError } = await supabase
            .from('patient_cards')
            .update({ expires_at: newExpiresAt })
            .eq('id', request.card_id);

          if (cardError) throw cardError;
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payslip-requests'] });
      queryClient.invalidateQueries({ queryKey: ['patient-cards'] });
      toast({
        title: variables.status === 'approved' ? 'Contracheque aprovado' : 'Contracheque rejeitado',
        description: variables.status === 'approved' 
          ? 'A carteirinha foi renovada com sucesso.' 
          : 'O contracheque foi marcado como rejeitado.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao processar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getAttachmentUrl = async (path: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('contra-cheques')
        .createSignedUrl(path, 3600); // 1 hour

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error getting attachment URL:', error);
      return null;
    }
  };

  return {
    requests,
    isLoading,
    refetch,
    reviewRequest: reviewMutation.mutate,
    isReviewing: reviewMutation.isPending,
    getAttachmentUrl,
  };
}
