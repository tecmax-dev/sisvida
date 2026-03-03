import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Users } from "lucide-react";

export interface Dependent {
  id: string;
  nome: string;
  grau_parentesco: string;
  data_nascimento: string;
  cpf: string;
}

interface ParentescoOption {
  value: string;
  label: string;
}

interface DependentsListProps {
  dependents: Dependent[];
  onChange: (dependents: Dependent[]) => void;
  allowedRelationshipTypes?: string[] | null;
}

// Lista de opções de parentesco (apenas tipos permitidos)
const ALL_PARENTESCO_OPTIONS: ParentescoOption[] = [
  { value: "esposo", label: "Esposo" },
  { value: "esposa", label: "Esposa" },
  { value: "conjuge", label: "Cônjuge" },
  { value: "filho", label: "Filho(a) - até 21 anos" },
  { value: "pai", label: "Pai" },
  { value: "mae", label: "Mãe" },
];

// Função para calcular idade a partir da data de nascimento
const calculateAge = (birthDate: string): number => {
  const today = new Date();
  const birth = new Date(birthDate + "T12:00:00");
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

const formatCpf = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  return numbers
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2");
};

// Validação de CPF brasileiro
const isValidCPF = (cpf: string): boolean => {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(cleaned[10]);
};

export function DependentsList({ dependents, onChange, allowedRelationshipTypes }: DependentsListProps) {
  const [showForm, setShowForm] = useState(false);
  const [newDependent, setNewDependent] = useState<Partial<Dependent>>({
    nome: "",
    grau_parentesco: "",
    data_nascimento: "",
    cpf: "",
  });

  // Filtrar opções de parentesco com base na configuração da entidade
  const parentescoOptions = allowedRelationshipTypes && allowedRelationshipTypes.length > 0
    ? ALL_PARENTESCO_OPTIONS.filter(opt => allowedRelationshipTypes.includes(opt.value))
    : ALL_PARENTESCO_OPTIONS;

  const [ageError, setAgeError] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);

  const addDependent = () => {
    if (!newDependent.nome || !newDependent.grau_parentesco || !newDependent.data_nascimento) {
      return;
    }

    // Validação de CPF obrigatório
    const cleanCpf = newDependent.cpf?.replace(/\D/g, "") || "";
    if (!cleanCpf) {
      setCpfError("CPF é obrigatório.");
      return;
    }

    // Validação de CPF válido
    if (!isValidCPF(cleanCpf)) {
      setCpfError("CPF inválido.");
      return;
    }

    // Validação de duplicidade de CPF na lista
    const isDuplicate = dependents.some(
      (d) => d.cpf.replace(/\D/g, "") === cleanCpf
    );
    if (isDuplicate) {
      setCpfError("Este CPF já foi adicionado na lista de dependentes.");
      return;
    }

    setCpfError(null);

    // Validação de idade para filhos (até 21 anos)
    if (newDependent.grau_parentesco === "filho") {
      const age = calculateAge(newDependent.data_nascimento);
      if (age > 21) {
        setAgeError("Filhos devem ter até 21 anos de idade.");
        return;
      }
    }

    setAgeError(null);

    const dependent: Dependent = {
      id: crypto.randomUUID(),
      nome: newDependent.nome,
      grau_parentesco: newDependent.grau_parentesco,
      data_nascimento: newDependent.data_nascimento,
      cpf: cleanCpf,
    };

    onChange([...dependents, dependent]);
    setNewDependent({ nome: "", grau_parentesco: "", data_nascimento: "", cpf: "" });
    setShowForm(false);
  };

  const removeDependent = (id: string) => {
    onChange(dependents.filter((d) => d.id !== id));
  };

  const getParentescoLabel = (value: string) => {
    return ALL_PARENTESCO_OPTIONS.find((opt) => opt.value === value)?.label || value;
  };

  return (
    <div className="space-y-4">
      {/* Lista de dependentes */}
      {dependents.length > 0 && (
        <div className="space-y-2">
          {dependents.map((dep) => (
            <Card key={dep.id} className="bg-muted border-border">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{dep.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {getParentescoLabel(dep.grau_parentesco)} • 
                        {new Date(dep.data_nascimento + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDependent(dep.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Formulário de adição */}
      {showForm ? (
        <Card className="border-dashed border-2 border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Novo Dependente</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Nome do dependente"
                  value={newDependent.nome}
                  onChange={(e) => setNewDependent({ ...newDependent, nome: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Grau de Parentesco <span className="text-red-500">*</span>
                </label>
                <Select
                  value={newDependent.grau_parentesco}
                  onValueChange={(value) => setNewDependent({ ...newDependent, grau_parentesco: value })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {parentescoOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Data de Nascimento <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={newDependent.data_nascimento}
                  onChange={(e) => setNewDependent({ ...newDependent, data_nascimento: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  CPF <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="000.000.000-00"
                  value={newDependent.cpf}
                  onChange={(e) => {
                    setNewDependent({ ...newDependent, cpf: formatCpf(e.target.value) });
                    setCpfError(null);
                  }}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Mensagens de erro */}
            {cpfError && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded-md">
                ⚠️ {cpfError}
              </p>
            )}
            {ageError && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded-md">
                ⚠️ {ageError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setAgeError(null);
                  setCpfError(null);
                  setNewDependent({ nome: "", grau_parentesco: "", data_nascimento: "", cpf: "" });
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={addDependent}
                disabled={!newDependent.nome || !newDependent.grau_parentesco || !newDependent.data_nascimento || !newDependent.cpf}
              >
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Dependente
        </Button>
      )}
    </div>
  );
}
