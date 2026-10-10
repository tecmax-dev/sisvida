import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, ExternalLink, Loader2, Receipt, Wallet } from "lucide-react";
import { toast } from "sonner";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import SubscriptionPage from "@/pages/dashboard/SubscriptionPage";

interface Invoice {
  id: string;
  competence_month: number;
  competence_year: number;
  value_cents: number;
  paid_value_cents: number | null;
  due_date: string;
  paid_at: string | null;
  status: string;
  invoice_url: string | null;
  digitable_line: string | null;
  pix_code: string | null;
  description: string | null;
}

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function effectiveStatus(inv: Invoice): string {
  if (inv.status === "paid" || inv.status === "cancelled") return inv.status;
  const due = parseDateOnlyToLocalNoon(inv.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today ? "overdue" : "pending";
}

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Em aberto", variant: "secondary" },
  overdue: { label: "Vencido", variant: "destructive" },
  paid: { label: "Pago", variant: "default" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

function InvoicesTab() {
  const { currentClinic } = useAuth();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!currentClinic?.id) return;
    setLoading(true);
    supabase
      .from("subscription_invoices")
      .select("id,competence_month,competence_year,value_cents,paid_value_cents,due_date,paid_at,status,invoice_url,digitable_line,pix_code,description")
      .eq("clinic_id", currentClinic.id)
      .order("due_date", { ascending: false })
      .order("id", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error("Erro ao carregar faturas");
        setRows((data as Invoice[]) || []);
        setLoading(false);
      });
  }, [currentClinic?.id]);

  const withStatus = useMemo(() => rows.map((r) => ({ ...r, eff: effectiveStatus(r) })), [rows]);
  const totals = useMemo(() => {
    const t = { pending: 0, overdue: 0, paid: 0 } as Record<string, number>;
    withStatus.forEach((r) => {
      if (r.eff in t) t[r.eff] += r.eff === "paid" ? r.paid_value_cents ?? r.value_cents : r.value_cents;
    });
    return t;
  }, [withStatus]);
  const shown = filter === "all" ? withStatus : withStatus.filter((r) => r.eff === filter);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {(["pending", "overdue", "paid"] as const).map((k) => (
          <Card key={k} className={`cursor-pointer ${filter === k ? "ring-2 ring-primary" : ""}`} onClick={() => setFilter(filter === k ? "all" : k)}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{STATUS[k].label}</p>
              <p className="text-2xl font-semibold">{brl(totals[k])}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Faturas do plano</CardTitle>
          <CardDescription>Boletos da assinatura Prosinge desta conta{filter !== "all" && ` — filtro: ${STATUS[filter].label}`}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : shown.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhuma fatura encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{String(r.competence_month).padStart(2, "0")}/{r.competence_year}</TableCell>
                      <TableCell>{parseDateOnlyToLocalNoon(r.due_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{brl(r.value_cents)}</TableCell>
                      <TableCell><Badge variant={STATUS[r.eff]?.variant ?? "outline"}>{STATUS[r.eff]?.label ?? r.status}</Badge></TableCell>
                      <TableCell>{r.paid_at ? new Date(r.paid_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        {r.eff !== "paid" && r.eff !== "cancelled" && (
                          <>
                            {r.invoice_url && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={r.invoice_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Boleto</a>
                              </Button>
                            )}
                            {r.digitable_line && (
                              <Button size="sm" variant="ghost" onClick={() => copy(r.digitable_line!, "Linha digitável")}><Copy className="h-4 w-4 mr-1" />Linha</Button>
                            )}
                            {r.pix_code && (
                              <Button size="sm" variant="ghost" onClick={() => copy(r.pix_code!, "PIX")}><Copy className="h-4 w-4 mr-1" />PIX</Button>
                            )}
                          </>
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
    </div>
  );
}

export default function ProsingeBillingPage() {
  return (
    <RoleGuard permission="manage_subscription" fallback={<p className="p-6 text-muted-foreground">Acesso restrito aos gestores da conta.</p>}>
      <div className="space-y-6 p-1">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6 text-primary" /> Financeiro Prosinge</h1>
          <p className="text-muted-foreground">Acompanhe as faturas do seu plano e solicite upgrade ou downgrade.</p>
        </div>
        <Tabs defaultValue="faturas">
          <TabsList>
            <TabsTrigger value="faturas">Faturas</TabsTrigger>
            <TabsTrigger value="plano">Meu plano</TabsTrigger>
          </TabsList>
          <TabsContent value="faturas"><InvoicesTab /></TabsContent>
          <TabsContent value="plano"><SubscriptionPage /></TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}
