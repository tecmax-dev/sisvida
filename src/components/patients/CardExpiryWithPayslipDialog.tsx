import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileCheck, Loader2, ShieldCheck, ShieldAlert, Calendar, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { pdfToImageBase64 } from "@/utils/pdfToImage";

interface CardExpiryWithPayslipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityType: "patient" | "dependent";
  currentExpiryDate: string | null;
  onSuccess?: () => void;
}

type VerificationStatus = "idle" | "uploading" | "verifying" | "valid" | "invalid";

interface FoundItems {
  mensalidade_sindical?: boolean;
  taxa_assistencial?: boolean;
  taxa_negocial?: boolean;
}

export function CardExpiryWithPayslipDialog({
  open,
  onOpenChange,
  entityId,
  entityType,
  currentExpiryDate,
  onSuccess,
}: CardExpiryWithPayslipDialogProps) {
  const { toast } = useToast();
  const { currentClinic } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("idle");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [newDate, setNewDate] = useState(() => {
    if (currentExpiryDate) return currentExpiryDate.split("T")[0];
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split("T")[0];
  });
  const [saving, setSaving] = useState(false);
  const [foundItems, setFoundItems] = useState<FoundItems>({});
  const [memberName, setMemberName] = useState<string | null>(null);
  const [employerName, setEmployerName] = useState<string | null>(null);
  const [employerCnpj, setEmployerCnpj] = useState<string | null>(null);
  const [nameMatch, setNameMatch] = useState<boolean | null>(null);
  const [nameFoundInDoc, setNameFoundInDoc] = useState<string | null>(null);

  // Fetch member name when dialog opens
  useEffect(() => {
    if (!open || !entityId) return;
    const fetchName = async () => {
      if (entityType === "patient") {
        const { data } = await supabase.from("patients").select("name, employer_name, employer_cnpj").eq("id", entityId).single();
        setMemberName(data?.name || null);
        setEmployerName(data?.employer_name || null);
        setEmployerCnpj(data?.employer_cnpj || null);
      } else {
        const { data } = await supabase
          .from("patient_dependents")
          .select("name, patient_id, patients:patient_id(employer_name, employer_cnpj)")
          .eq("id", entityId)
          .single();
        setMemberName(data?.name || null);
        const titular = (data as any)?.patients;
        setEmployerName(titular?.employer_name || null);
        setEmployerCnpj(titular?.employer_cnpj || null);
      }
    };
    fetchName();
  }, [open, entityId, entityType]);

  const resetState = () => {
    setFile(null);
    setFilePreview(null);
    setVerificationStatus("idle");
    setVerificationMessage("");
    setFoundItems({});
    setSaving(false);
    setNameMatch(null);
    setNameFoundInDoc(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(selected.type)) {
      toast({ title: "Formato inválido", description: "Envie uma imagem (JPG, PNG) ou PDF.", variant: "destructive" });
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O tamanho máximo é 10MB.", variant: "destructive" });
      return;
    }

    setFile(selected);
    setVerificationStatus("idle");
    setVerificationMessage("");

    if (selected.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(selected);
    } else {
      setFilePreview(null);
    }

    // Auto-verify
    await verifyDocument(selected);
  };

  const verifyDocument = async (fileToVerify: File) => {
    setVerificationStatus("uploading");

    try {
      let base64: string;

      // If PDF, convert first page to image for AI vision analysis
      if (fileToVerify.type === "application/pdf") {
        base64 = await pdfToImageBase64(fileToVerify);
      } else {
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(fileToVerify);
        });
      }

      setVerificationStatus("verifying");

      const { data, error } = await supabase.functions.invoke("verify-payslip-document", {
        body: {
          file_base64: base64,
          file_name: fileToVerify.name,
          file_type: fileToVerify.type,
          member_name: memberName,
          employer_name: employerName,
          employer_cnpj: employerCnpj,
          clinic_id: currentClinic?.id,
        },
      });

      if (error) throw error;

      if (data?.is_payslip) {
        setVerificationStatus("valid");
        setFoundItems(data.found_items || {});
        setNameMatch(data.name_match ?? null);
        setNameFoundInDoc(data.name_found_in_document || null);
        setVerificationMessage(data.message || "Documento identificado como contracheque válido.");
      } else {
        setVerificationStatus("invalid");
        setFoundItems(data?.found_items || {});
        setNameMatch(data?.name_match ?? null);
        setNameFoundInDoc(data?.name_found_in_document || null);
        setVerificationMessage(data?.message || "O documento enviado não parece ser um contracheque com os itens sindicais necessários.");
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setVerificationStatus("invalid");
      setVerificationMessage("Erro ao verificar o documento. Tente novamente.");
    }
  };

  const handleSave = async () => {
    if (!newDate || verificationStatus !== "valid" || !file || !currentClinic?.id) return;

    setSaving(true);
    try {
      // 1. Upload payslip to storage
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${currentClinic.id}/${entityId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("contra-cheques")
        .upload(filePath, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      // 2. Update card expiry
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
          }
        }

        const { count } = await supabase
          .from("patient_dependents")
          .select("*", { count: "exact", head: true })
          .eq("patient_id", entityId)
          .eq("is_active", true);
        dependentsUpdated = count || 0;
      } else {
        const { error } = await supabase
          .from("patient_dependents")
          .update({ card_expires_at: newDate })
          .eq("id", entityId);
        if (error) throw error;
      }

      // 3. Attach payslip to member folder
      try {
        const { attachPayslipToMemberFolder } = await import("@/utils/attachPayslipToMemberFolder");
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await attachPayslipToMemberFolder({
            clinicId: currentClinic.id,
            patientId: entityId,
            attachmentPath: filePath,
            userId: user.id,
          });
        }
      } catch { /* non-blocking */ }

      const depMsg = dependentsUpdated > 0 ? ` ${dependentsUpdated} dependente(s) também atualizado(s).` : "";
      toast({
        title: "Validade atualizada",
        description: `Carteirinha atualizada com contracheque anexado.${depMsg}`,
      });

      onOpenChange(false);
      resetState();
      onSuccess?.();
    } catch (error: any) {
      console.error("Error updating card expiry:", error);
      toast({ title: "Erro ao atualizar", description: error.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Atualizar Validade da Carteirinha
          </DialogTitle>
          <DialogDescription>
            Para atualizar a validade, é obrigatório o envio do contracheque do associado. O documento será verificado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date picker */}
          <div className="space-y-2">
            <Label>Nova data de validade</Label>
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Upload area */}
          <div className="space-y-2">
            <Label>Contracheque (obrigatório)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!file ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-muted/50 transition-colors"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Clique para enviar o contracheque
                </span>
                <span className="text-xs text-muted-foreground/70">
                  JPG, PNG ou PDF (máx. 10MB)
                </span>
              </button>
            ) : (
              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium truncate flex-1">{file.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => { setFile(null); setFilePreview(null); setVerificationStatus("idle"); }}>
                    Trocar
                  </Button>
                </div>

                {filePreview && (
                  <img src={filePreview} alt="Preview" className="max-h-40 rounded border object-contain mx-auto" />
                )}

                {/* Verification status */}
                {(verificationStatus === "uploading" || verificationStatus === "verifying") && (
                  <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>
                      {verificationStatus === "uploading" ? "Enviando documento..." : "Verificando se é um contracheque válido..."}
                    </AlertDescription>
                  </Alert>
                )}

                {verificationStatus === "valid" && (
                  <div className="space-y-2">
                    <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
                      <ShieldCheck className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700 dark:text-green-400">
                        {verificationMessage}
                      </AlertDescription>
                    </Alert>
                    <div className="text-xs space-y-1 pl-1">
                      {memberName && (
                        <div className="mb-2">
                          <p className="font-medium text-muted-foreground">Validação do nome:</p>
                          <div className="flex items-center gap-1">
                            <UserCheck className={`h-3 w-3 ${nameMatch ? "text-green-600" : "text-destructive"}`} />
                            <span className={nameMatch ? "text-green-600" : "text-destructive"}>
                              {nameMatch ? `Nome confere: ${memberName}` : `Nome não confere`}
                            </span>
                          </div>
                          {nameFoundInDoc && (
                            <p className="text-muted-foreground ml-4">Nome no documento: {nameFoundInDoc}</p>
                          )}
                        </div>
                      )}
                      <p className="font-medium text-muted-foreground">Itens sindicais encontrados:</p>
                      <div className="flex items-center gap-1">
                        <span className={foundItems.mensalidade_sindical ? "text-green-600" : "text-destructive"}>
                          {foundItems.mensalidade_sindical ? "✓" : "✗"}
                        </span>
                        <span>Mensalidade Sindical</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={foundItems.taxa_assistencial ? "text-green-600" : "text-destructive"}>
                          {foundItems.taxa_assistencial ? "✓" : "✗"}
                        </span>
                        <span>Taxa Assistencial</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={foundItems.taxa_negocial ? "text-green-600" : "text-destructive"}>
                          {foundItems.taxa_negocial ? "✓" : "✗"}
                        </span>
                        <span>Taxa Negocial</span>
                      </div>
                    </div>
                  </div>
                )}

                {verificationStatus === "invalid" && (
                  <div className="space-y-2">
                    <Alert variant="destructive">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertDescription>
                        {verificationMessage}
                      </AlertDescription>
                    </Alert>
                    {nameMatch === false && memberName && (
                      <div className="text-xs pl-1 text-destructive flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        <span>Nome do associado: {memberName} {nameFoundInDoc ? `| Nome no documento: ${nameFoundInDoc}` : ""}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetState(); onOpenChange(false); }} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !newDate || verificationStatus !== "valid"}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Atualizar Validade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
