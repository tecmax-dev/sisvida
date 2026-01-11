import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Receipt, 
  Building2, 
  Users, 
  FileSpreadsheet,
  CheckCircle2,
  CircleDollarSign,
  XCircle,
  Clock,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ConversionType = 
  | 'contributions_paid' 
  | 'contributions_pending' 
  | 'contributions_cancelled'
  | 'cadastro_pf'
  | 'cadastro_pj'
  | 'cadastro_fornecedores'
  | 'lytex';

export type ConversionSubType = 
  | 'invoices'
  | 'clients'
  | 'financial'
  | 'payments'
  | 'overdue';

interface ConversionTypeStepProps {
  selectedType: ConversionType | null;
  selectedSubType: ConversionSubType | null;
  onTypeSelect: (type: ConversionType, subType?: ConversionSubType) => void;
}

interface TypeOption {
  type: ConversionType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  subTypes?: { key: ConversionSubType; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const TYPE_OPTIONS: TypeOption[] = [
  {
    type: 'contributions_paid',
    title: 'Contribuições Pagas',
    description: 'Importar pagamentos confirmados de contribuições sindicais',
    icon: CheckCircle2,
    color: 'text-green-500 bg-green-500/10 border-green-500/30',
  },
  {
    type: 'contributions_pending',
    title: 'Contribuições Pendentes',
    description: 'Importar contribuições em aberto ou a vencer',
    icon: Clock,
    color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
  },
  {
    type: 'contributions_cancelled',
    title: 'Contribuições Canceladas',
    description: 'Importar contribuições canceladas ou estornadas',
    icon: XCircle,
    color: 'text-red-500 bg-red-500/10 border-red-500/30',
  },
  {
    type: 'cadastro_pf',
    title: 'Cadastro Pessoa Física',
    description: 'Importar dados de pessoas físicas (associados, pacientes)',
    icon: Users,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  },
  {
    type: 'cadastro_pj',
    title: 'Cadastro Pessoa Jurídica',
    description: 'Importar dados de empresas (empregadores)',
    icon: Building2,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
  },
  {
    type: 'cadastro_fornecedores',
    title: 'Cadastro de Fornecedores',
    description: 'Importar fornecedores do módulo financeiro',
    icon: Truck,
    color: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
  },
  {
    type: 'lytex',
    title: 'Relatórios Lytex',
    description: 'Conversão automática de relatórios do sistema Lytex',
    icon: FileSpreadsheet,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    subTypes: [
      { key: 'invoices', label: 'Faturas/Cobranças', icon: Receipt },
      { key: 'clients', label: 'Clientes/Empresas', icon: Building2 },
      { key: 'financial', label: 'Extrato Financeiro', icon: CircleDollarSign },
      { key: 'payments', label: 'Pagamentos', icon: CheckCircle2 },
      { key: 'overdue', label: 'Inadimplência', icon: Clock },
    ],
  },
];

export function ConversionTypeStep({
  selectedType,
  selectedSubType,
  onTypeSelect,
}: ConversionTypeStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Tipo de Conversão</h3>
        <p className="text-sm text-muted-foreground">
          Selecione o tipo de dados que deseja converter para o formato do sistema
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.type;

          return (
            <Card
              key={option.type}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary shadow-md",
                !isSelected && "hover:border-primary/50"
              )}
              onClick={() => onTypeSelect(option.type)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg border", option.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{option.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{option.description}</CardDescription>
                
                {isSelected && option.subTypes && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Tipo de relatório:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {option.subTypes.map((subType) => {
                        const SubIcon = subType.icon;
                        return (
                          <Badge
                            key={subType.key}
                            variant={selectedSubType === subType.key ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTypeSelect(option.type, subType.key);
                            }}
                          >
                            <SubIcon className="h-3 w-3 mr-1" />
                            {subType.label}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedType && (
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>
                Selecionado: <strong>{TYPE_OPTIONS.find(o => o.type === selectedType)?.title}</strong>
                {selectedSubType && (
                  <>
                    {' → '}
                    <Badge variant="secondary">{selectedSubType}</Badge>
                  </>
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
