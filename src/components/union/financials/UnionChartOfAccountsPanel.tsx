import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, ChevronRight, FolderTree, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnionChartOfAccountsPanelProps {
  clinicId: string;
}

interface Account {
  id: string;
  clinic_id: string;
  parent_id: string | null;
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  hierarchy_level: number;
  full_path: string | null;
  is_synthetic: boolean;
  is_active: boolean;
  created_at: string;
}

const accountTypeLabels: Record<string, string> = {
  asset: "Ativo",
  liability: "Passivo",
  equity: "Patrimônio Líquido",
  revenue: "Receita",
  expense: "Despesa",
};

const accountTypeColors: Record<string, string> = {
  asset: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  liability: "bg-red-500/10 text-red-600 border-red-500/20",
  equity: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  revenue: "bg-green-500/10 text-green-600 border-green-500/20",
  expense: "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

export function UnionChartOfAccountsPanel({ clinicId }: UnionChartOfAccountsPanelProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const [formData, setFormData] = useState({
    account_code: "",
    account_name: "",
    account_type: "expense" as Account['account_type'],
    parent_id: "" as string,
    is_synthetic: false,
    is_active: true,
  });

  // Fetch accounts
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["union-chart-of-accounts", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_chart_of_accounts")
        .select("*")
        .eq("clinic_id", clinicId)
        .is("deleted_at", null)
        .order("account_code");

      if (error) throw error;
      return data as Account[];
    },
    enabled: !!clinicId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("union_chart_of_accounts").insert({
        clinic_id: clinicId,
        account_code: data.account_code,
        account_name: data.account_name,
        account_type: data.account_type,
        parent_id: data.parent_id || null,
        is_synthetic: data.is_synthetic,
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-chart-of-accounts", clinicId] });
      toast.success("Conta criada com sucesso");
      handleCloseDialog();
    },
    onError: (error: any) => {
      if (error.message?.includes("unique")) {
        toast.error("Código de conta já existe");
      } else {
        toast.error("Erro ao criar conta");
      }
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from("union_chart_of_accounts")
        .update({
          account_code: data.account_code,
          account_name: data.account_name,
          account_type: data.account_type,
          parent_id: data.parent_id || null,
          is_synthetic: data.is_synthetic,
          is_active: data.is_active,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-chart-of-accounts", clinicId] });
      toast.success("Conta atualizada com sucesso");
      handleCloseDialog();
    },
    onError: () => {
      toast.error("Erro ao atualizar conta");
    },
  });

  // Delete mutation (soft delete)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("union_chart_of_accounts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-chart-of-accounts", clinicId] });
      toast.success("Conta removida com sucesso");
    },
    onError: () => {
      toast.error("Erro ao remover conta");
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAccount(null);
    setFormData({
      account_code: "",
      account_name: "",
      account_type: "expense",
      parent_id: "",
      is_synthetic: false,
      is_active: true,
    });
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      parent_id: account.parent_id || "",
      is_synthetic: account.is_synthetic,
      is_active: account.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAccount) {
      updateMutation.mutate({ ...formData, id: editingAccount.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Filter accounts
  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch =
      account.account_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.account_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || account.account_type === filterType;
    return matchesSearch && matchesType;
  });

  // Get parent accounts for select
  const parentAccounts = accounts.filter((a) => a.is_synthetic);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FolderTree className="h-5 w-5" />
          Plano de Contas Sindical
        </CardTitle>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Conta
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="asset">Ativo</SelectItem>
              <SelectItem value="liability">Passivo</SelectItem>
              <SelectItem value="equity">Patrimônio Líquido</SelectItem>
              <SelectItem value="revenue">Receita</SelectItem>
              <SelectItem value="expense">Despesa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredAccounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma conta encontrada
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono">
                      <div className="flex items-center gap-1">
                        {account.hierarchy_level > 1 && (
                          <span
                            className="text-muted-foreground"
                            style={{ paddingLeft: `${(account.hierarchy_level - 1) * 12}px` }}
                          >
                            <ChevronRight className="h-3 w-3" />
                          </span>
                        )}
                        {account.account_code}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {account.account_name}
                        {account.is_synthetic && (
                          <Badge variant="outline" className="text-xs">
                            Sintética
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(accountTypeColors[account.account_type])}
                      >
                        {accountTypeLabels[account.account_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>{account.hierarchy_level}</TableCell>
                    <TableCell>
                      <Badge variant={account.is_active ? "default" : "secondary"}>
                        {account.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(account)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(account.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Editar Conta" : "Nova Conta"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da conta contábil
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="account_code">Código</Label>
                <Input
                  id="account_code"
                  value={formData.account_code}
                  onChange={(e) =>
                    setFormData({ ...formData, account_code: e.target.value })
                  }
                  placeholder="1.1.01"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account_type">Tipo</Label>
                <Select
                  value={formData.account_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, account_type: value as Account['account_type'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Ativo</SelectItem>
                    <SelectItem value="liability">Passivo</SelectItem>
                    <SelectItem value="equity">Patrimônio Líquido</SelectItem>
                    <SelectItem value="revenue">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_name">Nome</Label>
              <Input
                id="account_name"
                value={formData.account_name}
                onChange={(e) =>
                  setFormData({ ...formData, account_name: e.target.value })
                }
                placeholder="Nome da conta"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent_id">Conta Pai (opcional)</Label>
              <Select
                value={formData.parent_id || "__none__"}
                onValueChange={(value) =>
                  setFormData({ ...formData, parent_id: value === "__none__" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta pai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma (raiz)</SelectItem>
                  {parentAccounts
                    .filter((a) => a.id !== editingAccount?.id)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.account_code} - {account.account_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_synthetic"
                  checked={formData.is_synthetic}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_synthetic: checked })
                  }
                />
                <Label htmlFor="is_synthetic">Conta Sintética (agrupadora)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Ativa</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingAccount ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
