import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, MoreHorizontal, Edit, Trash2, Users, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import SegmentDialog from "./SegmentDialog";

interface Segment {
  id: string;
  name: string;
  description: string | null;
  filter_criteria: Record<string, any>;
  patient_count: number | null;
  is_dynamic: boolean;
  is_active: boolean;
  last_calculated_at: string | null;
  created_at: string;
}

export default function SegmentsPanel() {
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [segmentToDelete, setSegmentToDelete] = useState<Segment | null>(null);

  const { data: segments, isLoading } = useQuery({
    queryKey: ["patient-segments", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];

      const { data, error } = await (supabase as any)
        .from("patient_segments")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Segment[];
    },
    enabled: !!currentClinic?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("patient_segments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-segments"] });
      toast.success("Segmento excluído com sucesso");
      setDeleteDialogOpen(false);
      setSegmentToDelete(null);
    },
    onError: () => {
      toast.error("Erro ao excluir segmento");
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: async (segment: Segment) => {
      // Recalculate patient count based on filter criteria
      const criteria = segment.filter_criteria;
      let query = (supabase as any)
        .from("patients")
        .select("id", { count: "exact" })
        .eq("clinic_id", currentClinic?.id);

      // Apply filters based on criteria
      if (criteria.lastVisitDays) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - criteria.lastVisitDays);
        query = query.lt("last_visit_at", daysAgo.toISOString());
      }

      if (criteria.birthdayMonth) {
        // This would require a more complex query with date extraction
      }

      const { count, error } = await query;
      if (error) throw error;

      const { error: updateError } = await (supabase as any)
        .from("patient_segments")
        .update({
          patient_count: count || 0,
          last_calculated_at: new Date().toISOString(),
        })
        .eq("id", segment.id);

      if (updateError) throw updateError;
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["patient-segments"] });
      toast.success(`Segmento recalculado: ${count} pacientes`);
    },
    onError: () => {
      toast.error("Erro ao recalcular segmento");
    },
  });

  const filteredSegments = segments?.filter((segment) =>
    segment.name.toLowerCase().includes(search.toLowerCase()) ||
    segment.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (segment: Segment) => {
    setSelectedSegment(segment);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedSegment(null);
    setDialogOpen(true);
  };

  const handleDelete = (segment: Segment) => {
    setSegmentToDelete(segment);
    setDeleteDialogOpen(true);
  };

  const getCriteriaDescription = (criteria: Record<string, any>) => {
    const parts: string[] = [];
    if (criteria.lastVisitDays) {
      parts.push(`Sem visita há ${criteria.lastVisitDays} dias`);
    }
    if (criteria.birthdayMonth) {
      parts.push(`Aniversário em ${criteria.birthdayMonth}`);
    }
    if (criteria.procedureId) {
      parts.push("Procedimento específico");
    }
    if (criteria.gender) {
      parts.push(criteria.gender === "M" ? "Masculino" : "Feminino");
    }
    if (criteria.ageMin || criteria.ageMax) {
      parts.push(`Idade: ${criteria.ageMin || 0}-${criteria.ageMax || "∞"}`);
    }
    return parts.length > 0 ? parts.join(" • ") : "Todos os pacientes";
  };

  if (!currentClinic) return null;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Segmentos de Pacientes</CardTitle>
            <CardDescription>
              Crie segmentos dinâmicos baseados em critérios específicos
            </CardDescription>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Segmento
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar segmentos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando segmentos...
            </div>
          ) : !filteredSegments?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum segmento encontrado</p>
              <p className="text-sm mt-1">
                Crie segmentos para organizar seus pacientes
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Critérios</TableHead>
                    <TableHead className="text-center">Pacientes</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Última Atualização</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSegments.map((segment) => (
                    <TableRow key={segment.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {segment.name}
                            {!segment.is_active && (
                              <Badge variant="secondary">Inativo</Badge>
                            )}
                          </div>
                          {segment.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {segment.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {getCriteriaDescription(segment.filter_criteria)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-medium">{segment.patient_count || 0}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => recalculateMutation.mutate(segment)}
                            disabled={recalculateMutation.isPending}
                          >
                            <RefreshCw className={`h-3 w-3 ${recalculateMutation.isPending ? "animate-spin" : ""}`} />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={segment.is_dynamic ? "default" : "outline"}>
                          {segment.is_dynamic ? "Dinâmico" : "Estático"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {segment.last_calculated_at ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(segment.last_calculated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(segment)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => recalculateMutation.mutate(segment)}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Recalcular
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(segment)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <SegmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        segment={selectedSegment}
        clinicId={currentClinic.id}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir segmento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o segmento "{segmentToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => segmentToDelete && deleteMutation.mutate(segmentToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
