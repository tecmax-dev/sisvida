import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, ToggleLeft, ToggleRight, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UnionBenefitDialog } from "./UnionBenefitDialog";

interface Benefit {
  id: string;
  name: string;
  description: string | null;
  partner_name: string | null;
  partner_cnpj: string | null;
  partner_phone: string | null;
  partner_email: string | null;
  partner_address: string | null;
  category: string | null;
  validity_days: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export function UnionBenefitsPage() {
  const { currentClinic } = useAuth();
  const { canManageMembers } = useUnionPermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBenefit, setSelectedBenefit] = useState<Benefit | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [benefitToDelete, setBenefitToDelete] = useState<Benefit | null>(null);

  // DEBUG: Track mount/unmount to diagnose modal closing on tab switch
  useEffect(() => {
    console.log("🟢 UnionBenefitsPage mount");
    return () => console.log("🔴 UnionBenefitsPage unmount");
  }, []);

  const { data: benefits = [], isLoading } = useQuery({
    queryKey: ["union-benefits", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("union_benefits")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("name");
      
      if (error) throw error;
      return data as Benefit[];
    },
    enabled: !!currentClinic?.id,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("union_benefits")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-benefits"] });
      toast({ title: "Status atualizado!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("union_benefits")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-benefits"] });
      toast({ title: "Benefício excluído!" });
      setDeleteDialogOpen(false);
      setBenefitToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });

  const filteredBenefits = benefits.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.partner_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.category?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (benefit: Benefit) => {
    setSelectedBenefit(benefit);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedBenefit(null);
    setDialogOpen(true);
  };

  const handleDelete = (benefit: Benefit) => {
    setBenefitToDelete(benefit);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Gift className="h-6 w-6 text-violet-500" />
          <h1 className="text-2xl font-bold">Benefícios e Convênios</h1>
        </div>
        {canManageMembers() && (
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Benefício
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar benefícios..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : filteredBenefits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Gift className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum benefício cadastrado</p>
              {canManageMembers() && (
                <Button variant="outline" className="mt-4" onClick={handleNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar primeiro benefício
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Convênio</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Validade (dias)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBenefits.map((benefit) => (
                  <TableRow key={benefit.id}>
                    <TableCell className="font-medium">{benefit.name}</TableCell>
                    <TableCell>{benefit.partner_name || "-"}</TableCell>
                    <TableCell>
                      {benefit.category && (
                        <Badge variant="outline">{benefit.category}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{benefit.validity_days}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={benefit.is_active ? "default" : "secondary"}>
                        {benefit.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleMutation.mutate({ 
                            id: benefit.id, 
                            is_active: !benefit.is_active 
                          })}
                          title={benefit.is_active ? "Desativar" : "Ativar"}
                        >
                          {benefit.is_active ? (
                            <ToggleRight className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(benefit)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(benefit)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UnionBenefitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        benefit={selectedBenefit}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir benefício?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O benefício "{benefitToDelete?.name}" será removido permanentemente.
              Autorizações existentes serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => benefitToDelete && deleteMutation.mutate(benefitToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
