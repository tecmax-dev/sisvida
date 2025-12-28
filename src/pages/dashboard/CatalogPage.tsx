import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Stethoscope,
  Package,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import { ProcedureDialog } from "@/components/procedures/ProcedureDialog";
import { ProductDialog } from "@/components/stock/ProductDialog";
import { formatCurrency } from "@/lib/quoteUtils";

interface Procedure {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number | null;
  is_active: boolean;
  category: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  cost_price: number;
  current_stock: number;
  minimum_stock?: number;
  is_active: boolean;
  is_sellable: boolean | null;
  category_id: string | null;
  category?: { name: string } | null;
}

export default function CatalogPage() {
  const { currentClinic } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"services" | "products">("services");
  const [procedureDialogOpen, setProcedureDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Load procedures
  const { data: procedures = [], isLoading: loadingProcedures } = useQuery({
    queryKey: ["catalog-procedures", currentClinic?.id],
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

  // Load products (sellable ones)
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["catalog-products", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("stock_products")
        .select("*, category:stock_categories(name)")
        .eq("clinic_id", currentClinic.id)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!currentClinic?.id,
  });

  // Load categories for products
  const { data: categories = [] } = useQuery({
    queryKey: ["stock-categories", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("stock_categories")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentClinic?.id,
  });

  // Load suppliers for products
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentClinic?.id,
  });

  // Toggle procedure active
  const toggleProcedureMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("procedures")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog-procedures"] });
    },
  });

  // Toggle product sellable
  const toggleSellableMutation = useMutation({
    mutationFn: async ({ id, is_sellable }: { id: string; is_sellable: boolean }) => {
      const { error } = await supabase
        .from("stock_products")
        .update({ is_sellable })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog-products"] });
      toast.success("Produto atualizado!");
    },
  });

  const filteredProcedures = procedures.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const sellableProducts = products.filter(p => p.is_sellable === true);

  // Stats
  const stats = {
    totalServices: procedures.filter(p => p.is_active).length,
    totalProducts: sellableProducts.length,
  };

  const handleEditProcedure = (procedure: Procedure) => {
    setSelectedProcedure(procedure);
    setProcedureDialogOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductDialogOpen(true);
  };

  return (
    <RoleGuard permission="view_catalog">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo</h1>
          <p className="text-muted-foreground">
            Gerencie serviços e produtos disponíveis para orçamentos
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Serviços Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalServices}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Produtos à Venda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as "services" | "products")}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Serviços
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
          </TabsList>
          
          <div className="flex-1 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {hasPermission("manage_catalog") && (
            <Button 
              onClick={() => {
                if (tab === 'services') {
                  setSelectedProcedure(null);
                  setProcedureDialogOpen(true);
                } else {
                  setSelectedProduct(null);
                  setProductDialogOpen(true);
                }
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {tab === 'services' ? 'Novo Serviço' : 'Novo Produto'}
            </Button>
          )}
        </div>

        {/* Services Tab */}
        <TabsContent value="services" className="mt-6">
          {loadingProcedures ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProcedures.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Stethoscope className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">Nenhum serviço encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Cadastre procedimentos para incluir nos orçamentos
              </p>
              {hasPermission("manage_catalog") && (
                <Button onClick={() => { setSelectedProcedure(null); setProcedureDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Serviço
                </Button>
              )}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProcedures.map((procedure) => (
                    <TableRow key={procedure.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{procedure.name}</p>
                          {procedure.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {procedure.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {procedure.category ? (
                          <Badge variant="outline">{procedure.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {procedure.duration_minutes 
                          ? `${procedure.duration_minutes} min`
                          : '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(procedure.price)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={procedure.is_active}
                          onCheckedChange={(checked) =>
                            toggleProcedureMutation.mutate({ id: procedure.id, is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditProcedure(procedure)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
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
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="mt-6">
          {loadingProducts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">Nenhum produto encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Cadastre produtos no estoque e marque-os como disponíveis para venda
              </p>
              {hasPermission("manage_catalog") && (
                <Button onClick={() => { setSelectedProduct(null); setProductDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Produto
                </Button>
              )}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Preço Venda</TableHead>
                    <TableHead>Disponível p/ Venda</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {product.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.category?.name ? (
                          <Badge variant="outline">{product.category.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={product.current_stock <= (product.minimum_stock || 0) ? "destructive" : "secondary"}
                        >
                          {product.current_stock}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(product.cost_price)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={product.is_sellable ?? false}
                          onCheckedChange={(checked) =>
                            toggleSellableMutation.mutate({ id: product.id, is_sellable: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
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
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ProcedureDialog
        open={procedureDialogOpen}
        onOpenChange={(open) => {
          setProcedureDialogOpen(open);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ["catalog-procedures"] });
          }
        }}
        procedure={selectedProcedure ? {
          ...selectedProcedure,
          description: selectedProcedure.description || null,
          category: selectedProcedure.category || null,
          color: selectedProcedure.category || '#3B82F6',
        } : null}
        clinicId={currentClinic?.id || ''}
      />

      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProduct}
        categories={categories}
        suppliers={suppliers}
        clinicId={currentClinic?.id || ''}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["catalog-products"] });
          setProductDialogOpen(false);
        }}
      />
    </div>
    </RoleGuard>
  );
}
