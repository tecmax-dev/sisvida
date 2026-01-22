import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
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
import { Plus, Send, FileDown, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TissSubmissionsPanelProps {
  clinicId: string;
}

interface TissSubmission {
  id: string;
  clinic_id: string;
  insurance_plan_id: string | null;
  batch_number: string;
  submission_date: string;
  reference_month: number | null;
  reference_year: number | null;
  total_guides: number;
  total_value: number;
  status: string;
  sent_at: string | null;
  created_at: string;
  insurance_plan?: { name: string } | null;
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  received: "Recebido",
  processed: "Processado",
  error: "Erro",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  sent: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  received: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  processed: "bg-green-500/10 text-green-600 border-green-500/20",
  error: "bg-red-500/10 text-red-600 border-red-500/20",
};

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function TissSubmissionsPanel({ clinicId }: TissSubmissionsPanelProps) {
  const queryClient = useQueryClient();
  const currentDate = new Date();
  const [dialogOpen, setDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    insurance_plan_id: "_all",
    reference_month: (currentDate.getMonth() + 1).toString(),
    reference_year: currentDate.getFullYear().toString(),
  });

  // Fetch submissions
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["tiss-submissions", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];

      const { data, error } = await (supabase as any)
        .from("tiss_submissions")
        .select(`
          *,
          insurance_plan:insurance_plans(name)
        `)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching TISS submissions:", error);
        throw error;
      }
      return data as TissSubmission[];
    },
    enabled: !!clinicId,
  });

  // Fetch insurance plans
  const { data: insurancePlans = [] } = useQuery({
    queryKey: ["insurance-plans-for-submissions", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurance_plans")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const batchNumber = `LOTE-${data.reference_year}${data.reference_month.padStart(2, "0")}-${Date.now().toString(36).toUpperCase()}`;

      const { error } = await (supabase as any).from("tiss_submissions").insert({
        clinic_id: clinicId,
        insurance_plan_id: data.insurance_plan_id === "_all" ? null : data.insurance_plan_id,
        batch_number: batchNumber,
        reference_month: parseInt(data.reference_month),
        reference_year: parseInt(data.reference_year),
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiss-submissions", clinicId] });
      toast.success("Lote criado com sucesso");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Erro ao criar lote");
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormData({
      insurance_plan_id: "_all",
      reference_month: (currentDate.getMonth() + 1).toString(),
      reference_year: currentDate.getFullYear().toString(),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const years = Array.from({ length: 3 }, (_, i) => currentDate.getFullYear() - i);

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Lotes de Envio
          </CardTitle>
          <CardDescription>Gerencie envios de lotes XML para operadoras</CardDescription>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Lote
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhum lote criado</div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Operadora</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Guias</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-mono font-medium">
                      {submission.batch_number}
                    </TableCell>
                    <TableCell>{submission.insurance_plan?.name || "Todas"}</TableCell>
                    <TableCell>
                      {submission.reference_month && submission.reference_year
                        ? `${monthNames[submission.reference_month - 1]}/${submission.reference_year}`
                        : "-"}
                    </TableCell>
                    <TableCell>{submission.total_guides}</TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(submission.total_value || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[submission.status]}>
                        {statusLabels[submission.status] || submission.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {submission.sent_at
                        ? format(new Date(submission.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <FileDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog */}
      <PopupBase open={dialogOpen} onClose={handleCloseDialog} maxWidth="md">
        <PopupHeader>
          <PopupTitle>Novo Lote de Envio</PopupTitle>
        </PopupHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Operadora</Label>
            <Select
              value={formData.insurance_plan_id}
              onValueChange={(value) => setFormData({ ...formData, insurance_plan_id: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas as operadoras</SelectItem>
                {insurancePlans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mês de Referência</Label>
              <Select
                value={formData.reference_month}
                onValueChange={(value) => setFormData({ ...formData, reference_month: value })}
              >
                <SelectTrigger>
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
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select
                value={formData.reference_year}
                onValueChange={(value) => setFormData({ ...formData, reference_year: value })}
              >
                <SelectTrigger>
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
            </div>
          </div>

          <PopupFooter>
            <Button type="button" variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Criar Lote
            </Button>
          </PopupFooter>
        </form>
      </PopupBase>
    </Card>
  );
}
