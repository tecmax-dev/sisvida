import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, DollarSign, Tag, Zap } from "lucide-react";

interface SupplierDefault {
  id: string;
  description: string;
  category_id: string | null;
  default_value: number | null;
  category?: {
    id: string;
    name: string;
    color: string | null;
  };
}

interface UnionSupplierDefaultsSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierName: string;
  onSelect: (data: {
    description: string;
    category_id: string;
    amount: string;
    gross_value: string;
  }) => void;
}

export function UnionSupplierDefaultsSelector({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  onSelect,
}: UnionSupplierDefaultsSelectorProps) {
  const { data: defaults, isLoading } = useQuery({
    queryKey: ["union-supplier-defaults", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_supplier_defaults")
        .select(`
          id,
          description,
          category_id,
          default_value,
          category:union_financial_categories(id, name, color)
        `)
        .eq("supplier_id", supplierId)
        .eq("is_active", true)
        .order("description");

      if (error) throw error;
      return data as SupplierDefault[];
    },
    enabled: !!supplierId && open,
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const handleSelect = (item: SupplierDefault) => {
    const valueStr = item.default_value?.toString().replace(".", ",") || "";
    onSelect({
      description: item.description,
      category_id: item.category_id || "",
      amount: valueStr,
      gross_value: valueStr,
    });
    onOpenChange(false);
  };

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="md">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          Lançamento Rápido
        </PopupTitle>
        <PopupDescription>
          Selecione uma despesa vinculada a <strong>{supplierName}</strong>
        </PopupDescription>
      </PopupHeader>

      <ScrollArea className="max-h-[350px]">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : defaults?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nenhum vínculo cadastrado</p>
            <p className="text-xs mt-1">
              Configure vínculos na gestão de fornecedores
            </p>
          </div>
        ) : (
          <div className="space-y-2 pr-2">
            {defaults?.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className="w-full text-left p-3 bg-card border rounded-lg hover:bg-primary/5 hover:border-primary/30 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                    <FileText className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {item.category && (
                        <span className="flex items-center gap-1">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: item.category.color || "#6b7280" }}
                          />
                          {item.category.name}
                        </span>
                      )}
                      {item.default_value && (
                        <span className="flex items-center gap-1 font-medium text-emerald-600">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(item.default_value)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <PopupFooter>
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
          Preencher manualmente
        </Button>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
      </PopupFooter>
    </PopupBase>
  );
}
