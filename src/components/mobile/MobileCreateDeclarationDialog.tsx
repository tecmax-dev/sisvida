import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { addDays, format, parseISO, isPast } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Gift,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface Benefit {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  partner_name: string | null;
  validity_days: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  clinicId: string;
  onSuccess?: () => void;
}

export function MobileCreateDeclarationDialog({
  open,
  onOpenChange,
  patientId,
  clinicId,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBenefit, setSelectedBenefit] = useState<Benefit | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedBenefit(null);
    }
  }, [open]);

  // Fetch available benefits
  const { data: benefits = [], isLoading: loadingBenefits } = useQuery({
    queryKey: ["mobile-benefits", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_benefits")
        .select("id, name, description, category, partner_name, validity_days")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Benefit[];
    },
    enabled: !!clinicId && open,
  });

  // Fetch existing active authorizations to check for duplicates
  const { data: existingAuthorizations = [] } = useQuery({
    queryKey: ["mobile-active-authorizations", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_authorizations")
        .select("id, benefit_id, valid_until, status")
        .eq("patient_id", patientId)
        .neq("status", "revoked");

      if (error) throw error;
      
      // Filter to only active ones (not expired)
      return (data || []).filter(auth => {
        const validUntil = parseISO(auth.valid_until);
        return !isPast(validUntil);
      });
    },
    enabled: !!patientId && open,
  });

  // Check if patient has an active (non-expired) card
  const { data: activeCard, isLoading: loadingCard } = useQuery({
    queryKey: ["mobile-patient-card", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_cards")
        .select("id, card_number, expires_at, is_active")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!patientId && open,
  });

  // Determine if card is expired using midday normalization to avoid timezone issues
  // (memory: timezone-safe-date-parsing-system-wide-v2)
  const isCardExpired = !activeCard || (activeCard.expires_at && (() => {
    const expiryDate = parseISO(activeCard.expires_at);
    expiryDate.setHours(12, 0, 0, 0);
    const todayMidDay = new Date();
    todayMidDay.setHours(12, 0, 0, 0);
    return expiryDate < todayMidDay;
  })());

  // Check if a benefit already has an active authorization
  const hasActiveAuthorization = (benefitId: string) => {
    return existingAuthorizations.some(auth => auth.benefit_id === benefitId);
  };

  // Get union entity
  const { data: unionEntity } = useQuery({
    queryKey: ["mobile-union-entity", clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from("union_entities")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("status", "ativa")
        .single();
      return data;
    },
    enabled: !!clinicId && open,
  });

  const createMutation = useMutation({
    mutationFn: async (benefit: Benefit) => {
      // Double-check for duplicates
      const { data: existing } = await supabase
        .from("union_authorizations")
        .select("id, valid_until, status")
        .eq("patient_id", patientId)
        .eq("benefit_id", benefit.id)
        .neq("status", "revoked");

      const activeExists = (existing || []).some(auth => {
        const validUntil = parseISO(auth.valid_until);
        return !isPast(validUntil);
      });

      if (activeExists) {
        throw new Error("Você já possui uma declaração ativa para este benefício.");
      }

      // Generate authorization number and hash
      const { data: authNumber } = await supabase.rpc("generate_authorization_number", {
        p_clinic_id: clinicId,
      });
      const { data: hash } = await supabase.rpc("generate_authorization_hash");

      const validFrom = new Date();
      const validUntil = addDays(validFrom, benefit.validity_days);

      const payload = {
        clinic_id: clinicId,
        patient_id: patientId,
        benefit_id: benefit.id,
        is_for_dependent: false,
        dependent_id: null,
        authorization_number: authNumber,
        validation_hash: hash,
        valid_from: format(validFrom, "yyyy-MM-dd"),
        valid_until: format(validUntil, "yyyy-MM-dd"),
        notes: `Declaração gerada pelo próprio associado via app`,
        created_by: patientId,
        union_entity_id: unionEntity?.id || null,
      };

      const { error } = await supabase
        .from("union_authorizations")
        .insert(payload);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-authorizations"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-active-authorizations"] });
      queryClient.invalidateQueries({ queryKey: ["mobile-patient-authorizations"] });
      toast({
        title: "Declaração gerada!",
        description: "Sua nova declaração foi emitida com sucesso.",
      });
      setConfirmDialogOpen(false);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar declaração",
        description: error.message,
        variant: "destructive",
      });
      setConfirmDialogOpen(false);
    },
  });

  const handleSelectBenefit = (benefit: Benefit) => {
    if (hasActiveAuthorization(benefit.id)) {
      toast({
        title: "Declaração já existe",
        description: "Você já possui uma declaração ativa para este benefício.",
        variant: "destructive",
      });
      return;
    }
    setSelectedBenefit(benefit);
    setConfirmDialogOpen(true);
  };

  const handleConfirm = () => {
    if (selectedBenefit) {
      createMutation.mutate(selectedBenefit);
    }
  };

  const isLoading = loadingBenefits || loadingCard;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md mx-4 max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-emerald-600" />
              Nova Declaração
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : isCardExpired ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
              <h4 className="font-semibold text-red-700 mb-1">
                Carteirinha Vencida
              </h4>
              <p className="text-sm text-red-600">
                Sua carteirinha está vencida ou inativa. Não é possível emitir novas declarações.
              </p>
              <p className="text-xs text-red-500 mt-2">
                Entre em contato com o sindicato para renovar sua carteirinha.
              </p>
            </div>
          ) : benefits.length === 0 ? (
            <div className="text-center py-8">
              <Gift className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Nenhum benefício disponível no momento.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Selecione o benefício para gerar uma nova declaração.
              </p>

              <ScrollArea className="flex-1 -mx-6 px-6 max-h-[50vh]">
                <div className="space-y-3 pb-4">
                  {benefits.map((benefit) => {
                    const isDisabled = hasActiveAuthorization(benefit.id);
                    
                    return (
                      <Card
                        key={benefit.id}
                        className={`border transition-all ${
                          isDisabled
                            ? "bg-gray-50 opacity-60 cursor-not-allowed"
                            : "bg-white hover:shadow-md cursor-pointer active:scale-[0.98]"
                        }`}
                        onClick={() => !isDisabled && handleSelectBenefit(benefit)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {isDisabled && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-amber-100 text-amber-700"
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Já possui
                                  </Badge>
                                )}
                                {benefit.category && (
                                  <Badge variant="outline" className="text-xs">
                                    {benefit.category}
                                  </Badge>
                                )}
                              </div>

                              <h4 className="font-semibold text-sm text-gray-900">
                                {benefit.name}
                              </h4>

                              {benefit.partner_name && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Parceiro: {benefit.partner_name}
                                </p>
                              )}

                              {benefit.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                  {benefit.description}
                                </p>
                              )}

                              <p className="text-xs text-emerald-600 mt-2">
                                Validade: {benefit.validity_days} dias
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}

          <div className="pt-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar Emissão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              Você está prestes a gerar uma declaração para:
              <br />
              <strong className="text-gray-900">{selectedBenefit?.name}</strong>
              <br />
              <br />
              Esta declaração terá validade de{" "}
              <strong>{selectedBenefit?.validity_days} dias</strong>.
              <br />
              <br />
              <span className="text-amber-600 text-xs">
                ⚠️ Não será possível emitir outra declaração para este benefício
                enquanto esta estiver ativa.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={createMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={createMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
