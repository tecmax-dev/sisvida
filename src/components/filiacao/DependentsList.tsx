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
  cpf?: string;
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

  const addDependent = () => {
    if (!newDependent.nome || !newDependent.grau_parentesco || !newDependent.data_nascimento) {
      return;
    }

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
      cpf: newDependent.cpf?.replace(/\D/g, "") || undefined,
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
                <label className="text-xs font-medium text-muted-foreground">CPF</label>
                <Input
                  placeholder="000.000.000-00"
                  value={newDependent.cpf}
                  onChange={(e) => setNewDependent({ ...newDependent, cpf: formatCpf(e.target.value) })}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Mensagem de erro de idade */}
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
                  setNewDependent({ nome: "", grau_parentesco: "", data_nascimento: "", cpf: "" });
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={addDependent}
                disabled={!newDependent.nome || !newDependent.grau_parentesco || !newDependent.data_nascimento}
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
