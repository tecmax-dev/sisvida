import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Wallet, Building2, CreditCard, MoreHorizontal, Trash2, Edit, FileText, TrendingUp } from "lucide-react";
import { FinancialExportButton } from "./FinancialExportButton";
import { exportCashRegisters, CashRegisterData } from "@/lib/financialExportUtils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BankStatementDialog } from "./BankStatementDialog";

interface CashRegistersPanelProps {
  clinicId: string;
}

const registerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["cash", "bank", "credit_card", "investment", "other"]),
  initial_balance: z.string().optional(),
  bank_name: z.string().optional(),
  agency: z.string().optional(),
  account_number: z.string().optional(),
});

type RegisterFormData = z.infer<typeof registerSchema>;

const typeLabels: Record<string, string> = {
  cash: "Dinheiro",
  bank: "Conta Bancária",
  credit_card: "Cartão de Crédito",
  investment: "Aplicação",
  other: "Outro",
};

const typeIcons: Record<string, React.ReactNode> = {
  cash: <Wallet className="h-5 w-5" />,
  bank: <Building2 className="h-5 w-5" />,
  credit_card: <CreditCard className="h-5 w-5" />,
  investment: <TrendingUp className="h-5 w-5" />,
  other: <Wallet className="h-5 w-5" />,
};

export function CashRegistersPanel({ clinicId }: CashRegistersPanelProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegister, setEditingRegister] = useState<any>(null);
  const [statementDialogOpen, setStatementDialogOpen] = useState(false);
  const [selectedRegisterForStatement, setSelectedRegisterForStatement] = useState<any>(null);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      type: "cash",
      initial_balance: "0",
    },
  });

  const { data: registers, isLoading } = useQuery({
    queryKey: ["cash-registers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      const balance = parseFloat(data.initial_balance?.replace(",", ".") || "0");
      
      const payload = {
        clinic_id: clinicId,
        name: data.name,
        type: data.type,
        initial_balance: balance,
        current_balance: balance,
        bank_name: data.bank_name || null,
        agency: data.agency || null,
        account_number: data.account_number || null,
      };

      if (editingRegister) {
        const { error } = await supabase
          .from("cash_registers")
          .update(payload)
          .eq("id", editingRegister.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cash_registers")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      toast.success(editingRegister ? "Caixa atualizado!" : "Caixa criado!");
      setDialogOpen(false);
      setEditingRegister(null);
      form.reset();
    },
    onError: () => {
      toast.error("Erro ao salvar caixa");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cash_registers")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      toast.success("Caixa removido!");
    },
    onError: () => {
      toast.error("Erro ao remover caixa");
    },
  });

  const handleEdit = (register: any) => {
    setEditingRegister(register);
    form.reset({
      name: register.name,
      type: register.type,
      initial_balance: register.initial_balance?.toString() || "0",
      bank_name: register.bank_name || "",
      agency: register.agency || "",
      account_number: register.account_number || "",
    });
    setDialogOpen(true);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const handleExport = (exportFormat: 'pdf' | 'excel') => {
    const exportData: CashRegisterData[] = (registers || []).map(r => ({
      name: r.name,
      type: typeLabels[r.type],
      initialBalance: Number(r.initial_balance),
      currentBalance: Number(r.current_balance),
      bankName: r.bank_name || undefined,
      agency: r.agency || undefined,
      account: r.account_number || undefined,
    }));
    
    const totalBalance = registers?.reduce((sum, r) => sum + Number(r.current_balance), 0) || 0;
    
    exportCashRegisters("Clínica", exportData, totalBalance, exportFormat);
  };

  const type = form.watch("type");

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Caixas e Contas</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie seus caixas e contas bancárias
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FinancialExportButton
            onExportPDF={() => handleExport('pdf')}
            onExportExcel={() => handleExport('excel')}
            disabled={!registers?.length}
          />
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Caixa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {registers?.map((register) => (
          <Card key={register.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                {typeIcons[register.type]}
                <CardTitle className="text-base">{register.name}</CardTitle>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {register.type === "bank" && (
                    <DropdownMenuItem onClick={() => {
                      setSelectedRegisterForStatement(register);
                      setStatementDialogOpen(true);
                    }}>
                      <FileText className="h-4 w-4 mr-2" />
                      Importar Extrato OFX
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleEdit(register)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(register.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remover
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="mb-2">
                {typeLabels[register.type]}
              </Badge>
              {register.bank_name && (
                <p className="text-xs text-muted-foreground">
                  {register.bank_name} - Ag: {register.agency} | CC: {register.account_number}
                </p>
              )}
              <p className="text-2xl font-bold mt-2">
                {formatCurrency(Number(register.current_balance))}
              </p>
            </CardContent>
          </Card>
        ))}

        {(!registers || registers.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhum caixa cadastrado. Clique em "Novo Caixa" para começar.
            </CardContent>
          </Card>
        )}
      </div>

      <PopupBase 
        open={dialogOpen} 
        onClose={() => {
          setDialogOpen(false);
          setEditingRegister(null);
          form.reset();
        }}
        maxWidth="md"
      >
        <PopupHeader>
          <PopupTitle>
            {editingRegister ? "Editar Caixa" : "Novo Caixa"}
          </PopupTitle>
        </PopupHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Caixa Principal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="bank">Conta Bancária</SelectItem>
                      <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                      <SelectItem value="investment">Aplicação</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {type === "bank" && (
              <>
                <FormField
                  control={form.control}
                  name="bank_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banco</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Banco do Brasil" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="agency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agência</FormLabel>
                        <FormControl>
                          <Input placeholder="0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="account_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conta</FormLabel>
                        <FormControl>
                          <Input placeholder="00000-0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <FormField
              control={form.control}
              name="initial_balance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Saldo Inicial</FormLabel>
                  <FormControl>
                    <Input placeholder="0,00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <PopupFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </PopupFooter>
          </form>
        </Form>
      </PopupBase>

      <BankStatementDialog
        open={statementDialogOpen}
        onOpenChange={setStatementDialogOpen}
        register={selectedRegisterForStatement}
      />
    </div>
  );
}
