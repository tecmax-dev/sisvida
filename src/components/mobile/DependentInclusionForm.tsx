import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserPlus,
  Upload,
  Camera,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { format, differenceInYears, parse, isValid } from "date-fns";

interface DependentInclusionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  clinicId: string;
  onSuccess?: () => void;
}

// CPF formatting and validation
const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const isValidCPF = (cpf: string): boolean => {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(digits[10]);
};

// Date formatting
const formatDateInput = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const parseBirthDate = (dateStr: string): Date | null => {
  if (!dateStr || dateStr.length !== 10) return null;
  const parsed = parse(dateStr, "dd/MM/yyyy", new Date());
  return isValid(parsed) ? parsed : null;
};

// Phone formatting
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

interface FormData {
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
  relationship: string;
}

interface FormErrors {
  name?: string;
  cpf?: string;
  birthDate?: string;
  phone?: string;
  relationship?: string;
  document?: string;
}

export function DependentInclusionForm({
  open,
  onOpenChange,
  patientId,
  clinicId,
  onSuccess,
}: DependentInclusionFormProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    cpf: "",
    birthDate: "",
    phone: "",
    relationship: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleInputChange = (field: keyof FormData, value: string) => {
    let formattedValue = value;

    switch (field) {
      case "cpf":
        formattedValue = formatCPF(value);
        break;
      case "birthDate":
        formattedValue = formatDateInput(value);
        break;
      case "phone":
        formattedValue = formatPhone(value);
        break;
    }

    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type (images only)
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem (foto do RG/CPF).",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setDocumentFile(file);
    setErrors((prev) => ({ ...prev, document: undefined }));

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setDocumentPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeDocument = () => {
    setDocumentFile(null);
    setDocumentPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Nome é obrigatório";
    } else if (formData.name.trim().length < 3) {
      newErrors.name = "Nome deve ter pelo menos 3 caracteres";
    }

    // CPF validation
    if (!formData.cpf) {
      newErrors.cpf = "CPF é obrigatório";
    } else if (!isValidCPF(formData.cpf)) {
      newErrors.cpf = "CPF inválido";
    }

    // Birth date validation
    const birthDate = parseBirthDate(formData.birthDate);
    if (!formData.birthDate) {
      newErrors.birthDate = "Data de nascimento é obrigatória";
    } else if (!birthDate) {
      newErrors.birthDate = "Data inválida";
    } else if (birthDate > new Date()) {
      newErrors.birthDate = "Data não pode ser futura";
    }

    // Phone validation
    const phoneDigits = formData.phone.replace(/\D/g, "");
    if (!formData.phone) {
      newErrors.phone = "Telefone é obrigatório";
    } else if (phoneDigits.length < 10) {
      newErrors.phone = "Telefone inválido";
    }

    // Relationship validation
    if (!formData.relationship) {
      newErrors.relationship = "Grau de parentesco é obrigatório";
    }

    // Age validation for children
    if (formData.relationship === "child" && birthDate) {
      const age = differenceInYears(new Date(), birthDate);
      if (age > 21) {
        newErrors.relationship = "Filhos devem ter até 21 anos";
      }
    }

    // Document validation
    if (!documentFile) {
      newErrors.document = "Foto do RG/CPF é obrigatória";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadDocument = async (): Promise<string | null> => {
    if (!documentFile) return null;

    setUploading(true);
    try {
      const fileExt = documentFile.name.split(".").pop();
      const fileName = `${patientId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("dependent-documents")
        .upload(fileName, documentFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Erro ao enviar documento");
      }

      const { data: urlData } = supabase.storage
        .from("dependent-documents")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading document:", error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: "Formulário incompleto",
        description: "Por favor, preencha todos os campos corretamente.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Upload document first
      const documentUrl = await uploadDocument();
      if (!documentUrl) {
        throw new Error("Erro ao enviar documento");
      }

      // Parse birth date
      const birthDate = parseBirthDate(formData.birthDate);
      if (!birthDate) {
        throw new Error("Data de nascimento inválida");
      }

      // Clean CPF and phone
      const cleanCpf = formData.cpf.replace(/\D/g, "");
      const cleanPhone = formData.phone.replace(/\D/g, "");

      // Call RPC to create dependent request
      const { error: rpcError } = await supabase.rpc("request_dependent_inclusion", {
        p_patient_id: patientId,
        p_clinic_id: clinicId,
        p_name: formData.name.trim(),
        p_cpf: cleanCpf,
        p_birth_date: format(birthDate, "yyyy-MM-dd"),
        p_phone: cleanPhone,
        p_relationship: formData.relationship,
        p_cpf_photo_url: documentUrl,
      });

      if (rpcError) {
        console.error("RPC error:", rpcError);
        throw new Error(rpcError.message || "Erro ao enviar solicitação");
      }

      toast({
        title: "Solicitação enviada!",
        description: "Sua solicitação de inclusão de dependente foi enviada e será analisada em breve.",
      });

      // Reset form
      setFormData({
        name: "",
        cpf: "",
        birthDate: "",
        phone: "",
        relationship: "",
      });
      removeDocument();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error submitting request:", error);
      toast({
        title: "Erro ao enviar solicitação",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      cpf: "",
      birthDate: "",
      phone: "",
      relationship: "",
    });
    setErrors({});
    removeDocument();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const isLoading = uploading || submitting;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md mx-4 max-h-[90vh] p-0 rounded-2xl overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle>Solicitar Inclusão de Dependente</DialogTitle>
              <DialogDescription>
                Preencha os dados do dependente para análise
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-4">
          <div className="space-y-4 pb-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Nome completo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Nome do dependente"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className={errors.name ? "border-red-500" : ""}
                disabled={isLoading}
              />
              {errors.name && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.name}
                </p>
              )}
            </div>

            {/* CPF */}
            <div className="space-y-2">
              <Label htmlFor="cpf" className="text-sm font-medium">
                CPF <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={(e) => handleInputChange("cpf", e.target.value)}
                className={errors.cpf ? "border-red-500" : ""}
                disabled={isLoading}
                inputMode="numeric"
              />
              {errors.cpf && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.cpf}
                </p>
              )}
            </div>

            {/* Birth Date */}
            <div className="space-y-2">
              <Label htmlFor="birthDate" className="text-sm font-medium">
                Data de nascimento <span className="text-red-500">*</span>
              </Label>
              <Input
                id="birthDate"
                placeholder="DD/MM/AAAA"
                value={formData.birthDate}
                onChange={(e) => handleInputChange("birthDate", e.target.value)}
                className={errors.birthDate ? "border-red-500" : ""}
                disabled={isLoading}
                inputMode="numeric"
              />
              {errors.birthDate && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.birthDate}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                Telefone de contato <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                placeholder="(00) 00000-0000"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className={errors.phone ? "border-red-500" : ""}
                disabled={isLoading}
                inputMode="tel"
              />
              {errors.phone && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.phone}
                </p>
              )}
            </div>

            {/* Relationship */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Grau de parentesco <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.relationship}
                onValueChange={(value) => handleInputChange("relationship", value)}
                disabled={isLoading}
              >
                <SelectTrigger className={errors.relationship ? "border-red-500" : ""}>
                  <SelectValue placeholder="Selecione o parentesco" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="spouse">Esposo(a) / Cônjuge</SelectItem>
                  <SelectItem value="child">Filho(a) - até 21 anos</SelectItem>
                  <SelectItem value="father">Pai</SelectItem>
                  <SelectItem value="mother">Mãe</SelectItem>
                </SelectContent>
              </Select>
              {errors.relationship && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.relationship}
                </p>
              )}
            </div>

            {/* Document Upload */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Foto do RG/CPF <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Envie uma foto legível do documento de identidade para validação
              </p>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!documentFile ? (
                <Card
                  className={`border-dashed cursor-pointer hover:bg-muted/50 transition-colors ${
                    errors.document ? "border-red-500" : ""
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Camera className="h-6 w-6 text-emerald-600" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      Toque para adicionar foto
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG ou HEIC até 5MB
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <CardContent className="p-0 relative">
                    <img
                      src={documentPreview || ""}
                      alt="Documento"
                      className="w-full h-40 object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 rounded-full"
                      onClick={removeDocument}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                      <div className="flex items-center gap-2 text-white text-sm">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Documento anexado</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {errors.document && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.document}
                </p>
              )}
            </div>

            {/* Info Card */}
            <Card className="bg-amber-50 border-amber-100">
              <CardContent className="p-3">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <p className="font-medium mb-1">Importante</p>
                    <ul className="space-y-0.5 list-disc list-inside">
                      <li>A solicitação será analisada em até 5 dias úteis</li>
                      <li>Você receberá uma notificação sobre o resultado</li>
                      <li>O cadastro ficará pendente até a validação</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 pt-0 flex-col gap-2">
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {uploading ? "Enviando documento..." : "Enviando solicitação..."}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Enviar Solicitação
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="w-full"
            disabled={isLoading}
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
