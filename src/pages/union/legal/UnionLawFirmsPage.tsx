import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUnionLawFirms } from "@/hooks/useUnionLegal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Building2, Edit, Trash2, Loader2, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";

interface LawFirmFormData {
  name: string;
  cnpj: string;
  oab_number: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  cep: string;
  contract_value: string;
  notes: string;
}

export default function UnionLawFirmsPage() {
  const { currentClinic } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFirm, setEditingFirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<LawFirmFormData>({
    name: "",
    cnpj: "",
    oab_number: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    cep: "",
    contract_value: "",
    notes: "",
  });

  const { lawFirms, isLoading, createLawFirm } = useUnionLawFirms(currentClinic?.id);

  const filteredFirms = (lawFirms || []).filter((f) => {
    const searchLower = searchTerm.toLowerCase();
    const searchClean = searchTerm.replace(/\D/g, "");
    const cnpjClean = f.cnpj?.replace(/\D/g, "") || "";
    const cnpjNoLeadingZeros = cnpjClean.replace(/^0+/, "");
    const searchNoLeadingZeros = searchClean.replace(/^0+/, "");
    
    return (
      f.name.toLowerCase().includes(searchLower) ||
      (searchClean.length >= 2 && cnpjClean.includes(searchClean)) ||
      (searchNoLeadingZeros.length >= 2 && cnpjNoLeadingZeros.includes(searchNoLeadingZeros)) ||
      (f.email && f.email.toLowerCase().includes(searchLower))
    );
  });

  const resetForm = () => {
    setFormData({
      name: "",
      cnpj: "",
      oab_number: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      cep: "",
      contract_value: "",
      notes: "",
    });
    setEditingFirm(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error("Informe o nome do escritório");
      return;
    }

    try {
      await createLawFirm.mutateAsync({
        clinic_id: currentClinic?.id,
        ...formData,
        contract_value: formData.contract_value ? parseFloat(formData.contract_value) : null,
      });
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Erro ao salvar escritório");
    }
  };

  const handleEdit = (firm: typeof lawFirms[0]) => {
    setFormData({
      name: firm.name,
      cnpj: firm.cnpj || "",
      oab_number: firm.oab_number || "",
      email: firm.email || "",
      phone: firm.phone || "",
      address: firm.address || "",
      city: firm.city || "",
      state: firm.state || "",
      cep: firm.cep || "",
      contract_value: firm.contract_value?.toString() || "",
      notes: firm.notes || "",
    });
    setEditingFirm(firm.id);
    setIsDialogOpen(true);
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-7 w-7 text-amber-500" />
            Escritórios de Advocacia
          </h1>
          <p className="text-muted-foreground">
            Gestão de escritórios parceiros
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Escritório
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingFirm ? "Editar Escritório" : "Novo Escritório"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados do escritório de advocacia
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Nome do Escritório *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="oab_number">Número OAB</Label>
                  <Input
                    id="oab_number"
                    value={formData.oab_number}
                    onChange={(e) => setFormData({ ...formData, oab_number: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                  <Input
                    id="state"
                    maxLength={2}
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="contract_value">Valor do Contrato (R$)</Label>
                  <Input
                    id="contract_value"
                    type="number"
                    step="0.01"
                    value={formData.contract_value}
                    onChange={(e) => setFormData({ ...formData, contract_value: e.target.value })}
                  />
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
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingFirm ? "Salvar Alterações" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CNPJ, e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFirms.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum escritório encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>OAB</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Valor Contrato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFirms.map((firm) => (
                    <TableRow key={firm.id}>
                      <TableCell className="font-medium">{firm.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {firm.cnpj || "-"}
                      </TableCell>
                      <TableCell>{firm.oab_number || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {firm.email && (
                            <span className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {firm.email}
                            </span>
                          )}
                          {firm.phone && (
                            <span className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {firm.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {firm.city && firm.state ? (
                          <span className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3" />
                            {firm.city}/{firm.state}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(firm.contract_value)}</TableCell>
                      <TableCell>
                        <Badge variant={firm.is_active ? "default" : "secondary"}>
                          {firm.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(firm)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
