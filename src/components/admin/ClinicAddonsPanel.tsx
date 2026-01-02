import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, MessageSquare, Plug, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ClinicAddonsPanelProps {
  clinicId: string;
  clinicName: string;
}

interface SubscriptionAddon {
  id: string;
  name: string;
  key: string;
  description: string | null;
  monthly_price: number;
  features: string[];
  is_active: boolean;
}

interface ClinicAddon {
  id: string;
  addon_id: string;
  status: string;
  activated_at: string;
}

const addonIcons: Record<string, any> = {
  whatsapp_advanced: MessageSquare,
  api_access: Plug,
};

export function ClinicAddonsPanel({ clinicId, clinicName }: ClinicAddonsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadingAddon, setLoadingAddon] = useState<string | null>(null);

  // Fetch available addons
  const { data: availableAddons, isLoading: loadingAvailable } = useQuery({
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

  // Fetch clinic's addons
  const { data: clinicAddons, isLoading: loadingClinic } = useQuery({
    queryKey: ['clinic-addons', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_addons')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('status', 'active');
      
      if (error) throw error;
      return data as ClinicAddon[];
    },
  });

  const isAddonActive = (addonId: string) => {
    return clinicAddons?.some(ca => ca.addon_id === addonId) ?? false;
  };

  const toggleAddon = async (addonId: string, currentlyActive: boolean) => {
    setLoadingAddon(addonId);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      if (currentlyActive) {
        // Deactivate
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
        
        toast({ title: "Add-on desativado" });
      } else {
        // Activate
        const { error } = await supabase
          .from('clinic_addons')
          .upsert({
            clinic_id: clinicId,
            addon_id: addonId,
            status: 'active',
            activated_by: user.id,
            activated_at: new Date().toISOString(),
          }, { onConflict: 'clinic_id,addon_id' });

        if (error) throw error;
        
        toast({ title: "Add-on ativado" });
      }

      queryClient.invalidateQueries({ queryKey: ['clinic-addons', clinicId] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingAddon(null);
    }
  };

  if (loadingAvailable || loadingClinic) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">Add-ons Contratados</h4>
      
      {availableAddons?.map((addon) => {
        const Icon = addonIcons[addon.key] || Plug;
        const isActive = isAddonActive(addon.id);
        const isLoading = loadingAddon === addon.id;

        return (
          <Card 
            key={addon.id} 
            className={cn(
              "transition-all",
              isActive ? "border-primary/50 bg-primary/5" : "border-border"
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                    isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{addon.name}</p>
                      {isActive && (
                        <Badge variant="default" className="text-xs bg-success">
                          <Check className="h-3 w-3 mr-1" />
                          Ativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {addon.description}
                    </p>
                    <p className="text-sm font-medium text-primary mt-1">
                      R$ {addon.monthly_price.toFixed(2)}/mês
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Switch
                      checked={isActive}
                      onCheckedChange={() => toggleAddon(addon.id, isActive)}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {(!availableAddons || availableAddons.length === 0) && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum add-on disponível
        </p>
      )}
    </div>
  );
}