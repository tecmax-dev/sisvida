import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  UserPlus,
  Link2,
  Loader2,
  User,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface UnionMemberLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface PatientSearchResult {
  id: string;
  name: string;
  cpf: string | null;
  phone: string;
  email: string | null;
  is_union_member: boolean;
}

interface Category {
  id: string;
  nome: string;
  valor_contribuicao: number;
}

export function UnionMemberLinkDialog({
  open,
  onOpenChange,
  onSuccess,
}: UnionMemberLinkDialogProps) {
  const navigate = useNavigate();
  const { currentClinic, user } = useAuth();
  const { toast } = useToast();

  const [mode, setMode] = useState<"search" | "create">("search");
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  // Union member form fields
  const [unionStatus, setUnionStatus] = useState("pendente");
  const [unionCategoryId, setUnionCategoryId] = useState("");
  const [unionContribution, setUnionContribution] = useState("");
  const [unionObservations, setUnionObservations] = useState("");

  useEffect(() => {
    if (open && currentClinic) {
      fetchCategories();
    }
  }, [open, currentClinic]);

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setMode("search");
      setSearchTerm("");
      setSearchResults([]);
      setSelectedPatient(null);
      setUnionStatus("pendente");
      setUnionCategoryId("");
      setUnionContribution("");
      setUnionObservations("");
    }
  }, [open]);

  const fetchCategories = async () => {
    if (!currentClinic) return;
    
    // Use explicit typing to avoid deep type instantiation error
    const query = supabase.from("sindical_categorias" as any);
    const { data, error } = await query
      .select("id, nome, valor_contribuicao")
      .eq("sindicato_id", currentClinic.id)
      .eq("ativo", true)
      .order("nome");
    
    if (!error && data) {
      setCategories(data as unknown as Category[]);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim() || !currentClinic) return;
    
    setSearching(true);
    try {
      const trimmedSearch = searchTerm.trim();
      const cleanedDigits = trimmedSearch.replace(/\D/g, "");

      let query = supabase
        .from("patients")
        .select("id, name, cpf, phone, email, is_union_member")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .limit(20);

      // Build OR conditions for flexible search
      const orConditions: string[] = [];
      orConditions.push(`name.ilike.%${trimmedSearch}%`);
      
      if (cleanedDigits.length >= 3) {
        orConditions.push(`cpf.ilike.%${cleanedDigits}%`);
        orConditions.push(`phone.ilike.%${cleanedDigits}%`);
      }

      if (trimmedSearch.includes("@")) {
        orConditions.push(`email.ilike.%${trimmedSearch}%`);
      }

      if (orConditions.length > 0) {
        query = query.or(orConditions.join(","));
      }

      const { data, error } = await query.order("name");

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error("Search error:", error);
      toast({ title: "Erro na busca", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPatient = (patient: PatientSearchResult) => {
    if (patient.is_union_member) {
      toast({
        title: "Paciente já é associado",
        description: "Este paciente já está vinculado como associado sindical.",
        variant: "destructive",
      });
      return;
    }
    setSelectedPatient(patient);
  };

  const handleCategoryChange = (categoryId: string) => {
    setUnionCategoryId(categoryId);
    const category = categories.find((c) => c.id === categoryId);
    if (category) {
      setUnionContribution(category.valor_contribuicao.toFixed(2));
    }
  };

  const handleLinkMember = async () => {
    if (!selectedPatient || !currentClinic || !user) return;

    setSaving(true);
    try {
      // Update patient with union member fields
      const { error: updateError } = await supabase
        .from("patients")
        .update({
          is_union_member: true,
          union_member_status: unionStatus,
          union_category_id: unionCategoryId || null,
          union_joined_at: new Date().toISOString(),
          union_contribution_value: unionContribution ? parseFloat(unionContribution) : 0,
          union_observations: unionObservations || null,
        })
        .eq("id", selectedPatient.id);

      if (updateError) throw updateError;

      // Log the action
      await supabase.from("union_member_audit_logs").insert({
        clinic_id: currentClinic.id,
        patient_id: selectedPatient.id,
        action: "link",
        new_values: {
          is_union_member: true,
          union_member_status: unionStatus,
          union_category_id: unionCategoryId,
          union_contribution_value: unionContribution,
        },
        performed_by: user.id,
        module_origin: "sindical",
      });

      toast({ title: "Associado vinculado com sucesso!" });
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error linking member:", error);
      toast({
        title: "Erro ao vincular associado",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNew = () => {
    // Navigate to patient creation page with union context
    navigate("/union/socios/novo?from=union");
    onOpenChange(false);
  };

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return "";
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-purple-500" />
            Incluir Novo Associado
          </DialogTitle>
          <DialogDescription>
            Vincule um paciente existente ou crie um novo cadastro como associado sindical.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {!selectedPatient ? (
            <div className="space-y-4">
              {/* Mode Selection */}
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as "search" | "create")}
                className="grid grid-cols-2 gap-4"
              >
                <Label
                  htmlFor="mode-search"
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    mode === "search" ? "border-primary bg-primary/5" : "hover:bg-muted"
                  }`}
                >
                  <RadioGroupItem value="search" id="mode-search" />
                  <div>
                    <p className="font-medium">Vincular Existente</p>
                    <p className="text-xs text-muted-foreground">
                      Buscar paciente cadastrado
                    </p>
                  </div>
                </Label>
                <Label
                  htmlFor="mode-create"
                  className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    mode === "create" ? "border-primary bg-primary/5" : "hover:bg-muted"
                  }`}
                >
                  <RadioGroupItem value="create" id="mode-create" />
                  <div>
                    <p className="font-medium">Novo Cadastro</p>
                    <p className="text-xs text-muted-foreground">
                      Criar paciente + associado
                    </p>
                  </div>
                </Label>
              </RadioGroup>

              {mode === "search" ? (
                <div className="space-y-4">
                  {/* Search Input */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nome, CPF, telefone ou e-mail..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="pl-10"
                      />
                    </div>
                    <Button onClick={handleSearch} disabled={searching || !searchTerm.trim()}>
                      {searching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Buscar"
                      )}
                    </Button>
                  </div>

                  {/* Search Results */}
                  <ScrollArea className="h-[300px] border rounded-lg">
                    {searchResults.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6">
                        <Search className="h-10 w-10 text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground">
                          {searchTerm
                            ? "Nenhum paciente encontrado"
                            : "Digite para buscar pacientes"}
                        </p>
                      </div>
                    ) : (
                      <div className="p-2 space-y-2">
                        {searchResults.map((patient) => (
                          <div
                            key={patient.id}
                            onClick={() => handleSelectPatient(patient)}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              patient.is_union_member
                                ? "bg-muted/50 opacity-60 cursor-not-allowed"
                                : "hover:bg-muted"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{patient.name}</span>
                                  {patient.is_union_member && (
                                    <Badge variant="secondary" className="text-xs">
                                      Já é associado
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                                  {patient.cpf && (
                                    <span>CPF: {formatCPF(patient.cpf)}</span>
                                  )}
                                  {patient.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {patient.phone}
                                    </span>
                                  )}
                                  {patient.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      {patient.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {!patient.is_union_member && (
                                <Button variant="ghost" size="sm">
                                  <Link2 className="h-4 w-4 mr-1" />
                                  Vincular
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <UserPlus className="h-12 w-12 text-primary/50 mb-4" />
                  <h3 className="font-medium mb-2">Criar Novo Cadastro</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Você será redirecionado para o formulário completo de cadastro
                  </p>
                  <Button onClick={handleCreateNew}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Iniciar Cadastro
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {/* Selected Patient Info */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-full bg-emerald-500/20">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedPatient.name}</p>
                      <p className="text-sm text-muted-foreground">
                        CPF: {formatCPF(selectedPatient.cpf) || "Não informado"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPatient(null)}
                  >
                    Alterar seleção
                  </Button>
                </div>

                <Separator />

                {/* Union Member Fields */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Dados Sindicais</h4>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Status da Filiação</Label>
                      <Select value={unionStatus} onValueChange={setUnionStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="inativo">Inativo</SelectItem>
                          <SelectItem value="suspenso">Suspenso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select value={unionCategoryId} onValueChange={handleCategoryChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.nome} - R$ {cat.valor_contribuicao.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Valor da Contribuição (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={unionContribution}
                        onChange={(e) => setUnionContribution(e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={unionObservations}
                      onChange={(e) => setUnionObservations(e.target.value)}
                      placeholder="Observações sobre a filiação..."
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>

        {selectedPatient && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleLinkMember} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Vinculando...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Vincular como Associado
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
