import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  UserCircle, 
  Plus,
  Search,
  Mail,
  Phone,
  Pencil,
  Trash2
} from "lucide-react";

interface Professional {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  function: string | null;
  is_active: boolean;
  clinic_id: string;
}

export default function HomologacaoProfissionaisPage() {
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    function: "",
    is_active: true,
  });

  // Fetch professionals
  const { data: professionals, isLoading } = useQuery({
    queryKey: ["homologacao-professionals", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("homologacao_professionals")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("name");
      
      if (error) throw error;
      return data as Professional[];
    },
    enabled: !!currentClinic?.id,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("homologacao_professionals")
        .insert({
          ...data,
          clinic_id: currentClinic?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homologacao-professionals"] });
      toast.success("Profissional cadastrado com sucesso!");
      closeDialog();
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar profissional: " + error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("homologacao_professionals")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homologacao-professionals"] });
      toast.success("Profissional atualizado com sucesso!");
      closeDialog();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar profissional: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("homologacao_professionals")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homologacao-professionals"] });
      toast.success("Profissional excluído com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir profissional: " + error.message);
    },
  });

  const openNewDialog = () => {
    setEditingProfessional(null);
    setFormData({ name: "", email: "", phone: "", function: "", is_active: true });
    setIsDialogOpen(true);
  };

  const openEditDialog = (prof: Professional) => {
    setEditingProfessional(prof);
    setFormData({
      name: prof.name,
      email: prof.email || "",
      phone: prof.phone || "",
      function: prof.function || "",
      is_active: prof.is_active,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingProfessional(null);
    setFormData({ name: "", email: "", phone: "", function: "", is_active: true });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("O nome é obrigatório");
      return;
    }

    if (editingProfessional) {
      updateMutation.mutate({ id: editingProfessional.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Deseja realmente excluir este profissional?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredProfessionals = professionals?.filter(prof =>
    prof.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prof.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    prof.function?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profissionais</h1>
          <p className="text-muted-foreground">Gestão de advogados e profissionais para homologações</p>
        </div>
        <Button onClick={openNewDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Profissional
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar profissional..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : filteredProfessionals?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum profissional cadastrado</p>
            <Button onClick={openNewDialog} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Profissional
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProfessionals?.map((prof) => (
            <Card key={prof.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{prof.name}</CardTitle>
                    <CardDescription>{prof.function || "Advogado"}</CardDescription>
                  </div>
                  <Badge variant={prof.is_active ? "default" : "secondary"}>
                    {prof.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {prof.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {prof.email}
                    </p>
                  )}
                  {prof.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {prof.phone}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(prof)}>
                    <Pencil className="w-3 h-3 mr-1" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive"
                    onClick={() => handleDelete(prof.id)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProfessional ? "Editar Profissional" : "Novo Profissional"}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do profissional
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="function">Função</Label>
              <Input
                id="function"
                value={formData.function}
                onChange={(e) => setFormData({ ...formData, function: e.target.value })}
                placeholder="Ex: Advogado Trabalhista"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Profissional ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button 
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
