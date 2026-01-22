import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, Stethoscope, Package, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/quoteUtils";

interface Procedure {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  duration_minutes?: number | null;
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  cost_price: number;
  current_stock: number;
  is_sellable?: boolean;
}

interface SelectedItem {
  id: string;
  name: string;
  description?: string | null;
  unit_price: number;
  quantity: number;
  item_type: 'procedure' | 'product';
  procedure_id?: string;
  product_id?: string;
}

interface QuoteItemSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: SelectedItem) => void;
}

export function QuoteItemSelector({ open, onOpenChange, onSelect }: QuoteItemSelectorProps) {
  const { currentClinic } = useAuth();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"procedures" | "products">("procedures");

  const { data: procedures = [] } = useQuery({
    queryKey: ["procedures-for-quote", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("procedures")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Procedure[];
    },
    enabled: !!currentClinic?.id && open,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-for-quote", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("stock_products")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .eq("is_sellable", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!currentClinic?.id && open,
  });

  const filteredProcedures = procedures.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectProcedure = (procedure: Procedure) => {
    onSelect({
      id: procedure.id,
      name: procedure.name,
      description: procedure.description,
      unit_price: procedure.price,
      quantity: 1,
      item_type: 'procedure',
      procedure_id: procedure.id,
    });
    onOpenChange(false);
    setSearch("");
  };

  const handleSelectProduct = (product: Product) => {
    onSelect({
      id: product.id,
      name: product.name,
      description: product.description,
      unit_price: product.cost_price,
      quantity: 1,
      item_type: 'product',
      product_id: product.id,
    });
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Adicionar Item ao Orçamento</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "procedures" | "products")} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="procedures" className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Serviços ({filteredProcedures.length})
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos ({filteredProducts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="procedures" className="flex-1 overflow-y-auto mt-4">
            {filteredProcedures.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {search ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProcedures.map((procedure) => (
                  <div
                    key={procedure.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{procedure.name}</p>
                      {procedure.description && (
                        <p className="text-sm text-muted-foreground truncate">{procedure.description}</p>
                      )}
                      {procedure.duration_minutes && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {procedure.duration_minutes} min
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="font-semibold text-primary">
                        {formatCurrency(procedure.price)}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleSelectProcedure(procedure)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="products" className="flex-1 overflow-y-auto mt-4">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {search 
                  ? "Nenhum produto encontrado" 
                  : "Nenhum produto para venda cadastrado. Marque produtos como 'Disponível para venda' no estoque."}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      {product.description && (
                        <p className="text-sm text-muted-foreground truncate">{product.description}</p>
                      )}
                      <Badge variant="outline" className="mt-1 text-xs">
                        Estoque: {product.current_stock}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="font-semibold text-primary">
                        {formatCurrency(product.cost_price)}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleSelectProduct(product)}
                        disabled={product.current_stock <= 0}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
