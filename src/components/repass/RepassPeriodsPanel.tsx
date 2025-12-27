import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { Calendar, Calculator, CheckCircle, Clock, DollarSign, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RepassPeriodsPanelProps {
  clinicId: string;
}

interface RepassPeriod {
  id: string;
  clinic_id: string;
  reference_month: number;
  reference_year: number;
  status: 'open' | 'calculated' | 'approved' | 'paid';
  total_gross: number;
  total_repass: number;
  calculated_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  open: "Aberto",
  calculated: "Calculado",
  approved: "Aprovado",
  paid: "Pago",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  calculated: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  approved: "bg-green-500/10 text-green-600 border-green-500/20",
  paid: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function RepassPeriodsPanel({ clinicId }: RepassPeriodsPanelProps) {
  const queryClient = useQueryClient();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());

  // Fetch periods
  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["repass-periods", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_repass_periods")
        .select("*")
        .eq("clinic_id", clinicId)
        .is("deleted_at", null)
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false });

      if (error) throw error;
      return data as RepassPeriod[];
    },
  });

  // Create period mutation
  const createPeriodMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("medical_repass_periods").insert({
        clinic_id: clinicId,
        reference_month: parseInt(selectedMonth),
        reference_year: parseInt(selectedYear),
        status: 'open',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repass-periods", clinicId] });
      toast.success("Período criado com sucesso");
    },
    onError: (error: any) => {
      if (error.message?.includes("unique")) {
        toast.error("Este período já existe");
      } else {
        toast.error("Erro ao criar período");
      }
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      
      if (status === 'calculated') {
        updates.calculated_at = new Date().toISOString();
      } else if (status === 'approved') {
        updates.approved_at = new Date().toISOString();
      } else if (status === 'paid') {
        updates.paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("medical_repass_periods")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repass-periods", clinicId] });
      toast.success("Status atualizado");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Períodos de Repasse
            </CardTitle>
            <CardDescription>
              Gerencie os períodos de fechamento mensal
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((name, index) => (
                  <SelectItem key={index} value={(index + 1).toString()}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => createPeriodMutation.mutate()}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Período
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : periods.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum período criado ainda
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Repasse</TableHead>
                  <TableHead>Calculado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">
                      {monthNames[period.reference_month - 1]} / {period.reference_year}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[period.status]}>
                        {statusLabels[period.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(period.total_gross || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(period.total_repass || 0)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {period.calculated_at
                        ? format(new Date(period.calculated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {period.status === 'open' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateStatusMutation.mutate({ id: period.id, status: 'calculated' })}
                          >
                            <Calculator className="h-4 w-4 mr-1" />
                            Calcular
                          </Button>
                        )}
                        {period.status === 'calculated' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateStatusMutation.mutate({ id: period.id, status: 'approved' })}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                        )}
                        {period.status === 'approved' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateStatusMutation.mutate({ id: period.id, status: 'paid' })}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Pagar
                          </Button>
                        )}
                        {period.status === 'paid' && (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Finalizado
                          </Badge>
                        )}
                      </div>
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
