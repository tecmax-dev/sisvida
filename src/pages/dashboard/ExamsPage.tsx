import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Globe, Building2, Loader2 } from "lucide-react";

interface Exam {
  id: string;
  name: string;
  category: string;
  description: string | null;
  code: string | null;
  clinic_id: string | null;
  is_global: boolean;
  is_active: boolean;
}

const CATEGORIES = [
  "Hematologia",
  "Bioquímica",
  "Lipídios",
  "Eletrólitos",
  "Tireoide",
  "Hormônios",
  "Vitaminas",
  "Inflamação",
  "Marcadores Tumorais",
  "Urinálise",
  "Fezes",
  "Sorologia",
  "Imunologia",
  "Cardiologia",
  "Cardiológico",
  "Imagem",
  "Endoscopia",
  "Oftalmologia",
  "Outros",
];

export default function ExamsPage() {
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    code: "",
  });

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["exams", currentClinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .or(`is_global.eq.true,clinic_id.eq.${currentClinic?.id}`)
        .eq("is_active", true)
        .order("category")
        .order("name");

      if (error) throw error;
      return data as Exam[];
    },
    enabled: !!currentClinic?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("exams").insert({
        name: data.name,
        category: data.category,
        description: data.description || null,
        code: data.code || null,
        clinic_id: currentClinic?.id,
        is_global: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exame cadastrado com sucesso!");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Erro ao cadastrar exame");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("exams")
        .update({
          name: data.name,
          category: data.category,
          description: data.description || null,
          code: data.code || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exame atualizado com sucesso!");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Erro ao atualizar exame");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("exams")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exame removido com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao remover exame");
    },
  });

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingExam(null);
    setFormData({ name: "", category: "", description: "", code: "" });
  };

  const handleEdit = (exam: Exam) => {
    if (exam.is_global) {
      toast.error("Exames globais não podem ser editados");
      return;
    }
    setEditingExam(exam);
    setFormData({
      name: exam.name,
      category: exam.category,
      description: exam.description || "",
      code: exam.code || "",
    });
    setShowDialog(true);
  };

  const handleDelete = (exam: Exam) => {
    if (exam.is_global) {
      toast.error("Exames globais não podem ser removidos");
      return;
    }
    if (confirm("Deseja realmente remover este exame?")) {
      deleteMutation.mutate(exam.id);
    }
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.category) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (editingExam) {
      updateMutation.mutate({ id: editingExam.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredExams = exams.filter((exam) => {
    const matchesSearch =
      exam.name.toLowerCase().includes(search.toLowerCase()) ||
      exam.description?.toLowerCase().includes(search.toLowerCase()) ||
      exam.code?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || exam.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(exams.map((e) => e.category))].sort();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catálogo de Exames</h1>
          <p className="text-muted-foreground">
            {exams.length} exames disponíveis
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Exame
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, descrição ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="hidden md:table-cell">Descrição</TableHead>
              <TableHead className="hidden sm:table-cell">Código</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum exame encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredExams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">{exam.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{exam.category}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground max-w-[300px] truncate">
                    {exam.description || "-"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {exam.code || "-"}
                  </TableCell>
                  <TableCell>
                    {exam.is_global ? (
                      <Badge variant="secondary" className="gap-1">
                        <Globe className="h-3 w-3" />
                        Global
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-1">
                        <Building2 className="h-3 w-3" />
                        Clínica
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(exam)}
                        disabled={exam.is_global}
                        title={exam.is_global ? "Exames globais não podem ser editados" : "Editar"}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(exam)}
                        disabled={exam.is_global}
                        title={exam.is_global ? "Exames globais não podem ser removidos" : "Remover"}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingExam ? "Editar Exame" : "Novo Exame"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do exame"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Código TUSS</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Código TUSS (opcional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do exame"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingExam ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
