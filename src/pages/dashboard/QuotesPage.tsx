import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  Printer,
  Download,
  FileText,
  Loader2,
} from "lucide-react";
import { QuoteDialog } from "@/components/quotes/QuoteDialog";
import { QuotePreview } from "@/components/quotes/QuotePreview";
import {
  formatCurrency,
  getQuoteStatusLabel,
  getQuoteStatusColor,
  generateQuotePDF,
  printQuote,
  QuoteData,
} from "@/lib/quoteUtils";
import { sendWhatsAppDocument } from "@/lib/whatsapp";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  subtotal: number;
  discount_type: string;
  discount_value: number;
  total: number;
  valid_until: string | null;
  notes: string | null;
  internal_notes: string | null;
  created_at: string;
  patient: {
    id: string;
    name: string;
    cpf: string | null;
    phone: string | null;
  };
  professional: {
    id: string;
    name: string;
  } | null;
}

export default function QuotesPage() {
  const { currentClinic } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<QuoteData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotes", currentClinic?.id, statusFilter],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      let query = supabase
        .from("quotes")
        .select(`
          *,
          patient:patients(id, name, cpf, phone),
          professional:professionals(id, name)
        `)
        .eq("clinic_id", currentClinic.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!currentClinic?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase
        .from("quotes")
        .delete()
        .eq("id", quoteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Orçamento excluído!");
      setDeleteDialogOpen(false);
      setQuoteToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao excluir orçamento");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: string }) => {
      const updates: Record<string, any> = { status };
      if (status === 'sent') updates.sent_at = new Date().toISOString();
      if (status === 'approved') updates.approved_at = new Date().toISOString();
      if (status === 'rejected') updates.rejected_at = new Date().toISOString();

      const { error } = await supabase
        .from("quotes")
        .update(updates)
        .eq("id", quoteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Status atualizado!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar status");
    },
  });

  const filteredQuotes = quotes.filter((quote) =>
    quote.quote_number.toLowerCase().includes(search.toLowerCase()) ||
    quote.patient.name.toLowerCase().includes(search.toLowerCase())
  );

  const loadQuoteData = async (quote: Quote): Promise<QuoteData> => {
    const { data: items } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("sort_order");

    return {
      id: quote.id,
      quote_number: quote.quote_number,
      status: quote.status,
      subtotal: quote.subtotal,
      discount_type: quote.discount_type as 'percentage' | 'fixed',
      discount_value: quote.discount_value,
      total: quote.total,
      valid_until: quote.valid_until,
      notes: quote.notes,
      created_at: quote.created_at,
      items: (items || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount,
        total: item.total,
        item_type: item.item_type as 'procedure' | 'product',
      })),
      clinic: {
        name: currentClinic?.name || '',
        address: currentClinic?.address,
        phone: currentClinic?.phone,
        cnpj: currentClinic?.cnpj,
        logo_url: currentClinic?.logo_url,
      },
      patient: {
        name: quote.patient.name,
        cpf: quote.patient.cpf,
        phone: quote.patient.phone,
      },
      professional: quote.professional,
    };
  };

  const handlePreview = async (quote: Quote) => {
    const data = await loadQuoteData(quote);
    setPreviewData(data);
    setPreviewOpen(true);
  };

  const handlePrint = async (quote: Quote) => {
    const data = await loadQuoteData(quote);
    printQuote(data);
  };

  const handleDownloadPDF = async (quote: Quote) => {
    const data = await loadQuoteData(quote);
    const { blob, fileName } = await generateQuotePDF(data);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendWhatsApp = async (quote: Quote) => {
    if (!quote.patient.phone) {
      toast.error("Paciente não possui telefone cadastrado");
      return;
    }

    setSendingWhatsApp(quote.id);
    try {
      const data = await loadQuoteData(quote);
      const { blob, fileName } = await generateQuotePDF(data);
      
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });
      const pdfBase64 = await base64Promise;
      
      const validUntilText = quote.valid_until 
        ? format(new Date(quote.valid_until), "dd/MM/yyyy") 
        : undefined;
      
      const caption = `Olá ${quote.patient.name}! 👋

📋 *Orçamento ${quote.quote_number}*

A ${currentClinic?.name || ''} envia o orçamento solicitado:

💰 *Valor Total:* ${formatCurrency(quote.total)}
${validUntilText ? `📅 *Válido até:* ${validUntilText}` : ''}

📎 O orçamento em PDF está anexado a esta mensagem.

Atenciosamente,
Equipe ${currentClinic?.name || ''}`;

      const result = await sendWhatsAppDocument({
        clinicId: currentClinic?.id || '',
        phone: quote.patient.phone,
        pdfBase64,
        fileName,
        caption,
      });

      if (result.success) {
        toast.success("Orçamento enviado por WhatsApp!");
        // Update status to sent
        updateStatusMutation.mutate({ quoteId: quote.id, status: 'sent' });
      } else {
        toast.error(result.error || "Erro ao enviar");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar orçamento");
    } finally {
      setSendingWhatsApp(null);
    }
  };

  const handleEdit = async (quote: Quote) => {
    const { data: items } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("sort_order");

    setSelectedQuote({
      ...quote,
      items: (items || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount,
        total: item.total,
        item_type: item.item_type,
        procedure_id: item.procedure_id,
        product_id: item.product_id,
      })),
    } as any);
    setDialogOpen(true);
  };

  // Stats
  const stats = {
    total: quotes.length,
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    approved: quotes.filter(q => q.status === 'approved').length,
    totalValue: quotes.filter(q => q.status === 'approved').reduce((sum, q) => sum + q.total, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orçamentos</h1>
          <p className="text-muted-foreground">
            Gerencie os orçamentos da sua clínica
          </p>
        </div>
        {hasPermission("manage_budgets") && (
          <Button onClick={() => { setSelectedQuote(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Orçamento
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rascunhos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Enviados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aprovados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalValue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número ou paciente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
            <SelectItem value="converted">Convertido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">Nenhum orçamento encontrado</h3>
          <p className="text-muted-foreground mb-4">
            {search || statusFilter !== 'all' 
              ? "Tente ajustar os filtros" 
              : "Comece criando seu primeiro orçamento"}
          </p>
          {!search && statusFilter === 'all' && (
            <Button onClick={() => { setSelectedQuote(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Orçamento
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium">{quote.quote_number}</TableCell>
                  <TableCell>{quote.patient.name}</TableCell>
                  <TableCell>
                    {format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {quote.valid_until 
                      ? format(new Date(quote.valid_until), "dd/MM/yyyy", { locale: ptBR })
                      : '-'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(quote.total)}
                  </TableCell>
                  <TableCell>
                    <Badge className={getQuoteStatusColor(quote.status)}>
                      {getQuoteStatusLabel(quote.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePreview(quote)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        {hasPermission("manage_budgets") && (
                          <DropdownMenuItem onClick={() => handleEdit(quote)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handlePrint(quote)}>
                          <Printer className="h-4 w-4 mr-2" />
                          Imprimir
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadPDF(quote)}>
                          <Download className="h-4 w-4 mr-2" />
                          Baixar PDF
                        </DropdownMenuItem>
                        {hasPermission("send_budget_whatsapp") && (
                          <DropdownMenuItem 
                            onClick={() => handleSendWhatsApp(quote)}
                            disabled={sendingWhatsApp === quote.id}
                          >
                            {sendingWhatsApp === quote.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Enviar WhatsApp
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {hasPermission("approve_budgets") && quote.status !== 'approved' && (
                          <DropdownMenuItem 
                            onClick={() => updateStatusMutation.mutate({ quoteId: quote.id, status: 'approved' })}
                          >
                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                            Marcar como Aprovado
                          </DropdownMenuItem>
                        )}
                        {hasPermission("approve_budgets") && quote.status !== 'rejected' && (
                          <DropdownMenuItem 
                            onClick={() => updateStatusMutation.mutate({ quoteId: quote.id, status: 'rejected' })}
                          >
                            <XCircle className="h-4 w-4 mr-2 text-red-600" />
                            Marcar como Rejeitado
                          </DropdownMenuItem>
                        )}
                        {hasPermission("manage_budgets") && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => { setQuoteToDelete(quote); setDeleteDialogOpen(true); }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs */}
      <QuoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        quote={selectedQuote as any}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["quotes"] })}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview do Orçamento</DialogTitle>
          </DialogHeader>
          {previewData && <QuotePreview data={previewData} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o orçamento {quoteToDelete?.quote_number}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => quoteToDelete && deleteMutation.mutate(quoteToDelete.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
