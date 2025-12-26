import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDownCircle, ArrowUpCircle, RefreshCw, Settings } from "lucide-react";

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  unit_cost: number | null;
  total_cost: number | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  product: { id: string; name: string; unit: string } | null;
  supplier: { id: string; name: string } | null;
}

interface StockMovementsTableProps {
  clinicId: string | undefined;
}

const REASON_LABELS: Record<string, string> = {
  purchase: "Compra",
  return: "Devolução",
  donation: "Doação",
  transfer_in: "Transferência (entrada)",
  adjustment: "Ajuste de inventário",
  consumption: "Consumo",
  sale: "Venda",
  loss: "Perda / Avaria",
  expired: "Vencido",
  transfer_out: "Transferência (saída)",
  other: "Outro",
};

export function StockMovementsTable({ clinicId }: StockMovementsTableProps) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clinicId) {
      fetchMovements();
    }
  }, [clinicId]);

  const fetchMovements = async () => {
    if (!clinicId) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("stock_movements")
        .select(`
          *,
          product:stock_products(id, name, unit),
          supplier:suppliers(id, name)
        `)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setMovements(data || []);
    } catch (error) {
      console.error("Error fetching movements:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "entry":
        return <ArrowDownCircle className="h-4 w-4 text-green-600" />;
      case "exit":
        return <ArrowUpCircle className="h-4 w-4 text-red-600" />;
      case "adjustment":
        return <Settings className="h-4 w-4 text-yellow-600" />;
      case "transfer":
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "entry":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Entrada</Badge>;
      case "exit":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Saída</Badge>;
      case "adjustment":
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Ajuste</Badge>;
      case "transfer":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Transferência</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="text-right">Estoque Anterior</TableHead>
              <TableHead className="text-right">Novo Estoque</TableHead>
              <TableHead className="text-right">Custo Total</TableHead>
              <TableHead>Fornecedor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Nenhuma movimentação encontrada
                </TableCell>
              </TableRow>
            ) : (
              movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(movement.created_at), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(movement.type)}
                      {getTypeBadge(movement.type)}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {movement.product?.name || "-"}
                  </TableCell>
                  <TableCell>
                    {movement.reason ? REASON_LABELS[movement.reason] || movement.reason : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        movement.type === "entry"
                          ? "text-green-600 font-medium"
                          : movement.type === "exit"
                          ? "text-red-600 font-medium"
                          : ""
                      }
                    >
                      {movement.type === "entry" ? "+" : movement.type === "exit" ? "-" : ""}
                      {movement.quantity} {movement.product?.unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {movement.previous_stock}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {movement.new_stock}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(movement.total_cost)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {movement.supplier?.name || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
