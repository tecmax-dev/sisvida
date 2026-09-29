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

// Friendly error messages for PWA users
function getFriendlyErrorMessage(rawMessage?: string): string {
  if (!rawMessage) return "Ocorreu um erro inesperado. Tente novamente mais tarde.";
  const msg = rawMessage.toLowerCase();
  if (msg.includes("cpf_associado_existente") || (msg.includes("associado") && msg.includes("titular"))) {
    return "Este CPF já está cadastrado como associado/titular nesta entidade. Não é permitido incluí-lo como dependente.";
  }
  if (msg.includes("cpf já cadastrado como dependente") || msg.includes("já cadastrado como dependente")) {
    return "Este CPF já está cadastrado como dependente nesta entidade.";
  }
  if (msg.includes("filhos devem ter até 21")) {
    return "Filhos podem ser cadastrados como dependentes apenas até 21 anos de idade.";
  }
  if (msg.includes("solicitação pendente") || msg.includes("solicitacao pendente")) {
    return "Já existe uma solicitação pendente para este CPF. Aguarde a análise do sindicato.";
  }
  if (msg.includes("associado não encontrado") || msg.includes("associado nao encontrado") || msg.includes("faça login novamente") || msg.includes("faca login novamente")) {
    return "Sua sessão de associado expirou ou está inválida. Entre novamente no aplicativo e tente de novo.";
  }
  if (msg.includes("não é permitido criar novos cadastros") || msg.includes("nao e permitido criar novos cadastros")) {
    return "Não foi possível validar o cadastro do associado no sindicato. Entre novamente no aplicativo e tente de novo.";
  }
  if (msg.includes("unique") && msg.includes("cpf")) {
    return "Este CPF já está cadastrado como dependente. Verifique os dados e tente novamente.";
  }
  if (msg.includes("duplicate key")) {
    return "Este dependente já foi cadastrado anteriormente.";
  }
  if (msg.includes("violates row-level security")) {
    return "Você não tem permissão para realizar esta ação. Faça login novamente.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  }
  if (msg.includes("timeout")) {
    return "A operação demorou muito. Tente novamente.";
  }
  return "Ocorreu um erro inesperado. Tente novamente mais tarde.";
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

const DEPENDENT_DOCUMENT_BUCKET = "dependent-cpf-photos";

type DocKey = "dep_front" | "dep_back" | "holder_front" | "holder_back";
interface DocState {
  file: File;
  preview: string;
}
const DOC_SLOTS: { key: DocKey; group: "dependent" | "holder"; side: string; label: string }[] = [
  { key: "dep_front", group: "dependent", side: "Frente", label: "frente do documento do dependente" },
  { key: "dep_back", group: "dependent", side: "Verso", label: "verso do documento do dependente" },
  { key: "holder_front", group: "holder", side: "Frente", label: "frente do documento do titular" },
  { key: "holder_back", group: "holder", side: "Verso", label: "verso do documento do titular" },
];
const EMPTY_DOCS: Record<DocKey, DocState | null> = {
  dep_front: null,
  dep_back: null,
  holder_front: null,
  holder_back: null,
};

interface FormData {
  name: string;
  cpf: string;
  birthDate: string;
  phone: string;
  relationship: string;
  gender: string;
}

interface FormErrors {
  name?: string;
  cpf?: string;
  birthDate?: string;
  phone?: string;
  relationship?: string;
  gender?: string;
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
    gender: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [docs, setDocs] = useState<Record<DocKey, DocState | null>>(EMPTY_DOCS);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingCpf, setCheckingCpf] = useState(false);
  const [cpfExists, setCpfExists] = useState(false);
  const fileRefs = useRef<Partial<Record<DocKey, HTMLInputElement | null>>>({});
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

  const handleFileSelect = (key: DocKey, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma foto do documento.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setErrors((prev) => ({ ...prev, document: undefined }));
    const reader = new FileReader();
    reader.onloadend = () => {
      setDocs((prev) => ({ ...prev, [key]: { file, preview: reader.result as string } }));
    };
    reader.readAsDataURL(file);
  };

  const removeDocument = (key: DocKey) => {
    setDocs((prev) => ({ ...prev, [key]: null }));
    const el = fileRefs.current[key];
    if (el) el.value = "";
  };

  const clearAllDocuments = () => {
    setDocs(EMPTY_DOCS);
    Object.values(fileRefs.current).forEach((el) => el && (el.value = ""));
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

    // Gender validation
    if (!formData.gender) {
      newErrors.gender = "Sexo é obrigatório";
    }

    // Age validation for children
    if (formData.relationship === "child" && birthDate) {
      const age = differenceInYears(new Date(), birthDate);
      if (age > 21) {
        newErrors.relationship = "Filhos devem ter até 21 anos";
      }
    }

    // Document validation (frente e verso do dependente e do titular)
    const missing = DOC_SLOTS.filter((s) => !docs[s.key]);
    if (missing.length > 0) {
      newErrors.document = `Falta enviar: ${missing.map((m) => m.label).join(", ")}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadOne = async (key: DocKey): Promise<string> => {
    const file = docs[key]!.file;
    const fileExt = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileName = `${patientId}/${Date.now()}-${key}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from(DEPENDENT_DOCUMENT_BUCKET)
      .upload(fileName, file, { cacheControl: "3600", upsert: false });
    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error(uploadError.message || "Erro ao enviar documento");
    }
    return fileName;
  };

  const uploadDocuments = async (): Promise<Record<DocKey, string>> => {
    setUploading(true);
    try {
      const out = {} as Record<DocKey, string>;
      for (const s of DOC_SLOTS) out[s.key] = await uploadOne(s.key);
      return out;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: "Formulário incompleto",
        description: "Preencha todos os campos e envie as 4 fotos dos documentos.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const paths = await uploadDocuments();

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
        p_gender: formData.gender,
        p_cpf_photo_url: paths.dep_front,
        p_cpf_photo_back_url: paths.dep_back,
        p_holder_doc_front_url: paths.holder_front,
        p_holder_doc_back_url: paths.holder_back,
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
        gender: "",
        cpf: "",
        birthDate: "",
        phone: "",
        relationship: "",
      });
      clearAllDocuments();
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error submitting request:", error);
      const friendlyMessage = getFriendlyErrorMessage(error.message);
      toast({
        title: "Não foi possível enviar a solicitação",
        description: friendlyMessage,
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
      gender: "",
    });
    setErrors({});
    clearAllDocuments();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const isLoading = uploading || submitting;
  const docsDone = DOC_SLOTS.filter((s) => docs[s.key]).length;

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
                    <div className="flex gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800">
                        <p className="font-medium mb-1">CPF já cadastrado!</p>
                        <p className="mb-2">
                          Este CPF já está registrado em nossa base de dados. 
                          Para mais informações, entre em contato conosco.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="bg-green-600 hover:bg-green-700 text-white border-0 h-8 text-xs"
                          onClick={() => window.open("https://wa.me/557332239980?text=Olá! Estou tentando cadastrar um dependente, mas o CPF já existe no sistema.", "_blank")}
                        >
                          <Phone className="h-3 w-3 mr-1" />
                          Falar no WhatsApp
                        </Button>
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

            {/* Gender */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Sexo <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => handleInputChange("gender", value)}
                disabled={isLoading}
              >
                <SelectTrigger className={errors.gender ? "border-red-500" : ""}>
                  <SelectValue placeholder="Selecione o sexo" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="masculino">Masculino</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.gender}
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
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-emerald-700 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Documentos obrigatórios</p>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Fotografe a <strong>frente e o verso</strong> do RG ou CNH do dependente e do titular.
                      Use boa iluminação e deixe todos os dados legíveis.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-emerald-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all"
                      style={{ width: `${(docsDone / DOC_SLOTS.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-emerald-800">
                    {docsDone}/{DOC_SLOTS.length}
                  </span>
                </div>
              </div>

              {(["dependent", "holder"] as const).map((group) => (
                <div key={group} className="space-y-2">
                  <p className="text-sm font-medium">
                    {group === "dependent" ? "Documento do dependente" : "Documento do titular (você)"}{" "}
                    <span className="text-red-500">*</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {DOC_SLOTS.filter((s) => s.group === group).map((slot) => {
                      const doc = docs[slot.key];
                      return (
                        <div key={slot.key}>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={(el) => (fileRefs.current[slot.key] = el)}
                            onChange={(e) => handleFileSelect(slot.key, e)}
                          />
                          {!doc ? (
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => fileRefs.current[slot.key]?.click()}
                              className={`w-full aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 bg-background hover:bg-muted/50 transition-colors ${
                                errors.document && !doc ? "border-red-400" : "border-muted-foreground/30"
                              }`}
                            >
                              <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Camera className="h-4 w-4 text-emerald-600" />
                              </div>
                              <span className="text-xs font-semibold text-foreground">{slot.side}</span>
                              <span className="text-[10px] text-muted-foreground">Toque para fotografar</span>
                            </button>
                          ) : (
                            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border">
                              <img src={doc.preview} alt={slot.label} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => removeDocument(slot.key)}
                                className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
                                aria-label={`Remover ${slot.label}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                              <div className="absolute bottom-0 inset-x-0 bg-black/55 px-2 py-1 flex items-center gap-1 text-white text-[11px]">
                                <CheckCircle2 className="h-3 w-3" />
                                {slot.side}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

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
