import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, AlertCircle, Loader2 } from "lucide-react";
import { format, parseISO, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { CardExpiryWithPayslipDialog } from "./CardExpiryWithPayslipDialog";
import { notifyCardRenewal } from "@/lib/notifyCardRenewal";

interface InlineCardExpiryEditProps {
  entityId: string;
  entityType: "patient" | "dependent";
  currentExpiryDate: string | null;
  cardNumber?: string | null;
  insurancePlanName?: string | null;
  onUpdate?: () => void;
  requirePayslip?: boolean;
}

export function InlineCardExpiryEdit({
  entityId,
  entityType,
  currentExpiryDate,
  cardNumber,
  insurancePlanName,
  onUpdate,
  requirePayslip = false,
}: InlineCardExpiryEditProps) {
  const { toast } = useToast();
  const { isAdmin } = usePermissions();
  // Admins podem alterar a validade diretamente.
  // Demais usuários podem clicar para abrir o fluxo de envio de contracheque
  // (validação automática via Vision), que renova a carteirinha após aprovação.
  const normalizedInsurancePlanEarly = insurancePlanName?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
  const isRodoviarioEarly = normalizedInsurancePlanEarly.includes("rodoviario");
  const payslipFlowAvailable = requirePayslip || (entityType === "patient" && !isRodoviarioEarly);
  // Sem carteirinha ainda: qualquer usuário pode emitir a primeira, com validade fixa de 30 dias
  const isFirstIssue = !currentExpiryDate;
  const canEditExpiry = isAdmin || payslipFlowAvailable || isFirstIssue;
  const [isEditing, setIsEditing] = useState(false);
  const [lockedFirstIssue, setLockedFirstIssue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [showPayslipDialog, setShowPayslipDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isExpired = currentExpiryDate
    ? isBefore(parseISO(currentExpiryDate), new Date())
    : false;

  const daysUntilExpiry = currentExpiryDate
    ? Math.ceil(
        (new Date(currentExpiryDate).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const isExpiringSoon =
    daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;

  const isRodoviario = isRodoviarioEarly;
  const shouldRequirePayslip = payslipFlowAvailable;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (!canEditExpiry) return;

    console.info("[InlineCardExpiryEdit] start", {
      entityId,
      entityType,
      insurancePlanName,
      requirePayslip,
      shouldRequirePayslip,
    });

    // Primeira emissão: validade fixa de 30 dias (também para usuários não admin)
    if (isFirstIssue && !isAdmin) {
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);
      setNewDate(in30Days.toISOString().split("T")[0]);
      setLockedFirstIssue(true);
      setIsEditing(true);
      return;
    }

    if (shouldRequirePayslip) {
      setShowPayslipDialog(true);
      return;
    }

    // Edição direta da data só para admins (fluxo sem contracheque, ex.: Rodoviário)
    if (!isAdmin) return;
    
    if (currentExpiryDate) {
      setNewDate(currentExpiryDate.split("T")[0]);
    } else {
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      setNewDate(oneYearFromNow.toISOString().split("T")[0]);
    }
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLockedFirstIssue(false);
    setNewDate("");
  };

  const handleSave = async () => {
    if (!newDate) return;

    setSaving(true);
    try {
      let dependentsUpdated = 0;
      
      if (entityType === "patient") {
        const { data: existingCard, error: fetchError } = await supabase
          .from("patient_cards")
          .select("id")
          .eq("patient_id", entityId)
          .eq("is_active", true)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (existingCard) {
          const { error } = await supabase
            .from("patient_cards")
            .update({ expires_at: newDate })
            .eq("id", existingCard.id);

          if (error) throw error;
          
          const { count } = await supabase
            .from("patient_dependents")
            .select("*", { count: "exact", head: true })
            .eq("patient_id", entityId)
            .eq("is_active", true);
          
          dependentsUpdated = count || 0;
        } else {
          const { data: patient } = await supabase
            .from("patients")
            .select("clinic_id")
            .eq("id", entityId)
            .single();

          if (patient) {
            const { error } = await supabase.from("patient_cards").insert([{
              patient_id: entityId,
              clinic_id: patient.clinic_id,
              expires_at: newDate,
              is_active: true,
              card_number: `CARD-${Date.now()}`,
            }]);

            if (error) throw error;
            
            const { count } = await supabase
              .from("patient_dependents")
              .select("*", { count: "exact", head: true })
              .eq("patient_id", entityId)
              .eq("is_active", true);
            
            dependentsUpdated = count || 0;
          }
        }
      } else {
        const { error } = await supabase
          .from("patient_dependents")
          .update({ card_expires_at: newDate })
          .eq("id", entityId);

        if (error) throw error;
      }

      const dependentMessage = dependentsUpdated > 0 
        ? ` ${dependentsUpdated} dependente(s) também atualizado(s).`
        : "";

      toast({
        title: "Validade atualizada",
        description: `A data de validade da carteirinha foi atualizada.${dependentMessage}`,
      });

      setIsEditing(false);
      setLockedFirstIssue(false);
      onUpdate?.();
    } catch (error: any) {
      console.error("Error updating card expiry:", error);
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 w-32 text-xs"
          disabled={saving || lockedFirstIssue}
          readOnly={lockedFirstIssue}
          title={lockedFirstIssue ? "Primeira carteirinha: validade fixa de 30 dias" : undefined}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleSave}
          disabled={saving || !newDate}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3 text-success" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCancel}
          disabled={saving}
        >
          <X className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    );
  }

  if (!currentExpiryDate) {
    if (!canEditExpiry) {
      return <span className="text-muted-foreground text-sm">—</span>;
    }
    return (
      <>
        <button
          onClick={handleStartEdit}
          className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer text-sm"
          title="Clique para adicionar validade"
        >
          —
        </button>
        {shouldRequirePayslip && (
          <CardExpiryWithPayslipDialog
            open={showPayslipDialog}
            onOpenChange={setShowPayslipDialog}
            entityId={entityId}
            entityType={entityType}
            currentExpiryDate={currentExpiryDate}
            onSuccess={onUpdate}
          />
        )}
      </>
    );
  }

  const formattedDate = format(parseISO(currentExpiryDate), "dd/MM/yyyy", {
    locale: ptBR,
  });

  const badgeContent = (
    <Badge
      variant={isExpired ? "destructive" : isExpiringSoon ? "secondary" : "outline"}
      className={`text-xs ${
        isExpiringSoon && !isExpired ? "bg-warning text-warning-foreground" : ""
      }`}
    >
      {isExpired && <AlertCircle className="h-3 w-3 mr-1" />}
      {isExpired ? "Vencida" : formattedDate}
    </Badge>
  );

  if (!canEditExpiry) {
    return <span>{badgeContent}</span>;
  }

  return (
    <>
      <button
        onClick={handleStartEdit}
        className="cursor-pointer hover:opacity-80 transition-opacity"
        title="Clique para editar validade"
      >
        {badgeContent}
      </button>
      {shouldRequirePayslip && (
        <CardExpiryWithPayslipDialog
          open={showPayslipDialog}
          onOpenChange={setShowPayslipDialog}
          entityId={entityId}
          entityType={entityType}
          currentExpiryDate={currentExpiryDate}
          onSuccess={onUpdate}
        />
      )}
    </>
  );
}
