import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  max_professionals: number;
  max_messages_monthly: number;
  monthly_price: number;
  features: string[];
  is_public: boolean;
  is_active: boolean;
}

interface Subscription {
  id: string;
  clinic_id: string;
  plan_id: string;
  status: 'trial' | 'active' | 'past_due' | 'suspended' | 'canceled';
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  plan: SubscriptionPlan;
}

interface MessageUsage {
  used: number;
  max_allowed: number;
  remaining: number;
}

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  professionalCount: number;
  canAddProfessional: boolean;
  isAtLimit: boolean;
  remainingSlots: number;
  messageUsage: MessageUsage | null;
  refetch: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const { currentClinic } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [professionalCount, setProfessionalCount] = useState(0);
  const [messageUsage, setMessageUsage] = useState<MessageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = async () => {
    if (!currentClinic) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch subscription with plan
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          id,
          clinic_id,
          plan_id,
          status,
          trial_ends_at,
          current_period_start,
          current_period_end,
          plan:subscription_plans (
            id,
            name,
            description,
            max_professionals,
            max_messages_monthly,
            monthly_price,
            features,
            is_public,
            is_active
          )
        `)
        .eq('clinic_id', currentClinic.id)
        .maybeSingle();

      if (subError) throw subError;

      // Fetch professional count
      const { count, error: countError } = await supabase
        .from('professionals')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true);

      if (countError) throw countError;

      setProfessionalCount(count || 0);

      // Fetch message usage
      const monthYear = new Date().toISOString().slice(0, 7);
      const { data: usageData, error: usageError } = await supabase.rpc(
        'get_clinic_message_usage',
        { _clinic_id: currentClinic.id, _month_year: monthYear }
      );

      if (usageError) {
        console.error("Error fetching message usage:", usageError);
      } else if (usageData && usageData.length > 0) {
        setMessageUsage(usageData[0] as MessageUsage);
      } else {
        setMessageUsage(null);
      }

      if (subData && subData.plan) {
        const plan = Array.isArray(subData.plan) ? subData.plan[0] : subData.plan;
        setSubscription({
          ...subData,
          plan: {
            ...plan,
            features: Array.isArray(plan.features) ? plan.features : [],
            max_messages_monthly: plan.max_messages_monthly ?? 100
          }
        } as Subscription);
      } else {
        setSubscription(null);
      }
    } catch (err: any) {
      console.error("Error fetching subscription:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [currentClinic?.id]);

  const maxProfessionals = subscription?.plan?.max_professionals || 999;
  const isAtLimit = professionalCount >= maxProfessionals;
  const canAddProfessional = !isAtLimit && 
    (!subscription || ['trial', 'active'].includes(subscription.status));
  const remainingSlots = Math.max(0, maxProfessionals - professionalCount);

  return {
    subscription,
    loading,
    error,
    professionalCount,
    canAddProfessional,
    isAtLimit,
    remainingSlots,
    messageUsage,
    refetch: fetchSubscription,
  };
}

// Hook para buscar planos disponíveis
export function useAvailablePlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .eq('is_public', true)
          .order('monthly_price', { ascending: true });

        if (error) throw error;
        
        setPlans((data || []).map(p => ({
          ...p,
          features: Array.isArray(p.features) 
            ? (p.features as unknown[]).map(f => String(f))
            : []
        })));
      } catch (err) {
        console.error("Error fetching plans:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  return { plans, loading };
}
