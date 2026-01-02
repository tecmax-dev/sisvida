import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface SubscriptionAddon {
  id: string;
  name: string;
  key: string;
  description: string | null;
  monthly_price: number;
  features: string[];
  is_active: boolean;
  order_index: number;
}

export interface ClinicAddon {
  id: string;
  clinic_id: string;
  addon_id: string;
  status: 'active' | 'suspended' | 'cancelled';
  activated_at: string;
  activated_by: string | null;
  suspended_at: string | null;
  notes: string | null;
  addon?: SubscriptionAddon;
}

export interface AddonRequest {
  id: string;
  clinic_id: string;
  addon_id: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected';
  request_reason: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  addon?: SubscriptionAddon;
  clinic?: { name: string };
}

export function useClinicAddons(clinicId?: string) {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const effectiveClinicId = clinicId || currentClinic?.id;

  // Fetch all available add-ons
  const { data: availableAddons, isLoading: loadingAddons } = useQuery({
    queryKey: ['subscription-addons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_addons')
        .select('*')
        .eq('is_active', true)
        .order('order_index');
      
      if (error) throw error;
      return data as SubscriptionAddon[];
    },
  });

  // Fetch clinic's active add-ons
  const { data: clinicAddons, isLoading: loadingClinicAddons } = useQuery({
    queryKey: ['clinic-addons', effectiveClinicId],
    queryFn: async () => {
      if (!effectiveClinicId) return [];
      
      const { data, error } = await supabase
        .from('clinic_addons')
        .select(`
          *,
          addon:subscription_addons(*)
        `)
        .eq('clinic_id', effectiveClinicId)
        .eq('status', 'active');
      
      if (error) throw error;
      return data as ClinicAddon[];
    },
    enabled: !!effectiveClinicId,
  });

  // Fetch pending requests for the clinic
  const { data: pendingRequests, isLoading: loadingRequests } = useQuery({
    queryKey: ['addon-requests', effectiveClinicId],
    queryFn: async () => {
      if (!effectiveClinicId) return [];
      
      const { data, error } = await supabase
        .from('addon_requests')
        .select(`
          *,
          addon:subscription_addons(*)
        `)
        .eq('clinic_id', effectiveClinicId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AddonRequest[];
    },
    enabled: !!effectiveClinicId,
  });

  // Check if clinic has a specific addon
  const hasAddon = (addonKey: string): boolean => {
    return clinicAddons?.some(
      ca => ca.addon?.key === addonKey && ca.status === 'active'
    ) ?? false;
  };

  // Request an add-on
  const requestAddonMutation = useMutation({
    mutationFn: async ({ addonId, reason }: { addonId: string; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !effectiveClinicId) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('addon_requests')
        .insert({
          clinic_id: effectiveClinicId,
          addon_id: addonId,
          requested_by: user.id,
          request_reason: reason || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addon-requests'] });
      toast({
        title: "Solicitação enviada",
        description: "Sua solicitação será analisada pelo administrador.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao solicitar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    availableAddons,
    clinicAddons,
    pendingRequests,
    hasAddon,
    requestAddon: requestAddonMutation.mutate,
    isRequesting: requestAddonMutation.isPending,
    isLoading: loadingAddons || loadingClinicAddons || loadingRequests,
  };
}

// Hook for super admin to manage all addon requests
export function useAddonRequestsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all pending requests (for super admin)
  const { data: allRequests, isLoading } = useQuery({
    queryKey: ['all-addon-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('addon_requests')
        .select(`
          *,
          addon:subscription_addons(*),
          clinic:clinics(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AddonRequest[];
    },
  });

  const pendingCount = allRequests?.filter(r => r.status === 'pending').length ?? 0;

  // Approve request
  const approveMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Get the request
      const { data: request, error: reqError } = await supabase
        .from('addon_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (reqError || !request) throw new Error('Solicitação não encontrada');

      // Update request status
      const { error: updateError } = await supabase
        .from('addon_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          admin_notes: notes || null,
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Create clinic addon
      const { error: addonError } = await supabase
        .from('clinic_addons')
        .upsert({
          clinic_id: request.clinic_id,
          addon_id: request.addon_id,
          status: 'active',
          activated_by: user.id,
          activated_at: new Date().toISOString(),
          notes: notes || null,
        }, { onConflict: 'clinic_id,addon_id' });

      if (addonError) throw addonError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-addon-requests'] });
      queryClient.invalidateQueries({ queryKey: ['clinic-addons'] });
      toast({
        title: "Solicitação aprovada",
        description: "O add-on foi ativado para a clínica.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao aprovar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject request
  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('addon_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          admin_notes: notes || null,
        })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-addon-requests'] });
      toast({
        title: "Solicitação rejeitada",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao rejeitar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Activate addon directly (without request)
  const activateAddonMutation = useMutation({
    mutationFn: async ({ clinicId, addonId, notes }: { clinicId: string; addonId: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('clinic_addons')
        .upsert({
          clinic_id: clinicId,
          addon_id: addonId,
          status: 'active',
          activated_by: user.id,
          activated_at: new Date().toISOString(),
          notes: notes || null,
        }, { onConflict: 'clinic_id,addon_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-addons'] });
      toast({
        title: "Add-on ativado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao ativar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Deactivate addon
  const deactivateAddonMutation = useMutation({
    mutationFn: async ({ clinicId, addonId }: { clinicId: string; addonId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('clinic_addons')
        .update({
          status: 'suspended',
          suspended_at: new Date().toISOString(),
          suspended_by: user.id,
        })
        .eq('clinic_id', clinicId)
        .eq('addon_id', addonId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-addons'] });
      toast({
        title: "Add-on desativado",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao desativar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    allRequests,
    pendingCount,
    isLoading,
    approveRequest: approveMutation.mutate,
    rejectRequest: rejectMutation.mutate,
    activateAddon: activateAddonMutation.mutate,
    deactivateAddon: deactivateAddonMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isActivating: activateAddonMutation.isPending,
    isDeactivating: deactivateAddonMutation.isPending,
  };
}