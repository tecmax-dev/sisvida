import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthorizationBlockReasons } from "@/lib/authorizationBlockReasons";
import { AuthorizationBlockNotice } from "@/components/union/authorizations/AuthorizationBlockNotice";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  User,
  Users,
} from "lucide-react";

interface Benefit {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  partner_name: string | null;
  validity_days: number;
}

interface Dependent {
  id: string;
  name: string;
  relationship: string;
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
  const [beneficiaryType, setBeneficiaryType] = useState<"titular" | "dependent">("titular");
  const [selectedDependentId, setSelectedDependentId] = useState<string>("");

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedBenefit(null);
      setBeneficiaryType("titular");
      setSelectedDependentId("");
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

  // Fetch patient dependents
  const { data: dependents = [], isLoading: loadingDependents } = useQuery({
    queryKey: ["mobile-patient-dependents", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_dependents")
        .select("id, name, relationship")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Dependent[];
    },
    enabled: !!patientId && open,
  });

  // Fetch existing active authorizations to check for duplicates
  const { data: existingAuthorizations = [] } = useQuery({
    queryKey: ["mobile-active-authorizations", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_authorizations")
        .select("id, benefit_id, valid_until, status, is_for_dependent, dependent_id")
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

  // Check if a benefit already has an active authorization for the selected beneficiary
  const hasActiveAuthorization = (benefitId: string) => {
    return existingAuthorizations.some(auth => {
      if (auth.benefit_id !== benefitId) return false;
      
      // Check based on beneficiary type
      if (beneficiaryType === "titular") {
        return !auth.is_for_dependent;
      } else {
        return auth.is_for_dependent && auth.dependent_id === selectedDependentId;
      }
    });
  };

  // Biolife é exclusivo para titulares — bloquear emissão para dependentes
  const isBiolifeBenefit = (benefit: { name?: string | null; category?: string | null; partner_name?: string | null }) => {
    const haystack = `${benefit.name ?? ""} ${benefit.category ?? ""} ${benefit.partner_name ?? ""}`.toLowerCase();
    return haystack.includes("biolife");
  };

  // Biolife é restrito a associadas do sexo feminino
  const isFemaleGender = (g?: string | null) => {
    if (!g) return false;
    const v = g.trim().toLowerCase();
    return v === "f" || v.startsWith("fem");
  };

  const { data: titularPatient } = useQuery({
    queryKey: ["mobile-patient-gender", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("gender")
        .eq("id", patientId)
        .maybeSingle();
      return data;
    },
    enabled: !!patientId && open,
  });

  const titularIsFemale = isFemaleGender(titularPatient?.gender);

  // IDs dos benefícios Biolife disponíveis nesta entidade
  const biolifeBenefitIds = benefits.filter((b) => isBiolifeBenefit(b)).map((b) => b.id);

  // Última autorização Biolife do beneficiário selecionado (limite: 1 a cada 12 meses por beneficiário)
  const { data: lastBiolifeAuth } = useQuery({
    queryKey: [
      "mobile-last-biolife-authorization",
      patientId,
      beneficiaryType,
      selectedDependentId,
      biolifeBenefitIds.join(","),
    ],
    queryFn: async () => {
      if (!patientId || biolifeBenefitIds.length === 0) return null;
      let query = supabase
        .from("union_authorizations")
        .select("issued_at, benefit_id")
        .in("benefit_id", biolifeBenefitIds)
        .neq("status", "revoked");

      if (beneficiaryType === "dependent") {
        if (!selectedDependentId) return null;
        query = query.eq("dependent_id", selectedDependentId);
      } else {
        query = query.eq("patient_id", patientId).eq("is_for_dependent", false);
      }

      const { data } = await query.order("issued_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
    enabled: !!patientId && biolifeBenefitIds.length > 0 && open,
  });

  const biolifeNextAvailableAt = (() => {
    if (!lastBiolifeAuth?.issued_at) return null;
    const issued = new Date(lastBiolifeAuth.issued_at);
    const next = new Date(issued);
    next.setFullYear(next.getFullYear() + 1);
    return next > new Date() ? next : null;
  })();

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
      const isForDependent = beneficiaryType === "dependent";
      
      // Validate dependent selection
      if (isForDependent && !selectedDependentId) {
        throw new Error("Selecione um dependente.");
      }

      // Double-check for duplicates (considering beneficiary type)
      const { data: existing } = await supabase
        .from("union_authorizations")
        .select("id, valid_until, status, is_for_dependent, dependent_id")
        .eq("patient_id", patientId)
        .eq("benefit_id", benefit.id)
        .neq("status", "revoked");

      const activeExists = (existing || []).some(auth => {
        const validUntil = parseISO(auth.valid_until);
        if (isPast(validUntil)) return false;
        
        // Check if same beneficiary type
        if (isForDependent) {
          return auth.is_for_dependent && auth.dependent_id === selectedDependentId;
        } else {
          return !auth.is_for_dependent;
        }
      });

      if (activeExists) {
        const beneficiaryLabel = isForDependent ? "este dependente" : "você";
        throw new Error(`Já existe uma declaração ativa deste benefício para ${beneficiaryLabel}.`);
      }

      // Generate authorization number and hash
      const { data: authNumber } = await supabase.rpc("generate_authorization_number", {
        p_clinic_id: clinicId,
      });
      const { data: hash } = await supabase.rpc("generate_authorization_hash");

      const validFrom = new Date();
      const validUntil = addDays(validFrom, benefit.validity_days);

      const dependentForPayload = dependents.find(d => d.id === selectedDependentId);
      const beneficiaryName = isForDependent && dependentForPayload 
        ? dependentForPayload.name 
        : "titular";

      const payload = {
        clinic_id: clinicId,
        patient_id: patientId,
        benefit_id: benefit.id,
        is_for_dependent: isForDependent,
        dependent_id: isForDependent ? selectedDependentId : null,
        authorization_number: authNumber,
        validation_hash: hash,
        valid_from: format(validFrom, "yyyy-MM-dd"),
        valid_until: format(validUntil, "yyyy-MM-dd"),
        notes: `Declaração gerada pelo próprio associado via app - Beneficiário: ${beneficiaryName}`,
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
        title: "Não foi possível gerar a declaração",
        description: "Ocorreu um erro inesperado. Tente novamente mais tarde.",
        variant: "destructive",
      });
      setConfirmDialogOpen(false);
    },
  });

  const handleSelectBenefit = (benefit: Benefit) => {
    // Bloqueios (carteirinha / regras Biolife) com motivo exato e como regularizar
    const reasons = getAuthorizationBlockReasons({
      isBiolife: isBiolifeBenefit(benefit),
      isForDependent: beneficiaryType === "dependent",
      titularIsFemale,
      biolifeNextAvailableAt: biolifeNextAvailableAt || null,
    });
    if (reasons.length > 0) {
      const r = reasons[0];
      toast({
        title: r.title,
        description: `${r.detail} Como regularizar: ${r.howToFix.join(" ")}`,
        variant: "destructive",
      });
      return;
    }

    // Validate dependent selection if beneficiaryType is "dependent"
    if (beneficiaryType === "dependent" && !selectedDependentId) {
      toast({
        title: "Selecione um dependente",
        description: "Escolha o dependente antes de selecionar o benefício.",
        variant: "destructive",
      });
      return;
    }
    
    if (hasActiveAuthorization(benefit.id)) {
      const depFound = dependents.find(d => d.id === selectedDependentId);
      const beneficiaryLabel = beneficiaryType === "dependent" 
        ? `este dependente (${depFound?.name || "selecionado"})`
        : "você (titular)";
      toast({
        title: "Declaração já existe",
        description: `Já existe uma declaração ativa deste benefício para ${beneficiaryLabel}.`,
        variant: "destructive",
      });
      return;
    }
    setSelectedBenefit(benefit);
    setConfirmDialogOpen(true);
  };

  const handleConfirm = () => {
    if (beneficiaryType === "dependent" && !selectedDependentId) {
      toast({
        title: "Selecione um dependente",
        description: "Escolha o dependente para emitir a declaração.",
        variant: "destructive",
      });
      return;
    }
    if (selectedBenefit) {
      createMutation.mutate(selectedBenefit);
    }
  };

  const selectedDependent = dependents.find(d => d.id === selectedDependentId);
  const isLoading = loadingBenefits || loadingCard || loadingDependents;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md mx-4 max-h-[85dvh] h-auto flex flex-col overflow-hidden p-4 sm:p-6">
          <DialogHeader className="shrink-0">
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
            <AuthorizationBlockNotice
              reasons={getAuthorizationBlockReasons({
                cardMissing: !activeCard,
                cardExpiredAt: activeCard?.expires_at ? parseISO(activeCard.expires_at) : null,
              })}
            />
          ) : benefits.length === 0 ? (
            <div className="text-center py-8">
              <Gift className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Nenhum benefício disponível no momento.
              </p>
            </div>
          ) : (
            <>
              {/* Beneficiary Selection */}
              <div className="space-y-3 pb-3 border-b shrink-0">
                <Label className="text-sm font-medium">Para quem é a declaração?</Label>
                <RadioGroup
                  value={beneficiaryType}
                  onValueChange={(value) => {
                    setBeneficiaryType(value as "titular" | "dependent");
                    if (value === "titular") {
                      setSelectedDependentId("");
                    }
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="titular" id="mobile-titular" />
                    <Label htmlFor="mobile-titular" className="flex items-center gap-1.5 cursor-pointer">
                      <User className="h-4 w-4 text-emerald-600" />
                      Titular
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem 
                      value="dependent" 
                      id="mobile-dependent"
                      disabled={dependents.length === 0}
                    />
                    <Label 
                      htmlFor="mobile-dependent" 
                      className={`flex items-center gap-1.5 cursor-pointer ${dependents.length === 0 ? 'opacity-50' : ''}`}
                    >
                      <Users className="h-4 w-4 text-violet-600" />
                      Dependente {dependents.length === 0 && "(nenhum)"}
                    </Label>
                  </div>
                </RadioGroup>

                {/* Dependent Selector */}
                {beneficiaryType === "dependent" && dependents.length > 0 && (
                  <Select value={selectedDependentId} onValueChange={setSelectedDependentId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o dependente" />
                    </SelectTrigger>
                    <SelectContent>
                      {dependents.map((dep) => (
                        <SelectItem key={dep.id} value={dep.id}>
                          {dep.name} ({dep.relationship})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Selecione o benefício para gerar a declaração
                {beneficiaryType === "dependent" && selectedDependent && (
                  <span className="font-medium text-violet-600"> para {selectedDependent.name}</span>
                )}
                .
              </p>

              <div className="flex-1 min-h-0 -mx-4 px-4 sm:-mx-6 sm:px-6 overflow-y-auto">
                <div className="space-y-3 pb-4">
                  {benefits.map((benefit) => {
                    const isBiolifeDiscount = isBiolifeBenefit(benefit) && beneficiaryType === "dependent";
                    const blockedByBiolifeCooldown = isBiolifeBenefit(benefit) && !!biolifeNextAvailableAt;
                    const blockedByGender =
                      isBiolifeBenefit(benefit) && beneficiaryType !== "dependent" && !titularIsFemale;
                    const isDisabled = hasActiveAuthorization(benefit.id) || blockedByBiolifeCooldown || blockedByGender;
                    
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
                                {hasActiveAuthorization(benefit.id) && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-amber-100 text-amber-700"
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Já possui
                                  </Badge>
                                )}
                                {isBiolifeDiscount && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-amber-100 text-amber-700"
                                  >
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Desconto 50%
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
              </div>
            </>
          )}

          <div className="pt-4 border-t shrink-0 pb-[env(safe-area-inset-bottom)]">
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
              <strong className="text-foreground">{selectedBenefit?.name}</strong>
              <br />
              {beneficiaryType === "dependent" && selectedDependent && (
                <>
                  <span className="text-violet-600">
                    Beneficiário: {selectedDependent.name} (Dependente)
                  </span>
                  <br />
                </>
              )}
              {beneficiaryType === "titular" && (
                <>
                  <span className="text-emerald-600">
                    Beneficiário: Titular
                  </span>
                  <br />
                </>
              )}
              <br />
              Esta declaração terá validade de{" "}
              <strong>{selectedBenefit?.validity_days} dias</strong>.
              <br />
              <br />
              <span className="text-amber-600 text-xs">
                ⚠️ Não será possível emitir outra declaração deste benefício para{" "}
                {beneficiaryType === "dependent" ? "este dependente" : "você (titular)"}{" "}
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
