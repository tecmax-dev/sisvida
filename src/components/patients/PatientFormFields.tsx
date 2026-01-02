import { MessageCircle, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { openWhatsApp } from "@/lib/whatsapp";

interface InsurancePlan {
  id: string;
  name: string;
}

interface PatientFormFieldsProps {
  formData: PatientFormData;
  setFormData: (data: PatientFormData) => void;
  errors: Record<string, string>;
  insurancePlans: InsurancePlan[];
  onCepLookup: () => void;
  cepLoading: boolean;
}

export interface PatientFormData {
  // Identificação
  isCompany: boolean;
  isForeigner: boolean;
  recordCode?: number;
  name: string;
  contactName: string;
  cpf: string;
  rg: string;
  
  // Dados pessoais
  gender: string;
  birthDate: string;
  birthplace: string;
  maritalStatus: string;
  insurancePlanId: string;
  
  // Medidas
  heightCm: string;
  weightKg: string;
  skinColor: string;
  priority: string;
  religion: string;
  
  // Endereço
  cep: string;
  street: string;
  streetNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
  tag: string;
  referral: string;
  sendNotifications: boolean;
  
  // Contato
  phone: string;
  landline: string;
  email: string;
  preferredChannel: string;
  
  // Família e Trabalho
  profession: string;
  education: string;
  employerCnpj: string;
  employerName: string;
  motherName: string;
  fatherName: string;
  
  // Outros
  notes: string;
}

const genderOptions = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Feminino' },
  { value: 'O', label: 'Outro' },
];

const maritalStatusOptions = [
  { value: 'single', label: 'Solteiro(a)' },
  { value: 'married', label: 'Casado(a)' },
  { value: 'divorced', label: 'Divorciado(a)' },
  { value: 'widowed', label: 'Viúvo(a)' },
  { value: 'separated', label: 'Separado(a)' },
  { value: 'other', label: 'Outro' },
];

const skinColorOptions = [
  { value: 'branca', label: 'Branca' },
  { value: 'preta', label: 'Preta' },
  { value: 'parda', label: 'Parda' },
  { value: 'amarela', label: 'Amarela' },
  { value: 'indigena', label: 'Indígena' },
];

const priorityOptions = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
];

const channelOptions = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
];

const educationOptions = [
  { value: 'fundamental_incompleto', label: 'Fundamental Incompleto' },
  { value: 'fundamental', label: 'Fundamental Completo' },
  { value: 'medio_incompleto', label: 'Médio Incompleto' },
  { value: 'medio', label: 'Médio Completo' },
  { value: 'superior_incompleto', label: 'Superior Incompleto' },
  { value: 'superior', label: 'Superior Completo' },
  { value: 'pos_graduacao', label: 'Pós-Graduação' },
  { value: 'mestrado', label: 'Mestrado' },
  { value: 'doutorado', label: 'Doutorado' },
];

const stateOptions = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 
  'SP', 'SE', 'TO'
];

export function PatientFormFields({
  formData,
  setFormData,
  errors,
  insurancePlans,
  onCepLookup,
  cepLoading,
}: PatientFormFieldsProps) {
  const updateField = <K extends keyof PatientFormData>(
    field: K,
    value: PatientFormData[K]
  ) => {
    setFormData({ ...formData, [field]: value });
  };

  const formatCPF = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    return cleaned
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .substring(0, 14);
  };

  const formatPhone = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    return cleaned
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .substring(0, 15);
  };

  const formatCEP = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    return cleaned.replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
  };

  const formatCNPJ = (value: string): string => {
    const cleaned = value.replace(/\D/g, '').slice(0, 14);
    return cleaned
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  const calculateIMC = () => {
    const height = parseFloat(formData.heightCm);
    const weight = parseFloat(formData.weightKg);
    if (height > 0 && weight > 0) {
      const heightM = height / 100;
      return (weight / (heightM * heightM)).toFixed(1);
    }
    return '-';
  };

  return (
    <div className="space-y-6">
      {/* Linha 1: Checkboxes e Código */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isCompany"
            checked={formData.isCompany}
            onCheckedChange={(checked) => updateField('isCompany', !!checked)}
          />
          <Label htmlFor="isCompany" className="text-sm font-normal cursor-pointer">
            Jurídica
          </Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isForeigner"
            checked={formData.isForeigner}
            onCheckedChange={(checked) => updateField('isForeigner', !!checked)}
          />
          <Label htmlFor="isForeigner" className="text-sm font-normal cursor-pointer">
            Estrangeiro
          </Label>
        </div>
        
        <div className="col-span-2 sm:col-span-1 sm:col-start-4">
          <Label className="text-xs text-muted-foreground">Cód. Prontuário</Label>
          <Input
            value={formData.recordCode || 'Auto'}
            disabled
            className="mt-1 bg-muted"
          />
        </div>
      </div>

      {/* Linha 2: Nome, Nome Contato, CPF, RG */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            className={`mt-1 ${errors.name ? 'border-destructive' : ''}`}
          />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
        </div>
        
        <div>
          <Label htmlFor="contactName">Nome de Contato</Label>
          <Input
            id="contactName"
            value={formData.contactName}
            onChange={(e) => updateField('contactName', e.target.value)}
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="cpf">CPF</Label>
          <Input
            id="cpf"
            value={formData.cpf}
            onChange={(e) => updateField('cpf', formatCPF(e.target.value))}
            placeholder="000.000.000-00"
            className={`mt-1 ${errors.cpf ? 'border-destructive' : ''}`}
          />
          {errors.cpf && <p className="mt-1 text-xs text-destructive">{errors.cpf}</p>}
        </div>
        
        <div>
          <Label htmlFor="rg">RG</Label>
          <Input
            id="rg"
            value={formData.rg}
            onChange={(e) => updateField('rg', e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Linha 3: Sexo, Nascimento, Naturalidade, Estado Civil, Convênio */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div>
          <Label>Sexo</Label>
          <Select
            value={formData.gender || 'none'}
            onValueChange={(val) => updateField('gender', val === 'none' ? '' : val)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-</SelectItem>
              {genderOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="birthDate">Nascimento</Label>
          <Input
            id="birthDate"
            type="date"
            value={formData.birthDate}
            onChange={(e) => updateField('birthDate', e.target.value)}
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="birthplace">Naturalidade</Label>
          <Input
            id="birthplace"
            value={formData.birthplace}
            onChange={(e) => updateField('birthplace', e.target.value)}
            className="mt-1"
          />
        </div>
        
        <div>
          <Label>Estado Civil</Label>
          <Select
            value={formData.maritalStatus || 'none'}
            onValueChange={(val) => updateField('maritalStatus', val === 'none' ? '' : val)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-</SelectItem>
              {maritalStatusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Convênio</Label>
          <Select
            value={formData.insurancePlanId || 'none'}
            onValueChange={(val) => updateField('insurancePlanId', val === 'none' ? '' : val)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {insurancePlans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Linha 4: Altura, Peso, IMC, Cor de Pele, Prioridade, Religião */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div>
          <Label htmlFor="heightCm">Altura (cm)</Label>
          <Input
            id="heightCm"
            type="number"
            value={formData.heightCm}
            onChange={(e) => updateField('heightCm', e.target.value)}
            placeholder="170"
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="weightKg">Peso (kg)</Label>
          <Input
            id="weightKg"
            type="number"
            value={formData.weightKg}
            onChange={(e) => updateField('weightKg', e.target.value)}
            placeholder="70"
            className="mt-1"
          />
        </div>
        
        <div>
          <Label>IMC</Label>
          <Input
            value={calculateIMC()}
            disabled
            className="mt-1 bg-muted"
          />
        </div>
        
        <div>
          <Label>Cor de Pele</Label>
          <Select
            value={formData.skinColor || 'none'}
            onValueChange={(val) => updateField('skinColor', val === 'none' ? '' : val)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-</SelectItem>
              {skinColorOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Prioridade</Label>
          <Select
            value={formData.priority || 'none'}
            onValueChange={(val) => updateField('priority', val)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="religion">Religião</Label>
          <Input
            id="religion"
            value={formData.religion}
            onChange={(e) => updateField('religion', e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Linha 5: CEP, Endereço, Número, Bairro */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="cep">CEP</Label>
          <div className="flex gap-1 mt-1">
            <Input
              id="cep"
              value={formData.cep}
              onChange={(e) => updateField('cep', formatCEP(e.target.value))}
              placeholder="00000-000"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onCepLookup}
              disabled={cepLoading}
            >
              {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <div className="col-span-2 sm:col-span-2">
          <Label htmlFor="street">Endereço</Label>
          <Input
            id="street"
            value={formData.street}
            onChange={(e) => updateField('street', e.target.value)}
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="streetNumber">Número</Label>
          <Input
            id="streetNumber"
            value={formData.streetNumber}
            onChange={(e) => updateField('streetNumber', e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Linha 6: Bairro, Cidade, UF, Complemento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input
            id="neighborhood"
            value={formData.neighborhood}
            onChange={(e) => updateField('neighborhood', e.target.value)}
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => updateField('city', e.target.value)}
            className="mt-1"
          />
        </div>
        
        <div>
          <Label>UF</Label>
          <Select
            value={formData.state || 'none'}
            onValueChange={(val) => updateField('state', val === 'none' ? '' : val)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-</SelectItem>
              {stateOptions.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="complement">Complemento</Label>
          <Input
            id="complement"
            value={formData.complement}
            onChange={(e) => updateField('complement', e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Linha 7: TAG, Indicação, Avisos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
        <div>
          <Label htmlFor="tag">TAG</Label>
          <Input
            id="tag"
            value={formData.tag}
            onChange={(e) => updateField('tag', e.target.value)}
            placeholder="Ex: VIP"
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="referral">Indicação</Label>
          <Input
            id="referral"
            value={formData.referral}
            onChange={(e) => updateField('referral', e.target.value)}
            placeholder="Quem indicou?"
            className="mt-1"
          />
        </div>
        
        <div className="flex items-center space-x-2 pb-2">
          <Checkbox
            id="sendNotifications"
            checked={formData.sendNotifications}
            onCheckedChange={(checked) => updateField('sendNotifications', !!checked)}
          />
          <Label htmlFor="sendNotifications" className="text-sm font-normal cursor-pointer">
            Enviar avisos
          </Label>
        </div>
      </div>

      {/* Linha 8: Celular, Telefone, Email, Canal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="phone">Celular *</Label>
          <div className="flex gap-1 mt-1">
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => updateField('phone', formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              className={`flex-1 ${errors.phone ? 'border-destructive' : ''}`}
            />
            {formData.phone && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => openWhatsApp(formData.phone)}
                className="text-success hover:text-success hover:bg-success/10"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
          {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
        </div>
        
        <div>
          <Label htmlFor="landline">Telefone</Label>
          <Input
            id="landline"
            value={formData.landline}
            onChange={(e) => updateField('landline', formatPhone(e.target.value))}
            placeholder="(00) 0000-0000"
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="email@exemplo.com"
            className={`mt-1 ${errors.email ? 'border-destructive' : ''}`}
          />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
        </div>
        
        <div>
          <Label>Canal Preferido</Label>
          <Select
            value={formData.preferredChannel || 'whatsapp'}
            onValueChange={(val) => updateField('preferredChannel', val)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {channelOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Linha 9: Profissão, Escolaridade, CNPJ Empresa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="profession">Profissão</Label>
          <Input
            id="profession"
            value={formData.profession}
            onChange={(e) => updateField('profession', e.target.value)}
            className="mt-1"
          />
        </div>
        
        <div>
          <Label>Escolaridade</Label>
          <Select
            value={formData.education || 'none'}
            onValueChange={(val) => updateField('education', val === 'none' ? '' : val)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">-</SelectItem>
              {educationOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="employerCnpj">CNPJ da Empresa</Label>
          <Input
            id="employerCnpj"
            value={formData.employerCnpj}
            onChange={(e) => updateField('employerCnpj', formatCNPJ(e.target.value))}
            placeholder="00.000.000/0000-00"
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="employerName">Nome da Empresa</Label>
          <Input
            id="employerName"
            value={formData.employerName}
            onChange={(e) => updateField('employerName', e.target.value)}
            placeholder="Razão Social ou Nome Fantasia"
            className="mt-1"
          />
        </div>
      </div>

      {/* Linha 10: Nome da Mãe, Nome do Pai */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="motherName">Nome da Mãe</Label>
          <Input
            id="motherName"
            value={formData.motherName}
            onChange={(e) => updateField('motherName', e.target.value)}
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="fatherName">Nome do Pai</Label>
          <Input
            id="fatherName"
            value={formData.fatherName}
            onChange={(e) => updateField('fatherName', e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Linha 10: Observações */}
      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Informações adicionais sobre o paciente"
          className="mt-1"
          rows={3}
        />
      </div>
    </div>
  );
}