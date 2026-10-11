import { useState, useMemo} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UnionSupplierDialog } from "@/components/union/financials/UnionSupplierDialog";
import { toast } from "sonner";
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Truck,
  CheckCircle,
  XCircle,
  Building2,
  Phone,
  Mail,
  Settings,
} from "lucide-react";
import { KpiCard } from "@/components/design-system";
import { UnionSupplierDefaultsDialog } from "@/components/union/financials/UnionSupplierDefaultsDialog";

import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
export default function UnionSuppliersPage() {
  const { currentClinic, userRoles} = useAuth();

  const resolvedClinic = useMemo(
    () => userRoles.find((role) => role.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  const { canManageSuppliers } = useUnionPermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [defaultsDialogOpen, setDefaultsDialogOpen] = useState(false);
  const [selectedSupplierForDefaults, setSelectedSupplierForDefaults] =
    useState<any>(null);

  const clinicId = resolvedClinic?.id;

  // Fetch suppliers
  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["union-suppliers", clinicId, showInactive],
    queryFn: async () => {
      let query = supabase
        .from("union_suppliers")
        .select("*")
        .eq("clinic_id", clinicId!)
        .order("name");

      if (!showInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("union_suppliers")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-suppliers"] });
      toast.success("Status atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("union_suppliers")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-suppliers"] });
      toast.success("Fornecedor excluído!");
    },
    onError: () => {
      toast.error("Erro ao excluir fornecedor. Verifique se não há despesas vinculadas.");
    },
  });

  const filteredSuppliers = suppliers?.filter((s) => {
    const searchLower = search.toLowerCase();
    const searchClean = search.replace(/\D/g, "");
    const cnpjClean = s.cnpj?.replace(/\D/g, "") || "";
    const cnpjNoLeadingZeros = cnpjClean.replace(/^0+/, "");
    const searchNoLeadingZeros = searchClean.replace(/^0+/, "");
    
    return (
      s.name.toLowerCase().includes(searchLower) ||
      (searchClean.length >= 2 && cnpjClean.includes(searchClean)) ||
      (searchNoLeadingZeros.length >= 2 && cnpjNoLeadingZeros.includes(searchNoLeadingZeros)) ||
      s.email?.toLowerCase().includes(searchLower)
    );
  });

  const activeCount = suppliers?.filter((s) => s.is_active).length || 0;
  const inactiveCount = suppliers?.filter((s) => !s.is_active).length || 0;

  const handleEdit = (supplier: any) => {
    setEditingSupplier(supplier);
    setDialogOpen(true);
  };

  const formatCNPJ = (cnpj: string | null) => {
    if (!cnpj) return "-";
    const cleaned = cnpj.replace(/\D/g, "");
    if (cleaned.length !== 14) return cnpj;
    return cleaned.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    );
  };

  if (!clinicId) return null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><Truck className="h-5 w-5" /></span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Fornecedores</h1>
            <p className="text-sm text-muted-foreground">Gerencie os fornecedores do módulo sindical.</p>
          </div>
        </div>
        {canManageSuppliers() && (
          <Button size="sm" className="h-9" onClick={() => { setEditingSupplier(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Novo Fornecedor
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Total" value={(suppliers?.length || 0).toLocaleString("pt-BR")} hint="fornecedores cadastrados" icon={Truck} />
        <KpiCard label="Ativos" tone="success" value={activeCount.toLocaleString("pt-BR")} hint="disponíveis para lançamentos" icon={CheckCircle} />
        <KpiCard label="Inativos" value={inactiveCount.toLocaleString("pt-BR")} hint={showInactive ? "exibidos na lista" : "ocultos da lista"} icon={XCircle} active={showInactive} onClick={() => setShowInactive(!showInactive)} />
      </div>

      <Card className="rounded-xl shadow-sm">
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, CNPJ ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8 text-sm" />
          </div>
          <Button variant={showInactive ? "secondary" : "outline"} size="sm" className="h-9" onClick={() => setShowInactive(!showInactive)}>
            {showInactive ? "Ocultar inativos" : "Mostrar inativos"}
          </Button>
          <span className="text-xs text-muted-foreground sm:ml-2">{(filteredSuppliers?.length || 0).toLocaleString("pt-BR")} resultado(s)</span>
        </div>

        <CardContent className="p-0">
          <ScrollArea className="max-h-[calc(100vh-380px)] min-h-[300px]">
            {filteredSuppliers && filteredSuppliers.length > 0 ? (
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow className="text-[11px] uppercase tracking-wide">
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Truck className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{supplier.name}</p>
                            {supplier.contact_name && (
                              <p className="text-xs text-muted-foreground">
                                {supplier.contact_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatCNPJ(supplier.cnpj)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {supplier.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {supplier.email}
                            </div>
                          )}
                          {supplier.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {supplier.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {supplier.city && supplier.state
                          ? `${supplier.city}/${supplier.state}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            supplier.is_active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-800"
                          }
                        >
                          {supplier.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {canManageSuppliers() && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedSupplierForDefaults(supplier);
                                  setDefaultsDialogOpen(true);
                                }}
                              >
                                <Settings className="h-4 w-4 mr-2" />
                                Vínculos / Padrões
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  toggleStatusMutation.mutate({
                                    id: supplier.id,
                                    isActive: !supplier.is_active,
                                  })
                                }
                              >
                                {supplier.is_active ? (
                                  <>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Desativar
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Ativar
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(supplier.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum fornecedor encontrado</p>
                <p className="text-sm">
                  Clique em "Novo Fornecedor" para começar.
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialog */}
      <UnionSupplierDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingSupplier(null);
        }}
        supplier={editingSupplier}
        clinicId={clinicId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["union-suppliers"] });
        }}
      />

      {/* Vínculos / Padrões do fornecedor */}
      {selectedSupplierForDefaults && (
        <UnionSupplierDefaultsDialog
          open={defaultsDialogOpen}
          onOpenChange={setDefaultsDialogOpen}
          supplierId={selectedSupplierForDefaults.id}
          supplierName={selectedSupplierForDefaults.name}
          clinicId={clinicId}
        />
      )}
    </div>
  );
}
