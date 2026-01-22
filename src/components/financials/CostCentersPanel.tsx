import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, ChevronRight, Building2, Search } from "lucide-react";

interface CostCentersPanelProps {
  clinicId: string;
}

interface CostCenter {
  id: string;
  clinic_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  description: string | null;
  hierarchy_level: number;
  is_active: boolean;
  created_at: string;
}

export function CostCentersPanel({ clinicId }: CostCentersPanelProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    parent_id: "" as string,
    is_active: true,
  });

  // Fetch cost centers
  const { data: costCenters = [], isLoading } = useQuery({
    queryKey: ["cost-centers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("clinic_id", clinicId)
        .is("deleted_at", null)
        .order("code");

      if (error) throw error;
      return data as CostCenter[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("cost_centers").insert({
        clinic_id: clinicId,
        code: data.code,
        name: data.name,
        description: data.description || null,
        parent_id: data.parent_id || null,
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-centers", clinicId] });
      toast.success("Centro de custo criado com sucesso");
      handleCloseDialog();
    },
    onError: (error: any) => {
      if (error.message?.includes("unique")) {
        toast.error("Código já existe");
      } else {
        toast.error("Erro ao criar centro de custo");
      }
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from("cost_centers")
        .update({
          code: data.code,
          name: data.name,
          description: data.description || null,
          parent_id: data.parent_id || null,
          is_active: data.is_active,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-centers", clinicId] });
      toast.success("Centro de custo atualizado");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Erro ao atualizar centro de custo");
    },
  });

  // Delete mutation (soft delete)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cost_centers")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-centers", clinicId] });
      toast.success("Centro de custo removido");
    },
    onError: () => {
      toast.error("Erro ao remover centro de custo");
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCenter(null);
    setFormData({
      code: "",
      name: "",
      description: "",
      parent_id: "",
      is_active: true,
    });
  };

  const handleEdit = (center: CostCenter) => {
    setEditingCenter(center);
    setFormData({
      code: center.code,
      name: center.name,
      description: center.description || "",
      parent_id: center.parent_id || "",
      is_active: center.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCenter) {
      updateMutation.mutate({ ...formData, id: editingCenter.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Filter cost centers
  const filteredCenters = costCenters.filter(
    (center) =>
      center.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      center.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Centros de Custo
        </CardTitle>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Centro
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredCenters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum centro de custo encontrado
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCenters.map((center) => (
                  <TableRow key={center.id}>
                    <TableCell className="font-mono">
                      <div className="flex items-center gap-1">
                        {center.hierarchy_level > 1 && (
                          <span
                            className="text-muted-foreground"
                            style={{ paddingLeft: `${(center.hierarchy_level - 1) * 12}px` }}
                          >
                            <ChevronRight className="h-3 w-3" />
                          </span>
                        )}
                        {center.code}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{center.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {center.description || "-"}
                    </TableCell>
                    <TableCell>{center.hierarchy_level}</TableCell>
                    <TableCell>
                      <Badge variant={center.is_active ? "default" : "secondary"}>
                        {center.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(center)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(center.id)}
                        >
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

      {/* Dialog */}
      <PopupBase open={dialogOpen} onClose={handleCloseDialog}>
        <PopupHeader>
          <PopupTitle>
            {editingCenter ? "Editar Centro de Custo" : "Novo Centro de Custo"}
          </PopupTitle>
        </PopupHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="CC001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent_id">Centro Pai</Label>
              <Select
                value={formData.parent_id || "__none__"}
                onValueChange={(value) => setFormData({ ...formData, parent_id: value === "__none__" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum (raiz)</SelectItem>
                  {costCenters
                    .filter((c) => c.id !== editingCenter?.id)
                    .map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.code} - {center.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome do centro de custo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição do centro de custo"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Ativo</Label>
          </div>

          <PopupFooter>
            <Button type="button" variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingCenter ? "Salvar" : "Criar"}
            </Button>
          </PopupFooter>
        </form>
      </PopupBase>
    </Card>
  );
}
