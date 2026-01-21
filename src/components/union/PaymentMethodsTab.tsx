import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Settings,
  Trash2,
  Plus,
  Edit,
  Loader2,
  CreditCard,
  GripVertical,
  Banknote,
  Receipt,
  Wallet,
  Building,
  CircleDollarSign,
  BadgeDollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  order_index: number;
}

interface PaymentMethodsTabProps {
  sindicatoId: string;
  onRefresh?: () => void;
}

// Predefined payment method templates
// Payroll deduction code variants for compatibility
const PAYROLL_DEDUCTION_CODES = ["desconto_folha", "desconto_contracheque"];

const PAYMENT_METHOD_TEMPLATES = [
  { code: "pix", name: "Pix", icon: Wallet, description: "Pagamento instantâneo via Pix" },
  { code: "boleto", name: "Boleto", icon: Receipt, description: "Boleto bancário" },
  { code: "cartao_credito", name: "Cartão de Crédito", icon: CreditCard, description: "Pagamento com cartão de crédito" },
  { code: "cartao_debito", name: "Cartão de Débito", icon: CreditCard, description: "Pagamento com cartão de débito" },
  { code: "debito_conta", name: "Débito em Conta", icon: Building, description: "Débito automático em conta bancária" },
  { code: "desconto_folha", name: "Desconto em Folha", icon: BadgeDollarSign, description: "Desconto direto na folha de pagamento" },
  { code: "dinheiro", name: "Dinheiro", icon: Banknote, description: "Pagamento em espécie" },
  { code: "outros", name: "Outros", icon: CircleDollarSign, description: "Outras formas de pagamento" },
];

// Payment methods that are incompatible with each other (supports both code variants)
const INCOMPATIBLE_METHODS: Record<string, string[]> = {
  "desconto_folha": ["pix", "boleto", "dinheiro"],
  "desconto_contracheque": ["pix", "boleto", "dinheiro"],
};

export function PaymentMethodsTab({ sindicatoId, onRefresh }: PaymentMethodsTabProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethod | null>(null);
  
  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  useEffect(() => {
    fetchPaymentMethods();
  }, [sindicatoId]);

  const fetchPaymentMethods = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sindical_payment_methods")
        .select("*")
        .eq("sindicato_id", sindicatoId)
        .order("order_index");

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      toast.error("Erro ao carregar formas de pagamento");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormCode("");
    setFormName("");
    setFormDescription("");
    setEditingMethod(null);
    setIsFormOpen(false);
  };

  const handleEditMethod = (method: PaymentMethod) => {
    setEditingMethod(method);
    setFormCode(method.code);
    setFormName(method.name);
    setFormDescription(method.description || "");
    setIsFormOpen(true);
  };

  const handleAddTemplate = (template: typeof PAYMENT_METHOD_TEMPLATES[0]) => {
    // Check if already exists
    if (paymentMethods.some(m => m.code === template.code)) {
      toast.error("Esta forma de pagamento já está configurada");
      return;
    }
    
    setFormCode(template.code);
    setFormName(template.name);
    setFormDescription(template.description);
    setEditingMethod(null);
    setIsFormOpen(true);
  };

  const handleSaveMethod = async () => {
    if (!formCode.trim() || !formName.trim()) {
      toast.error("Código e nome são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      if (editingMethod) {
        const { error } = await supabase
          .from("sindical_payment_methods")
          .update({
            code: formCode.trim().toLowerCase().replace(/\s+/g, "_"),
            name: formName.trim(),
            description: formDescription.trim() || null,
          })
          .eq("id", editingMethod.id);

        if (error) throw error;
        toast.success("Forma de pagamento atualizada");
      } else {
        const maxOrder = paymentMethods.length > 0 
          ? Math.max(...paymentMethods.map(m => m.order_index || 0)) + 1 
          : 0;

        const { error } = await supabase
          .from("sindical_payment_methods")
          .insert({
            sindicato_id: sindicatoId,
            code: formCode.trim().toLowerCase().replace(/\s+/g, "_"),
            name: formName.trim(),
            description: formDescription.trim() || null,
            is_active: true,
            order_index: maxOrder,
          });

        if (error) throw error;
        toast.success("Forma de pagamento criada");
      }

      resetForm();
      fetchPaymentMethods();
      onRefresh?.();
    } catch (error: any) {
      console.error("Error saving payment method:", error);
      if (error.code === "23505") {
        toast.error("Já existe uma forma de pagamento com este código");
      } else {
        toast.error("Erro ao salvar forma de pagamento");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (method: PaymentMethod) => {
    try {
      const { error } = await supabase
        .from("sindical_payment_methods")
        .update({ is_active: !method.is_active })
        .eq("id", method.id);

      if (error) throw error;
      
      toast.success(method.is_active ? "Forma de pagamento desativada" : "Forma de pagamento ativada");
      fetchPaymentMethods();
      onRefresh?.();
    } catch (error) {
      console.error("Error toggling payment method:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const handleDeleteMethod = async () => {
    if (!methodToDelete) return;

    try {
      const { error } = await supabase
        .from("sindical_payment_methods")
        .delete()
        .eq("id", methodToDelete.id);

      if (error) throw error;
      toast.success("Forma de pagamento removida");
      setDeleteDialogOpen(false);
      setMethodToDelete(null);
      fetchPaymentMethods();
      onRefresh?.();
    } catch (error) {
      console.error("Error deleting payment method:", error);
      toast.error("Erro ao remover forma de pagamento");
    }
  };

  const getMethodIcon = (code: string) => {
    const template = PAYMENT_METHOD_TEMPLATES.find(t => t.code === code);
    return template?.icon || CircleDollarSign;
  };

  // Get available templates (not yet added)
  const availableTemplates = PAYMENT_METHOD_TEMPLATES.filter(
    t => !paymentMethods.some(m => m.code === t.code)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Formas de Pagamento</h3>
          <p className="text-sm text-muted-foreground">
            Configure as formas de pagamento disponíveis para contribuições
          </p>
        </div>
      </div>

      {/* Quick Add Templates */}
      {availableTemplates.length > 0 && !isFormOpen && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Forma de Pagamento
            </CardTitle>
            <CardDescription>
              Clique para adicionar uma forma de pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {availableTemplates.map((template) => {
                const Icon = template.icon;
                return (
                  <Button
                    key={template.code}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleAddTemplate(template)}
                  >
                    <Icon className="h-4 w-4" />
                    {template.name}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      {isFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {editingMethod ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingMethod ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="methodCode">Código *</Label>
                <Input
                  id="methodCode"
                  placeholder="ex: desconto_contracheque"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  disabled={!!editingMethod}
                />
                <p className="text-xs text-muted-foreground">
                  Identificador único (sem espaços)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="methodName">Nome *</Label>
                <Input
                  id="methodName"
                  placeholder="Ex: Desconto em Contracheque"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="methodDescription">Descrição</Label>
              <Textarea
                id="methodDescription"
                placeholder="Descrição opcional da forma de pagamento"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Show incompatibility warning for desconto_contracheque */}
            {formCode === "desconto_contracheque" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>Atenção:</strong> Quando o sócio selecionar "Desconto em Contracheque", 
                  formas de pagamento incompatíveis (Pix, Boleto, Dinheiro) serão desabilitadas automaticamente.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSaveMethod} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingMethod ? "Atualizar" : "Adicionar"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Methods List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Formas Configuradas
          </CardTitle>
          <CardDescription>
            {paymentMethods.length} forma{paymentMethods.length !== 1 ? "s" : ""} de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentMethods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma forma de pagamento configurada</p>
              <p className="text-sm">Adicione as formas de pagamento disponíveis</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => {
                const Icon = getMethodIcon(method.code);
                const isPayrollDeduction = method.code === "desconto_contracheque";
                
                return (
                  <div
                    key={method.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      method.is_active 
                        ? "bg-card hover:bg-muted/30" 
                        : "bg-muted/20 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <div className={`p-2 rounded-lg ${isPayrollDeduction ? "bg-primary/10" : "bg-muted"}`}>
                        <Icon className={`h-4 w-4 ${isPayrollDeduction ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{method.name}</p>
                          {isPayrollDeduction && (
                            <Badge variant="secondary" className="text-xs">
                              Exclusivo
                            </Badge>
                          )}
                          <Badge variant={method.is_active ? "default" : "secondary"} className="text-xs">
                            {method.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        {method.description && (
                          <p className="text-sm text-muted-foreground">{method.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground font-mono">{method.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={method.is_active ?? false}
                        onCheckedChange={() => handleToggleActive(method)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditMethod(method)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setMethodToDelete(method);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card about Payroll Deduction */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <BadgeDollarSign className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-medium">Sobre Desconto em Folha</h4>
              <p className="text-sm text-muted-foreground">
                Quando ativo, esta opção aparecerá no formulário de filiação. 
                Ao ser selecionada pelo sócio, outras formas de pagamento incompatíveis 
                serão automaticamente desabilitadas (ex: Pix + Folha não podem ser usados juntos).
              </p>
              <p className="text-sm text-muted-foreground">
                O sistema registrará a escolha como <code className="bg-muted px-1 rounded">desconto_folha</code> 
                no cadastro do associado.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Forma de Pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover "{methodToDelete?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMethod}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default PaymentMethodsTab;
