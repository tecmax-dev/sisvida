import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CnpjInputCard } from "@/components/ui/cnpj-input-card";
import { useCnpjLookup } from "@/hooks/useCnpjLookup";

interface UnionSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: any | null;
  clinicId: string;
  onSuccess: () => void;
}

const STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export function UnionSupplierDialog({
  open,
  onOpenChange,
  supplier,
  clinicId,
  onSuccess,
}: UnionSupplierDialogProps) {
  const [loading, setLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const { lookupCnpj, cnpjLoading } = useCnpjLookup();
  
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    contact_name: "",
    notes: "",
    is_active: true,
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || "",
        cnpj: supplier.cnpj || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
        address: supplier.address || "",
        city: supplier.city || "",
        state: supplier.state || "",
        contact_name: supplier.contact_name || "",
        notes: supplier.notes || "",
        is_active: supplier.is_active ?? true,
      });
    } else {
      setFormData({
        name: "",
        cnpj: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        contact_name: "",
        notes: "",
        is_active: true,
      });
    }
    setCnpjError(null);
  }, [supplier, open]);

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4,5})(\d{4})$/, "$1-$2")
      .slice(0, 15);
  };

  const checkCnpjDuplicate = async (cnpj: string): Promise<{ id: string; name: string } | null> => {
    if (!cnpj || cnpj.replace(/\D/g, "").length !== 14) return null;
    
    const { data: existing } = await supabase
      .from("union_suppliers")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .eq("cnpj", cnpj)
      .neq("id", supplier?.id || "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    
    return existing;
  };

  const handleCnpjLookup = async () => {
    if (!formData.cnpj || formData.cnpj.replace(/\D/g, "").length !== 14) {
      toast.error("Digite um CNPJ válido com 14 dígitos");
      return;
    }

    const existing = await checkCnpjDuplicate(formData.cnpj);
    if (existing) {
      setCnpjError(`CNPJ já cadastrado para: ${existing.name}`);
      return;
    }
    
    setCnpjError(null);
    
    const data = await lookupCnpj(formData.cnpj);
    if (data) {
      setFormData((prev) => ({
        ...prev,
        name: data.razao_social || data.nome_fantasia || prev.name,
        email: data.email || prev.email,
        phone: data.telefone ? formatPhone(data.telefone) : prev.phone,
        address: data.logradouro && data.numero 
          ? `${data.logradouro}, ${data.numero}${data.bairro ? ` - ${data.bairro}` : ""}` 
          : prev.address,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return;

    if (formData.cnpj && formData.cnpj.replace(/\D/g, "").length === 14) {
      const existing = await checkCnpjDuplicate(formData.cnpj);
      if (existing) {
        setCnpjError(`CNPJ já cadastrado para: ${existing.name}`);
        toast.error(`CNPJ já cadastrado para: ${existing.name}`);
        return;
      }
    }

    setLoading(true);
    try {
      const data = {
        clinic_id: clinicId,
        name: formData.name,
        cnpj: formData.cnpj || null,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        contact_name: formData.contact_name || null,
        notes: formData.notes || null,
        is_active: formData.is_active,
      };

      if (supplier) {
        const { error } = await supabase
          .from("union_suppliers")
          .update(data)
          .eq("id", supplier.id);
        if (error) throw error;
        toast.success("Fornecedor atualizado com sucesso");
      } else {
        const { error } = await supabase.from("union_suppliers").insert(data);
        if (error) throw error;
        toast.success("Fornecedor criado com sucesso");
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao salvar fornecedor");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="2xl">
      <PopupHeader>
        <PopupTitle>
          {supplier ? "Editar Fornecedor" : "Novo Fornecedor"}
        </PopupTitle>
        <PopupDescription>
          Cadastre fornecedores para vinculação às despesas sindicais
        </PopupDescription>
      </PopupHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <CnpjInputCard
              value={formData.cnpj}
              onChange={(value) => {
                setFormData({ ...formData, cnpj: value });
                setCnpjError(null);
              }}
              onLookup={handleCnpjLookup}
              loading={cnpjLoading}
              error={cnpjError || undefined}
              showLookupButton={true}
              label="CNPJ do Fornecedor"
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="name">Razão Social / Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="contact_name">Nome do Contato</Label>
            <Input
              id="contact_name"
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="state">Estado</Label>
            <Select
              value={formData.state}
              onValueChange={(value) => setFormData({ ...formData, state: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Fornecedor ativo</Label>
          </div>
        </div>

        <PopupFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || cnpjLoading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </PopupFooter>
      </form>
    </PopupBase>
  );
}
