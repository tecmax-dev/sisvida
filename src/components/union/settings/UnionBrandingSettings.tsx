import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, Trash2, Image, PenTool } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UnionBrandingSettingsProps {
  entityId: string;
  logoUrl?: string | null;
  presidentName?: string | null;
  presidentSignatureUrl?: string | null;
}

export function UnionBrandingSettings({
  entityId,
  logoUrl,
  presidentName,
  presidentSignatureUrl,
}: UnionBrandingSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [localPresidentName, setLocalPresidentName] = useState(presidentName || "");
  const [savingName, setSavingName] = useState(false);

  const uploadFile = async (file: File, type: "logo" | "signature") => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${entityId}/${type}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("union-entity-files")
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("union-entity-files")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem válida", variant: "destructive" });
      return;
    }

    setUploadingLogo(true);
    try {
      const url = await uploadFile(file, "logo");
      
      const { error } = await supabase
        .from("union_entities")
        .update({ logo_url: url })
        .eq("id", entityId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["union-entity"] });
      toast({ title: "Logomarca atualizada com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro ao enviar logomarca", description: error.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem válida", variant: "destructive" });
      return;
    }

    setUploadingSignature(true);
    try {
      const url = await uploadFile(file, "signature");
      
      const { error } = await supabase
        .from("union_entities")
        .update({ president_signature_url: url })
        .eq("id", entityId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["union-entity"] });
      toast({ title: "Assinatura atualizada com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro ao enviar assinatura", description: error.message, variant: "destructive" });
    } finally {
      setUploadingSignature(false);
      if (signatureInputRef.current) signatureInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    try {
      const { error } = await supabase
        .from("union_entities")
        .update({ logo_url: null })
        .eq("id", entityId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["union-entity"] });
      toast({ title: "Logomarca removida" });
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    }
  };

  const handleRemoveSignature = async () => {
    try {
      const { error } = await supabase
        .from("union_entities")
        .update({ president_signature_url: null })
        .eq("id", entityId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["union-entity"] });
      toast({ title: "Assinatura removida" });
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    }
  };

  const handleSavePresidentName = async () => {
    setSavingName(true);
    try {
      const { error } = await supabase
        .from("union_entities")
        .update({ president_name: localPresidentName || null })
        .eq("id", entityId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["union-entity"] });
      toast({ title: "Nome do presidente salvo!" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Identidade Visual
        </CardTitle>
        <CardDescription>
          Configure a logomarca e assinatura do presidente para documentos e autorizações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Section */}
        <div className="space-y-3">
          <Label>Logomarca do Sindicato</Label>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <div className="relative">
                <img
                  src={logoUrl}
                  alt="Logo do sindicato"
                  className="h-20 w-auto object-contain border rounded-lg p-2 bg-white"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={handleRemoveLogo}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="h-20 w-32 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
                <Image className="h-8 w-8" />
              </div>
            )}
            <div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {logoUrl ? "Alterar" : "Enviar"} Logo
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                PNG ou JPG, fundo transparente recomendado
              </p>
            </div>
          </div>
        </div>

        {/* President Name */}
        <div className="space-y-3">
          <Label>Nome do Presidente</Label>
          <div className="flex gap-2">
            <Input
              value={localPresidentName}
              onChange={(e) => setLocalPresidentName(e.target.value)}
              placeholder="Nome completo do presidente"
              className="max-w-sm"
            />
            <Button
              variant="outline"
              onClick={handleSavePresidentName}
              disabled={savingName}
            >
              {savingName && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* Signature Section */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <PenTool className="h-4 w-4" />
            Assinatura do Presidente
          </Label>
          <div className="flex items-center gap-4">
            {presidentSignatureUrl ? (
              <div className="relative">
                <img
                  src={presidentSignatureUrl}
                  alt="Assinatura do presidente"
                  className="h-16 w-auto object-contain border rounded-lg p-2 bg-white"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={handleRemoveSignature}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="h-16 w-40 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
                <PenTool className="h-6 w-6" />
              </div>
            )}
            <div>
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/*"
                onChange={handleSignatureUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => signatureInputRef.current?.click()}
                disabled={uploadingSignature}
              >
                {uploadingSignature ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {presidentSignatureUrl ? "Alterar" : "Enviar"} Assinatura
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Imagem com fundo transparente (PNG) recomendado
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
