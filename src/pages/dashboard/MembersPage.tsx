import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin,
  Loader2,
  FileText,
  RefreshCw,
  Key
} from "lucide-react";
import { format } from "date-fns";

interface Member {
  id: string;
  name: string;
  cpf: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  neighborhood: string | null;
  birth_date: string | null;
  notes: string | null;
  is_active: boolean;
  access_code: string | null;
  access_code_expires_at: string | null;
  portal_last_access_at: string | null;
  created_at: string;
}

export default function MembersPage() {
  const { currentClinic } = useAuth();
  const clinicId = currentClinic?.id;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    cep: "",
    neighborhood: "",
    birth_date: "",
    notes: "",
    is_active: true
  });

  useEffect(() => {
    if (clinicId) {
      loadMembers();
    }
  }, [clinicId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("name");

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error("Error loading members:", error);
      toast.error("Erro ao carregar sócios");
    } finally {
      setLoading(false);
    }
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const handleOpenDialog = (member?: Member) => {
    if (member) {
      setEditingMember(member);
      setFormData({
        name: member.name,
        cpf: member.cpf,
        email: member.email || "",
        phone: member.phone || "",
        address: member.address || "",
        city: member.city || "",
        state: member.state || "",
        cep: member.cep || "",
        neighborhood: member.neighborhood || "",
        birth_date: member.birth_date || "",
        notes: member.notes || "",
        is_active: member.is_active
      });
    } else {
      setEditingMember(null);
      setFormData({
        name: "",
        cpf: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        cep: "",
        neighborhood: "",
        birth_date: "",
        notes: "",
        is_active: true
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.cpf) {
      toast.error("Nome e CPF são obrigatórios");
      return;
    }

    setIsSaving(true);
    try {
      const memberData = {
        clinic_id: clinicId,
        name: formData.name,
        cpf: formData.cpf.replace(/\D/g, ""),
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        cep: formData.cep || null,
        neighborhood: formData.neighborhood || null,
        birth_date: formData.birth_date || null,
        notes: formData.notes || null,
        is_active: formData.is_active
      };

      if (editingMember) {
        const { error } = await supabase
          .from("members")
          .update(memberData)
          .eq("id", editingMember.id);

        if (error) throw error;
        toast.success("Sócio atualizado!");
      } else {
        const { error } = await supabase
          .from("members")
          .insert(memberData);

        if (error) throw error;
        toast.success("Sócio cadastrado!");
      }

      setShowDialog(false);
      loadMembers();
    } catch (error: any) {
      console.error("Error saving member:", error);
      toast.error(error.message || "Erro ao salvar sócio");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (member: Member) => {
    if (!confirm(`Deseja realmente excluir o sócio ${member.name}?`)) return;

    try {
      const { error } = await supabase
        .from("members")
        .delete()
        .eq("id", member.id);

      if (error) throw error;
      toast.success("Sócio excluído!");
      loadMembers();
    } catch (error: any) {
      console.error("Error deleting member:", error);
      toast.error(error.message || "Erro ao excluir sócio");
    }
  };

  const generateAccessCode = async (member: Member) => {
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from("members")
        .update({
          access_code: code,
          access_code_expires_at: expiresAt
        })
        .eq("id", member.id);

      if (error) throw error;

      toast.success(`Código gerado: ${code}`, { duration: 10000 });
      loadMembers();
    } catch (error: any) {
      console.error("Error generating code:", error);
      toast.error("Erro ao gerar código");
    }
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.cpf.includes(searchTerm) ||
    m.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: members.length,
    active: members.filter(m => m.is_active).length,
    withAccess: members.filter(m => m.portal_last_access_at).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-600" />
            Sócios
          </h1>
          <p className="text-gray-500 text-sm">Gerencie os associados e suas contribuições</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4 mr-2" />
          Novo Sócio
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-700 text-sm font-medium">Total de Sócios</p>
                <p className="text-2xl font-bold text-purple-900">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-700 text-sm font-medium">Ativos</p>
                <p className="text-2xl font-bold text-emerald-900">{stats.active}</p>
              </div>
              <Users className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-700 text-sm font-medium">Com Acesso ao Portal</p>
                <p className="text-2xl font-bold text-blue-900">{stats.withAccess}</p>
              </div>
              <Key className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nome, CPF ou e-mail..."
          className="pl-9"
        />
      </div>

      {/* Members List */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="divide-y">
              {filteredMembers.map((member) => (
                <div key={member.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900">{member.name}</h3>
                        <Badge variant={member.is_active ? "default" : "secondary"}>
                          {member.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <span className="font-mono">{formatCPF(member.cpf)}</span>
                        {member.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {member.phone}
                          </span>
                        )}
                        {member.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </span>
                        )}
                        {member.city && member.state && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {member.city}/{member.state}
                          </span>
                        )}
                      </div>
                      {member.portal_last_access_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          Último acesso: {format(new Date(member.portal_last_access_at), "dd/MM/yyyy HH:mm")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateAccessCode(member)}
                        title="Gerar código de acesso"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(member)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(member)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredMembers.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum sócio encontrado</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? "Editar Sócio" : "Novo Sócio"}
            </DialogTitle>
            <DialogDescription>
              {editingMember ? "Atualize os dados do sócio" : "Preencha os dados do novo sócio"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={formatCPF(formData.cpf)}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, "") })}
                maxLength={14}
              />
            </div>
            <div>
              <Label htmlFor="birth_date">Data de Nascimento</Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
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
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={formData.cep}
                onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input
                id="neighborhood"
                value={formData.neighborhood}
                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
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
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                maxLength={2}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-purple-600 hover:bg-purple-700">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
