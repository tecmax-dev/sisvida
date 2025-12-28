import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Clock, DollarSign } from "lucide-react";
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

interface Procedure {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  category: string | null;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function ProceduresPage() {
  const { currentClinic } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [procedureToDelete, setProcedureToDelete] = useState<Procedure | null>(null);

  const canManageProcedures = hasPermission("manage_procedures");

  const { data: procedures, isLoading } = useQuery({
    queryKey: ["procedures", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("procedures")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("name");

      if (error) throw error;
      return data as Procedure[];
    },
    enabled: !!currentClinic?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (procedureId: string) => {
      const { error } = await supabase
        .from("procedures")
        .delete()
        .eq("id", procedureId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      toast.success("Procedimento excluído com sucesso");
      setDeleteDialogOpen(false);
      setProcedureToDelete(null);
    },
    onError: (error) => {
      console.error("Error deleting procedure:", error);
      toast.error("Erro ao excluir procedimento");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("procedures")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      toast.success("Status atualizado");
    },
    onError: (error) => {
      console.error("Error toggling procedure:", error);
      toast.error("Erro ao atualizar status");
    },
  });

  const filteredProcedures = procedures?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleEdit = (procedure: Procedure) => {
    navigate(`/dashboard/procedures/${procedure.id}/edit`);
  };

  const handleDelete = (procedure: Procedure) => {
    setProcedureToDelete(procedure);
    setDeleteDialogOpen(true);
  };

  const handleNewProcedure = () => {
    navigate("/dashboard/procedures/new");
  };

  if (!currentClinic) {
    return null;
  }

  return (
    <RoleGuard permission="view_procedures">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Procedimentos</h1>
            <p className="text-muted-foreground">
              Gerencie os procedimentos e serviços da clínica
            </p>
          </div>
          {canManageProcedures && (
            <Button onClick={handleNewProcedure}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Procedimento
            </Button>
          )}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar procedimentos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : filteredProcedures?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">
                Nenhum procedimento encontrado
              </p>
              {canManageProcedures && (
                <Button onClick={handleNewProcedure}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeiro procedimento
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProcedures?.map((procedure) => (
              <Card
                key={procedure.id}
                className={`relative overflow-hidden ${!procedure.is_active ? "opacity-60" : ""}`}
              >
                <div
                  className="absolute top-0 left-0 w-full h-1"
                  style={{ backgroundColor: procedure.color }}
                />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{procedure.name}</CardTitle>
                      {procedure.category && (
                        <Badge variant="secondary" className="text-xs">
                          {procedure.category}
                        </Badge>
                      )}
                    </div>
                    {canManageProcedures && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(procedure)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(procedure)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {procedure.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {procedure.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {procedure.duration_minutes} min
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-primary">
                        <DollarSign className="h-4 w-4" />
                        {formatCurrency(procedure.price)}
                      </span>
                    </div>
                    {canManageProcedures && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            id: procedure.id,
                            is_active: !procedure.is_active,
                          })
                        }
                      >
                        {procedure.is_active ? "Desativar" : "Ativar"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}


        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir procedimento?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O procedimento{" "}
                <strong>{procedureToDelete?.name}</strong> será permanentemente
                excluído.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  procedureToDelete && deleteMutation.mutate(procedureToDelete.id)
                }
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RoleGuard>
  );
}
