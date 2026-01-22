import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
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
  Phone,
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
  const [checkingCpf, setCheckingCpf] = useState(false);
  const [cpfExists, setCpfExists] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Check if CPF already exists in the database
  const checkCpfExists = async (cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11 || !isValidCPF(cpf)) {
      setCpfExists(false);
      return;
    }

    setCheckingCpf(true);
    try {
      // Check in patients table
      const { data: patientData } = await supabase
        .from("patients")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .eq("cpf", cleanCpf)
        .maybeSingle();

      if (patientData) {
        setCpfExists(true);
        setErrors((prev) => ({ ...prev, cpf: "exists" }));
        return;
      }

      // Check in patient_dependents table
      const { data: dependentData } = await supabase
        .from("patient_dependents")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .eq("cpf", cleanCpf)
        .eq("is_active", true)
        .maybeSingle();

      if (dependentData) {
        setCpfExists(true);
        setErrors((prev) => ({ ...prev, cpf: "exists" }));
        return;
      }

      setCpfExists(false);
    } catch (error) {
      console.error("Error checking CPF:", error);
    } finally {
      setCheckingCpf(false);
    }
  };

  const handleInputChange = async (field: keyof FormData, value: string) => {
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
    setCpfExists(false);

    // Check CPF when fully entered
    if (field === "cpf" && formattedValue.replace(/\D/g, "").length === 11) {
      await checkCpfExists(formattedValue);
    }
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
    } else if (cpfExists) {
      newErrors.cpf = "exists";
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
    <PopupBase open={open} onClose={() => handleOpenChange(false)} maxWidth="md" className="p-0">
      <PopupHeader className="p-4 pb-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <PopupTitle>Solicitar Inclusão de Dependente</PopupTitle>
            <PopupDescription>
              Preencha os dados do dependente para análise
            </PopupDescription>
          </div>
        </div>
      </PopupHeader>

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
            <div className="relative">
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={(e) => handleInputChange("cpf", e.target.value)}
                className={errors.cpf || cpfExists ? "border-red-500 pr-10" : ""}
                disabled={isLoading}
                inputMode="numeric"
              />
              {checkingCpf && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            
            {/* CPF Already Exists Warning */}
            {cpfExists && (
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        CPF já cadastrado
                      </p>
                      <p className="text-xs text-amber-700">
                        Este CPF já está vinculado a um titular ou dependente.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {errors.cpf && errors.cpf !== "exists" && (
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
              Telefone <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                placeholder="(00) 00000-0000"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className={`pl-10 ${errors.phone ? "border-red-500" : ""}`}
                disabled={isLoading}
                inputMode="tel"
              />
            </div>
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
              <SelectContent>
                <SelectItem value="spouse">Cônjuge</SelectItem>
                <SelectItem value="child">Filho(a)</SelectItem>
                <SelectItem value="parent">Pai/Mãe</SelectItem>
                <SelectItem value="sibling">Irmão(ã)</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
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
              Foto do RG ou CPF <span className="text-red-500">*</span>
            </Label>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isLoading}
            />
            
            {documentPreview ? (
              <Card className="relative overflow-hidden">
                <CardContent className="p-0">
                  <img
                    src={documentPreview}
                    alt="Documento"
                    className="w-full h-48 object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={removeDocument}
                    disabled={isLoading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="absolute bottom-2 left-2 bg-white/90 px-2 py-1 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-medium">Documento anexado</span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card
                className={`border-2 border-dashed cursor-pointer hover:border-primary transition-colors ${
                  errors.document ? "border-red-500" : ""
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Toque para tirar foto ou anexar</p>
                  <p className="text-xs text-muted-foreground">
                    Imagem do RG ou CPF (máx. 5MB)
                  </p>
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
        </div>
      </ScrollArea>

      <PopupFooter className="p-4 pt-2 flex-col gap-2">
        <Button
          className="w-full"
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
              <UserPlus className="h-4 w-4 mr-2" />
              Enviar Solicitação
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => handleOpenChange(false)}
          disabled={isLoading}
        >
          Cancelar
        </Button>
      </PopupFooter>
    </PopupBase>
  );
}
