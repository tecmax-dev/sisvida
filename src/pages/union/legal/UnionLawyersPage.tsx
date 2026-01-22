import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUnionLawyers } from "@/hooks/useUnionLegal";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Users, Edit, Trash2, Loader2, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO"
];

interface LawyerFormData {
  name: string;
  cpf: string;
  oab_number: string;
  oab_state: string;
  email: string;
  phone: string;
  specialty: string;
  hourly_rate: string;
  is_internal: boolean;
}

export default function UnionLawyersPage() {
  const { currentClinic } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLawyer, setEditingLawyer] = useState<string | null>(null);
  const [formData, setFormData] = useState<LawyerFormData>({
    name: "",
    cpf: "",
    oab_number: "",
    oab_state: "",
    email: "",
    phone: "",
    specialty: "",
    hourly_rate: "",
    is_internal: false,
  });

  const { lawyers, isLoading, createLawyer } = useUnionLawyers(currentClinic?.id);

  const filteredLawyers = (lawyers || []).filter((l) =>
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.oab_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.email && l.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const resetForm = () => {
    setFormData({
      name: "",
      cpf: "",
      oab_number: "",
      oab_state: "",
      email: "",
      phone: "",
      specialty: "",
      hourly_rate: "",
      is_internal: false,
    });
    setEditingLawyer(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.oab_number || !formData.oab_state) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    try {
      await createLawyer.mutateAsync({
        clinic_id: currentClinic?.id,
        ...formData,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
      });
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Erro ao salvar advogado");
    }
  };

  const handleEdit = (lawyer: typeof lawyers[0]) => {
    setFormData({
      name: lawyer.name,
      cpf: lawyer.cpf || "",
      oab_number: lawyer.oab_number,
      oab_state: lawyer.oab_state,
      email: lawyer.email || "",
      phone: lawyer.phone || "",
      specialty: lawyer.specialty || "",
      hourly_rate: lawyer.hourly_rate?.toString() || "",
      is_internal: lawyer.is_internal,
    });
    setEditingLawyer(lawyer.id);
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
            <Users className="h-7 w-7 text-purple-500" />
            Advogados
          </h1>
          <p className="text-muted-foreground">
            Cadastro e gestão de advogados
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Advogado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingLawyer ? "Editar Advogado" : "Novo Advogado"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados do advogado
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="oab_number">Número OAB *</Label>
                  <Input
                    id="oab_number"
                    value={formData.oab_number}
                    onChange={(e) => setFormData({ ...formData, oab_number: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="oab_state">Estado OAB *</Label>
                  <Select
                    value={formData.oab_state}
                    onValueChange={(value) => setFormData({ ...formData, oab_state: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BRASIL.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="specialty">Especialidade</Label>
                  <Input
                    id="specialty"
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
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
                <div>
                  <Label htmlFor="hourly_rate">Valor/Hora (R$)</Label>
                  <Input
                    id="hourly_rate"
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_internal"
                    checked={formData.is_internal}
                    onChange={(e) => setFormData({ ...formData, is_internal: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="is_internal">Advogado Interno</Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingLawyer ? "Salvar Alterações" : "Cadastrar"}
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
              placeholder="Buscar por nome, OAB, e-mail..."
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
          ) : filteredLawyers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum advogado encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>OAB</TableHead>
                    <TableHead>Especialidade</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Valor/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLawyers.map((lawyer) => (
                    <TableRow key={lawyer.id}>
                      <TableCell className="font-medium">{lawyer.name}</TableCell>
                      <TableCell>
                        <span className="font-mono">
                          {lawyer.oab_number}/{lawyer.oab_state}
                        </span>
                      </TableCell>
                      <TableCell>{lawyer.specialty || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {lawyer.email && (
                            <span className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {lawyer.email}
                            </span>
                          )}
                          {lawyer.phone && (
                            <span className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {lawyer.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(lawyer.hourly_rate)}</TableCell>
                      <TableCell>
                        <Badge variant={lawyer.is_internal ? "default" : "outline"}>
                          {lawyer.is_internal ? "Interno" : "Externo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={lawyer.is_active ? "default" : "secondary"}>
                          {lawyer.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(lawyer)}
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
