import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  DollarSign,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Session {
  id: string;
  session_number: number;
  session_date: string;
  notes: string | null;
  professional?: { name: string } | null;
  appointment?: { start_time: string } | null;
}

interface Payment {
  id: string;
  amount: number;
  installment_number: number;
  total_installments: number;
  due_date: string;
  paid_date: string | null;
  payment_method: string | null;
  status: string;
}

interface PatientPackage {
  id: string;
  name: string;
  description: string | null;
  total_sessions: number;
  used_sessions: number;
  remaining_sessions: number;
  price: number;
  purchase_date: string;
  expiry_date: string | null;
  status: string;
  notes: string | null;
  patient: { id: string; name: string; phone: string } | null;
  procedure?: { name: string } | null;
}

interface PackageDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientPackage: PatientPackage | null;
}

export function PackageDetailsDialog({
  open,
  onOpenChange,
  patientPackage,
}: PackageDetailsDialogProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && patientPackage) {
      fetchDetails();
    }
  }, [open, patientPackage]);

  const fetchDetails = async () => {
    if (!patientPackage) return;
    setLoading(true);

    try {
      // Fetch sessions
      const { data: sessionsData } = await supabase
        .from("package_sessions")
        .select("*, professional:professionals(name), appointment:appointments(start_time)")
        .eq("patient_package_id", patientPackage.id)
        .order("session_number");

      setSessions(sessionsData || []);

      // Fetch payments
      const { data: paymentsData } = await supabase
        .from("package_payments")
        .select("*")
        .eq("patient_package_id", patientPackage.id)
        .order("installment_number");

      setPayments(paymentsData || []);
    } catch (error) {
      console.error("Error fetching details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from("package_payments")
        .update({
          status: "paid",
          paid_date: format(new Date(), "yyyy-MM-dd"),
        })
        .eq("id", paymentId);

      if (error) throw error;
      toast.success("Pagamento registrado");
      fetchDetails();
    } catch (error) {
      console.error("Error marking as paid:", error);
      toast.error("Erro ao registrar pagamento");
    }
  };

  const getPaymentStatusBadge = (payment: Payment) => {
    if (payment.status === "paid") {
      return <Badge variant="default" className="bg-green-600">Pago</Badge>;
    }
    if (payment.status === "cancelled") {
      return <Badge variant="outline">Cancelado</Badge>;
    }
    if (isPast(new Date(payment.due_date))) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    return <Badge variant="secondary">Pendente</Badge>;
  };

  if (!patientPackage) return null;

  const progress = (patientPackage.used_sessions / patientPackage.total_sessions) * 100;
  const totalPaid = payments.filter(p => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter(p => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{patientPackage.name}</span>
            <Badge variant={patientPackage.status === "active" ? "default" : "secondary"}>
              {patientPackage.status === "active" ? "Ativo" : 
               patientPackage.status === "completed" ? "Concluído" :
               patientPackage.status === "expired" ? "Expirado" : "Cancelado"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Package Summary */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Paciente</p>
              <p className="font-medium">{patientPackage.patient?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Data da Compra</p>
              <p className="font-medium">
                {format(new Date(patientPackage.purchase_date), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Validade</p>
              <p className="font-medium">
                {patientPackage.expiry_date
                  ? format(new Date(patientPackage.expiry_date), "dd/MM/yyyy", { locale: ptBR })
                  : "Sem limite"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="font-medium">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(patientPackage.price)}
              </p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Progresso das Sessões</span>
            <span className="text-sm text-muted-foreground">
              {patientPackage.used_sessions} de {patientPackage.total_sessions} sessões
            </span>
          </div>
          <Progress value={progress} className="h-3" />
          <p className="text-xs text-muted-foreground text-right">
            {patientPackage.remaining_sessions} sessões restantes
          </p>
        </div>

        <Separator />

        {/* Tabs for Sessions and Payments */}
        <Tabs defaultValue="sessions">
          <TabsList className="w-full">
            <TabsTrigger value="sessions" className="flex-1">
              Sessões Realizadas ({sessions.length})
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex-1">
              Pagamentos ({payments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-4">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : sessions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Nenhuma sessão realizada ainda
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sessão</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Profissional</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          #{session.session_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(session.session_date), "dd/MM/yyyy", { locale: ptBR })}
                        {session.appointment && (
                          <span className="text-muted-foreground ml-1">
                            às {session.appointment.start_time.slice(0, 5)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {session.professional?.name || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : payments.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Nenhum pagamento registrado
              </p>
            ) : (
              <>
                {/* Payment Summary */}
                <div className="flex gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Pago</p>
                    <p className="text-lg font-semibold text-green-600">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(totalPaid)}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Pendente</p>
                    <p className="text-lg font-semibold text-yellow-600">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(totalPending)}
                    </p>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {payment.installment_number}/{payment.total_installments}
                        </TableCell>
                        <TableCell>
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(payment.amount)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(payment.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{getPaymentStatusBadge(payment)}</TableCell>
                        <TableCell className="text-right">
                          {payment.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkAsPaid(payment.id)}
                            >
                              Marcar Pago
                            </Button>
                          )}
                          {payment.status === "paid" && payment.paid_date && (
                            <span className="text-xs text-muted-foreground">
                              Pago em {format(new Date(payment.paid_date), "dd/MM", { locale: ptBR })}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Notes */}
        {patientPackage.notes && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-1">Observações</p>
              <p className="text-sm text-muted-foreground">{patientPackage.notes}</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
