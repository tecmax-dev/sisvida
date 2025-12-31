import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PatientCard {
  id: string;
  clinic_id: string;
  patient_id: string;
  card_number: string;
  qr_code_token: string;
  issued_at: string;
  expires_at: string;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  patient?: {
    name: string;
    phone: string;
    cpf: string | null;
    insurance_plan_id: string | null;
    insurance_plan?: {
      name: string;
    } | null;
  };
}

export interface CardValidity {
  is_valid: boolean;
  card_number: string | null;
  expires_at: string | null;
  days_until_expiry: number | null;
}

export function usePatientCards(clinicId: string | undefined, patientId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cards, isLoading, refetch } = useQuery({
    queryKey: ['patient-cards', clinicId, patientId],
    queryFn: async () => {
      if (!clinicId) return [];
      
      let query = supabase
        .from('patient_cards')
        .select(`
          *,
          patient:patients(name, phone, cpf, insurance_plan_id)
        `)
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });
      
      if (patientId) {
        query = query.eq('patient_id', patientId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Buscar nomes dos convênios separadamente
      const cardsWithInsurance = await Promise.all(
        (data || []).map(async (card: any) => {
          if (card.patient?.insurance_plan_id) {
            const { data: planData } = await supabase
              .from('insurance_plans')
              .select('name')
              .eq('id', card.patient.insurance_plan_id)
              .single();
            
            return {
              ...card,
              patient: {
                ...card.patient,
                insurance_plan: planData
              }
            };
          }
          return card;
        })
      );
      
      return cardsWithInsurance as PatientCard[];
    },
    enabled: !!clinicId,
  });

  const checkCardValidity = async (patientId: string, clinicId: string): Promise<CardValidity | null> => {
    const { data, error } = await supabase
      .rpc('is_patient_card_valid', {
        p_patient_id: patientId,
        p_clinic_id: clinicId,
      });
    
    if (error) {
      console.error('Error checking card validity:', error);
      return null;
    }
    
    return data?.[0] || null;
  };

  const generateCardNumber = async (clinicId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .rpc('generate_card_number', {
        p_clinic_id: clinicId,
      });
    
    if (error) {
      console.error('Error generating card number:', error);
      return null;
    }
    
    return data;
  };

  const createCardMutation = useMutation({
    mutationFn: async (cardData: {
      patient_id: string;
      expires_at: string;
      notes?: string;
    }) => {
      if (!clinicId) throw new Error('Clinic not selected');
      
      const cardNumber = await generateCardNumber(clinicId);
      if (!cardNumber) throw new Error('Failed to generate card number');
      
      const { data, error } = await supabase
        .from('patient_cards')
        .insert({
          clinic_id: clinicId,
          patient_id: cardData.patient_id,
          card_number: cardNumber,
          expires_at: cardData.expires_at,
          notes: cardData.notes || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-cards'] });
      toast({
        title: 'Carteirinha emitida',
        description: 'A carteirinha digital foi emitida com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao emitir carteirinha',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const renewCardMutation = useMutation({
    mutationFn: async ({ cardId, newExpiresAt }: { cardId: string; newExpiresAt: string }) => {
      const { data, error } = await supabase
        .from('patient_cards')
        .update({
          expires_at: newExpiresAt,
          is_active: true,
        })
        .eq('id', cardId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-cards'] });
      toast({
        title: 'Carteirinha renovada',
        description: 'A validade foi atualizada com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao renovar carteirinha',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deactivateCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const { error } = await supabase
        .from('patient_cards')
        .update({ is_active: false })
        .eq('id', cardId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-cards'] });
      toast({
        title: 'Carteirinha desativada',
        description: 'A carteirinha foi desativada.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao desativar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    cards,
    isLoading,
    refetch,
    checkCardValidity,
    createCard: createCardMutation.mutate,
    renewCard: renewCardMutation.mutate,
    deactivateCard: deactivateCardMutation.mutate,
    isCreating: createCardMutation.isPending,
    isRenewing: renewCardMutation.isPending,
  };
}
