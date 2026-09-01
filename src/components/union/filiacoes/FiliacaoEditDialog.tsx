import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, X, User, Building2, MapPin, Phone } from "lucide-react";

interface FiliacaoEditData {
  id: string;
  nome: string;
  cpf: string;
  rg?: string | null;
  data_nascimento: string;
  sexo?: string | null;
  estado_civil?: string | null;
  nome_pai?: string | null;
  nome_mae?: string | null;
  email: string;
  telefone: string;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cargo?: string | null;
  data_admissao?: string | null;
  empresa_razao_social?: string | null;
  empresa_cnpj?: string | null;
  empresa_nome_fantasia?: string | null;
  empresa_endereco?: string | null;
  empresa_matricula?: string | null;
  forma_pagamento?: string | null;
  observacoes?: string | null;
  status: string;
}

interface Props {
  filiacaoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function FiliacaoEditDialog({ filiacaoId, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<FiliacaoEditData>>({});

  useEffect(() => {
    if (!open || !filiacaoId) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("sindical_associados")
          .select("id, nome, cpf, rg, data_nascimento, sexo, estado_civil, nome_pai, nome_mae, email, telefone, cep, logradouro, numero, complemento, bairro, cidade, uf, cargo, data_admissao, empresa_razao_social, empresa_cnpj, empresa_nome_fantasia, empresa_endereco, empresa_matricula, forma_pagamento, observacoes, status")
          .eq("id", filiacaoId)
          .single();

        if (error) throw error;
        if (!cancelled) setForm(data);
      } catch (err) {
        console.error("Error fetching filiacao for edit:", err);
        toast({ title: "Erro ao carregar dados", variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchData();
    return () => { cancelled = true; };
  }, [open, filiacaoId, toast]);

  const handleChange = (field: string, value: string | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!filiacaoId || !form.nome?.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        nome: form.nome?.trim(),
        rg: form.rg?.trim() || null,
        data_nascimento: form.data_nascimento || null,
        sexo: form.sexo || null,
        estado_civil: form.estado_civil || null,
        nome_pai: form.nome_pai?.trim() || null,
        nome_mae: form.nome_mae?.trim() || null,
        email: form.email?.trim() || "",
        telefone: form.telefone?.trim() || "",
        cep: form.cep?.trim() || null,
        logradouro: form.logradouro?.trim() || null,
        numero: form.numero?.trim() || null,
        complemento: form.complemento?.trim() || null,
        bairro: form.bairro?.trim() || null,
        cidade: form.cidade?.trim() || null,
        uf: form.uf?.trim() || null,
        cargo: form.cargo?.trim() || null,
        data_admissao: form.data_admissao || null,
        empresa_razao_social: form.empresa_razao_social?.trim() || null,
        empresa_cnpj: form.empresa_cnpj?.trim() || null,
        empresa_nome_fantasia: form.empresa_nome_fantasia?.trim() || null,
        empresa_endereco: form.empresa_endereco?.trim() || null,
        empresa_matricula: form.empresa_matricula?.trim() || null,
        forma_pagamento: form.forma_pagamento || null,
        observacoes: form.observacoes?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data: updated, error } = await supabase
        .from("sindical_associados")
        .update(updateData as any)
        .eq("id", filiacaoId)
        .select("id")
        .maybeSingle();

      if (error) throw error;

      if (!updated) {
        toast({ title: "Nenhum registro foi atualizado", description: "Verifique suas permissões de acesso.", variant: "destructive" });
        return;
      }

      toast({ title: "Filiação atualizada com sucesso!" });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error updating filiacao:", err);
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) setForm({});
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Editar Filiação
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Dados Pessoais */}
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-blue-500" />
                  Dados Pessoais
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label>Nome Completo *</Label>
                    <Input value={form.nome || ""} onChange={(e) => handleChange("nome", e.target.value)} />
                  </div>
                  <div>
                    <Label>CPF</Label>
                    <Input value={form.cpf || ""} disabled className="bg-muted" />
                  </div>
                  <div>
                    <Label>RG</Label>
                    <Input value={form.rg || ""} onChange={(e) => handleChange("rg", e.target.value)} />
                  </div>
                  <div>
                    <Label>Data Nascimento</Label>
                    <Input type="date" value={form.data_nascimento || ""} onChange={(e) => handleChange("data_nascimento", e.target.value)} />
                  </div>
                  <div>
                    <Label>Sexo</Label>
                    <Select value={form.sexo || ""} onValueChange={(v) => handleChange("sexo", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Masculino">Masculino</SelectItem>
                        <SelectItem value="Feminino">Feminino</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Estado Civil</Label>
                    <Select value={form.estado_civil || ""} onValueChange={(v) => handleChange("estado_civil", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                        <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                        <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                        <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                        <SelectItem value="União Estável">União Estável</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nome do Pai</Label>
                    <Input value={form.nome_pai || ""} onChange={(e) => handleChange("nome_pai", e.target.value)} />
                  </div>
                  <div>
                    <Label>Nome da Mãe</Label>
                    <Input value={form.nome_mae || ""} onChange={(e) => handleChange("nome_mae", e.target.value)} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contato */}
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Phone className="h-4 w-4 text-green-500" />
                  Contato
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>E-mail</Label>
                    <Input type="email" value={form.email || ""} onChange={(e) => handleChange("email", e.target.value)} />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input value={form.telefone || ""} onChange={(e) => handleChange("telefone", e.target.value)} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Endereço */}
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4 text-red-500" />
                  Endereço
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <Label>CEP</Label>
                    <Input value={form.cep || ""} onChange={(e) => handleChange("cep", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label>Logradouro</Label>
                    <Input value={form.logradouro || ""} onChange={(e) => handleChange("logradouro", e.target.value)} />
                  </div>
                  <div>
                    <Label>Número</Label>
                    <Input value={form.numero || ""} onChange={(e) => handleChange("numero", e.target.value)} />
                  </div>
                  <div>
                    <Label>Complemento</Label>
                    <Input value={form.complemento || ""} onChange={(e) => handleChange("complemento", e.target.value)} />
                  </div>
                  <div>
                    <Label>Bairro</Label>
                    <Input value={form.bairro || ""} onChange={(e) => handleChange("bairro", e.target.value)} />
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input value={form.cidade || ""} onChange={(e) => handleChange("cidade", e.target.value)} />
                  </div>
                  <div>
                    <Label>UF</Label>
                    <Input value={form.uf || ""} maxLength={2} onChange={(e) => handleChange("uf", e.target.value.toUpperCase())} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Dados da Empresa */}
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-amber-500" />
                  Dados da Empresa
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Razão Social</Label>
                    <Input value={form.empresa_razao_social || ""} onChange={(e) => handleChange("empresa_razao_social", e.target.value)} />
                  </div>
                  <div>
                    <Label>CNPJ</Label>
                    <Input value={form.empresa_cnpj || ""} onChange={(e) => handleChange("empresa_cnpj", e.target.value)} />
                  </div>
                  <div>
                    <Label>Nome Fantasia</Label>
                    <Input value={form.empresa_nome_fantasia || ""} onChange={(e) => handleChange("empresa_nome_fantasia", e.target.value)} />
                  </div>
                  <div>
                    <Label>Cargo/Função</Label>
                    <Input value={form.cargo || ""} onChange={(e) => handleChange("cargo", e.target.value)} />
                  </div>
                  <div>
                    <Label>Data Admissão</Label>
                    <Input type="date" value={form.data_admissao || ""} onChange={(e) => handleChange("data_admissao", e.target.value)} />
                  </div>
                  <div>
                    <Label>Matrícula</Label>
                    <Input value={form.empresa_matricula || ""} onChange={(e) => handleChange("empresa_matricula", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label>Endereço da Empresa</Label>
                    <Input value={form.empresa_endereco || ""} onChange={(e) => handleChange("empresa_endereco", e.target.value)} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Observações */}
              <div>
                <Label>Observações</Label>
                <textarea
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
                  value={form.observacoes || ""}
                  onChange={(e) => handleChange("observacoes", e.target.value)}
                  maxLength={2000}
                />
              </div>
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={saving}>
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
