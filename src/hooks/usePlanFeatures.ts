import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";

export interface SystemFeature {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  is_active: boolean;
}

interface UsePlanFeaturesReturn {
  hasFeature: (featureKey: string) => boolean;
  availableFeatures: SystemFeature[];
  allFeatures: SystemFeature[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export function usePlanFeatures(): UsePlanFeaturesReturn {
  const { subscription, loading: subLoading } = useSubscription();
  const [planFeatureKeys, setPlanFeatureKeys] = useState<string[]>([]);
  const [allFeatures, setAllFeatures] = useState<SystemFeature[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeatures = useCallback(async () => {
    if (!subscription?.plan_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch all system features
      const { data: featuresData, error: featuresError } = await supabase
        .from('system_features')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (featuresError) throw featuresError;
      setAllFeatures(featuresData || []);

      // Fetch features linked to current plan
      const { data: planFeaturesData, error: planFeaturesError } = await supabase
        .from('plan_features')
        .select('feature_id, system_features(key)')
        .eq('plan_id', subscription.plan_id);

      if (planFeaturesError) throw planFeaturesError;

      const keys = (planFeaturesData || [])
        .map((pf: any) => pf.system_features?.key)
        .filter(Boolean);

      setPlanFeatureKeys(keys);
    } catch (error) {
      console.error("Error fetching plan features:", error);
    } finally {
      setLoading(false);
    }
  }, [subscription?.plan_id]);

  useEffect(() => {
    if (!subLoading) {
      fetchFeatures();
    }
  }, [subLoading, fetchFeatures]);

  const hasFeature = useCallback((featureKey: string): boolean => {
    // If no subscription, assume no features
    if (!subscription) return false;
    return planFeatureKeys.includes(featureKey);
  }, [subscription, planFeatureKeys]);

  const availableFeatures = allFeatures.filter(f => planFeatureKeys.includes(f.key));

  return {
    hasFeature,
    availableFeatures,
    allFeatures,
    loading: loading || subLoading,
    refetch: fetchFeatures,
  };
}

// Hook para buscar todos os recursos do sistema (para admin)
export function useSystemFeatures() {
  const [features, setFeatures] = useState<SystemFeature[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeatures = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_features')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setFeatures(data || []);
    } catch (error) {
      console.error("Error fetching system features:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  return { features, loading, refetch: fetchFeatures };
}

// Hook para buscar features de um plano específico
export function usePlanLinkedFeatures(planId: string | null) {
  const [linkedFeatureIds, setLinkedFeatureIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLinkedFeatures = useCallback(async () => {
    if (!planId) {
      setLinkedFeatureIds([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plan_features')
        .select('feature_id')
        .eq('plan_id', planId);

      if (error) throw error;
      setLinkedFeatureIds((data || []).map(pf => pf.feature_id));
    } catch (error) {
      console.error("Error fetching linked features:", error);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    fetchLinkedFeatures();
  }, [fetchLinkedFeatures]);

  return { linkedFeatureIds, loading, refetch: fetchLinkedFeatures };
}
