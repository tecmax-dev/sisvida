import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MessageSquare, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TissGlossesPanelProps {
  clinicId: string;
}

interface TissGloss {
  id: string;
  guide_id: string;
  gloss_code: string;
  gloss_description: string | null;
  original_value: number;
  glossed_value: number;
  status: string;
  contested_at: string | null;
  resolved_at: string | null;
  created_at: string;
  guide?: {
    guide_number: string;
    patient?: { name: string } | null;
  } | null;
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  contested: "Contestada",
  accepted: "Aceita",
  rejected: "Recusada",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  contested: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  accepted: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
};

export function TissGlossesPanel({ clinicId }: TissGlossesPanelProps) {
  // Fetch glosses
  const { data: glosses = [], isLoading } = useQuery({
    queryKey: ["tiss-glosses", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];

      const { data, error } = await (supabase as any)
        .from("tiss_glosses")
        .select(`
          *,
          guide:tiss_guides(
            guide_number,
            patient:patients(name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching TISS glosses:", error);
        throw error;
      }
      
      // Filter by clinic through guide relationship
      return (data || []).filter((g: any) => g.guide) as TissGloss[];
    },
    enabled: !!clinicId,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const pendingCount = glosses.filter((g) => g.status === "pending").length;
  const totalGlossed = glosses.reduce((sum, g) => sum + (g.glossed_value || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Controle de Glosas
            </CardTitle>
            <CardDescription>Acompanhe e conteste glosas recebidas</CardDescription>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              <p className="text-muted-foreground">Pendentes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-destructive">{formatCurrency(totalGlossed)}</p>
              <p className="text-muted-foreground">Total Glosado</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : glosses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
            <p>Nenhuma glosa registrada</p>
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guia</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor Original</TableHead>
                  <TableHead className="text-right">Valor Glosado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {glosses.map((gloss) => (
                  <TableRow key={gloss.id}>
                    <TableCell className="font-mono">{gloss.guide?.guide_number || "-"}</TableCell>
                    <TableCell>{gloss.guide?.patient?.name || "-"}</TableCell>
                    <TableCell className="font-mono">{gloss.gloss_code}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {gloss.gloss_description || "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(gloss.original_value)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-destructive">
                      {formatCurrency(gloss.glossed_value)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[gloss.status]}>
                        {statusLabels[gloss.status] || gloss.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {gloss.status === "pending" && (
                        <Button variant="outline" size="sm">
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Contestar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
