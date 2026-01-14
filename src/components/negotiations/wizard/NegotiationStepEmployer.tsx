import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Building2 } from "lucide-react";
import { CnpjInputCard } from "@/components/ui/cnpj-input-card";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name: string | null;
  registration_number?: string | null;
}

interface NegotiationStepEmployerProps {
  employers: Employer[];
  selectedEmployer: Employer | null;
  onSelectEmployer: (employer: Employer) => void;
}

export default function NegotiationStepEmployer({
  employers,
  selectedEmployer,
  onSelectEmployer,
}: NegotiationStepEmployerProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredEmployers = employers.filter((emp) => {
    if (!searchTerm.trim()) return true;
    
    const searchLower = searchTerm.toLowerCase().trim();
    const searchClean = searchTerm.replace(/\D/g, "");
    
    // Name match
    if (emp.name.toLowerCase().includes(searchLower)) return true;
    
    // Trade name match
    if (emp.trade_name?.toLowerCase().includes(searchLower)) return true;
    
    // CNPJ match (both sides normalized)
    const cnpjClean = emp.cnpj?.replace(/\D/g, "") || "";
    if (searchClean.length >= 3 && cnpjClean.includes(searchClean)) return true;
    
    // Registration number match
    if (emp.registration_number?.toLowerCase().includes(searchLower)) return true;
    
    return false;
  });

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CNPJ ou matrícula..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="max-h-[400px] overflow-y-auto space-y-2">
        <RadioGroup
          value={selectedEmployer?.id || ""}
          onValueChange={(value) => {
            const employer = employers.find((e) => e.id === value);
            if (employer) onSelectEmployer(employer);
          }}
        >
          {filteredEmployers.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma empresa encontrada</p>
              </CardContent>
            </Card>
          ) : (
            filteredEmployers.map((employer) => (
              <Card
                key={employer.id}
                className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                  selectedEmployer?.id === employer.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => onSelectEmployer(employer)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <RadioGroupItem value={employer.id} id={employer.id} />
                  <Label htmlFor={employer.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{employer.name}</p>
                      {employer.registration_number && (
                        <Badge variant="outline" className="text-xs font-mono">
                          Mat. {employer.registration_number}
                        </Badge>
                      )}
                    </div>
                    {employer.trade_name && (
                      <p className="text-sm text-muted-foreground">{employer.trade_name}</p>
                    )}
                    <p className="text-xs text-muted-foreground font-mono">
                      {formatCNPJ(employer.cnpj)}
                    </p>
                  </Label>
                </CardContent>
              </Card>
            ))
          )}
        </RadioGroup>
      </div>
    </div>
  );
}
