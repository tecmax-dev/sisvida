import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Search, User } from "lucide-react";
import { QuoteItemSelector } from "./QuoteItemSelector";
import { formatCurrency, calculateQuoteTotals } from "@/lib/quoteUtils";

interface QuoteItem {
  id: string;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  item_type: 'procedure' | 'product';
  procedure_id?: string;
  product_id?: string;
}

interface Patient {
  id: string;
  name: string;
  cpf?: string | null;
  phone?: string | null;
}

interface QuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote?: {
    id: string;
    patient_id: string;
    professional_id?: string | null;
    quote_number: string;
    status: string;
    subtotal: number;
    discount_type: string;
    discount_value: number;
    total: number;
    valid_until?: string | null;
    notes?: string | null;
    internal_notes?: string | null;
    items?: QuoteItem[];
  } | null;
  onSuccess?: () => void;
}

export function QuoteDialog({ open, onOpenChange, quote, onSuccess }: QuoteDialogProps) {
  const { currentClinic, user } = useAuth();
  const queryClient = useQueryClient();
  
  const [patientId, setPatientId] = useState<string>("");
  const [patientSearch, setPatientSearch] = useState("");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load patients
  const { data: patients = [] } = useQuery({
    queryKey: ["patients-for-quote", currentClinic?.id, patientSearch],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      let query = supabase
        .from("patients")
        .select("id, name, cpf, phone")
        .eq("clinic_id", currentClinic.id)
        .order("name")
        .limit(20);
      
      if (patientSearch) {
        query = query.ilike("name", `%${patientSearch}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Patient[];
    },
    enabled: !!currentClinic?.id && open,
  });

  // Load professionals
  const { data: professionals = [] } = useQuery({
    queryKey: ["professionals-for-quote", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentClinic?.id && open,
  });

  // Calculate totals
  const totals = useMemo(() => {
    return calculateQuoteTotals(items, discountType, discountValue);
  }, [items, discountType, discountValue]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (quote) {
        setPatientId(quote.patient_id);
        setProfessionalId(quote.professional_id || "");
        setItems(quote.items || []);
        setDiscountType(quote.discount_type as 'percentage' | 'fixed');
        setDiscountValue(quote.discount_value);
        setValidUntil(quote.valid_until || "");
        setNotes(quote.notes || "");
        setInternalNotes(quote.internal_notes || "");
      } else {
        setPatientId("");
        setPatientSearch("");
        setProfessionalId("");
        setItems([]);
        setDiscountType('percentage');
        setDiscountValue(0);
        setValidUntil("");
        setNotes("");
        setInternalNotes("");
      }
    }
  }, [open, quote]);

  const handleAddItem = (item: QuoteItem) => {
    const existingIndex = items.findIndex(i => 
      (item.procedure_id && i.procedure_id === item.procedure_id) ||
      (item.product_id && i.product_id === item.product_id)
    );

    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].total = updated[existingIndex].quantity * updated[existingIndex].unit_price - updated[existingIndex].discount;
      setItems(updated);
    } else {
      setItems([...items, {
        ...item,
        id: crypto.randomUUID(),
        discount: 0,
        total: item.unit_price * item.quantity,
      }]);
    }
  };

  const handleUpdateItem = (index: number, field: keyof QuoteItem, value: number | string) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    
    // Recalculate total
    const item = updated[index];
    item.total = item.quantity * item.unit_price - item.discount;
    
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!currentClinic?.id || !patientId) {
      toast.error("Selecione um paciente");
      return;
    }

    if (items.length === 0) {
      toast.error("Adicione pelo menos um item ao orçamento");
      return;
    }

    setIsSubmitting(true);

    try {
      let quoteId = quote?.id;
      let quoteNumber = quote?.quote_number;

      if (!quoteId) {
        // Generate quote number
        const { data: numberData, error: numberError } = await supabase
          .rpc('generate_quote_number', { p_clinic_id: currentClinic.id });
        
        if (numberError) throw numberError;
        quoteNumber = numberData;

        // Create quote
        const { data: newQuote, error: createError } = await supabase
          .from("quotes")
          .insert({
            clinic_id: currentClinic.id,
            patient_id: patientId,
            professional_id: professionalId || null,
            quote_number: quoteNumber,
            status: 'draft',
            subtotal: totals.subtotal,
            discount_type: discountType,
            discount_value: discountValue,
            total: totals.total,
            valid_until: validUntil || null,
            notes: notes || null,
            internal_notes: internalNotes || null,
            created_by: user?.id,
          })
          .select()
          .single();

        if (createError) throw createError;
        quoteId = newQuote.id;
      } else {
        // Update quote
        const { error: updateError } = await supabase
          .from("quotes")
          .update({
            patient_id: patientId,
            professional_id: professionalId || null,
            subtotal: totals.subtotal,
            discount_type: discountType,
            discount_value: discountValue,
            total: totals.total,
            valid_until: validUntil || null,
            notes: notes || null,
            internal_notes: internalNotes || null,
          })
          .eq("id", quoteId);

        if (updateError) throw updateError;

        // Delete existing items
        await supabase.from("quote_items").delete().eq("quote_id", quoteId);
      }

      // Insert items
      const itemsToInsert = items.map((item, index) => ({
        quote_id: quoteId,
        item_type: item.item_type,
        procedure_id: item.procedure_id || null,
        product_id: item.product_id || null,
        name: item.name,
        description: item.description || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount,
        total: item.total,
        sort_order: index,
      }));

      const { error: itemsError } = await supabase
        .from("quote_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success(quote ? "Orçamento atualizado!" : "Orçamento criado!");
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Erro ao salvar orçamento:", error);
      toast.error(error.message || "Erro ao salvar orçamento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPatient = patients.find(p => p.id === patientId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {quote ? `Editar Orçamento #${quote.quote_number}` : "Novo Orçamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Patient Selection */}
            <div className="space-y-2">
              <Label>Paciente *</Label>
              {selectedPatient ? (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedPatient.name}</p>
                      {selectedPatient.phone && (
                        <p className="text-sm text-muted-foreground">{selectedPatient.phone}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPatientId("")}
                  >
                    Alterar
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar paciente..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {patients.length > 0 && (
                    <div className="border rounded-lg max-h-40 overflow-y-auto">
                      {patients.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setPatientId(patient.id);
                            setPatientSearch("");
                          }}
                        >
                          <p className="font-medium">{patient.name}</p>
                          {patient.phone && (
                            <p className="text-sm text-muted-foreground">{patient.phone}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Professional Selection */}
            <div className="space-y-2">
              <Label>Profissional (opcional)</Label>
              <Select value={professionalId || "none"} onValueChange={(v) => setProfessionalId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {professionals.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id}>
                      {prof.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Itens do Orçamento</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowItemSelector(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Item
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground">Nenhum item adicionado</p>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setShowItemSelector(true)}
                  >
                    Clique para adicionar
                  </Button>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Item</th>
                        <th className="text-center p-2 font-medium w-20">Qtd</th>
                        <th className="text-right p-2 font-medium w-28">Valor</th>
                        <th className="text-right p-2 font-medium w-28">Total</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-2">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {item.item_type === 'procedure' ? 'Serviço' : 'Produto'}
                            </p>
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-16 text-center h-8"
                            />
                          </td>
                          <td className="p-2 text-right">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="p-2 text-right font-medium">
                            {formatCurrency(item.total)}
                          </td>
                          <td className="p-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Discount */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Desconto</Label>
                <Select 
                  value={discountType} 
                  onValueChange={(v) => setDiscountType(v as 'percentage' | 'fixed')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor do Desconto</Label>
                <Input
                  type="number"
                  min={0}
                  step={discountType === 'percentage' ? 1 : 0.01}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Totals */}
            <div className="bg-muted/30 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              {discountValue > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>
                    Desconto{discountType === 'percentage' ? ` (${discountValue}%)` : ''}:
                  </span>
                  <span>-{formatCurrency(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total:</span>
                <span className="text-primary">{formatCurrency(totals.total)}</span>
              </div>
            </div>

            {/* Validity */}
            <div className="space-y-2">
              <Label>Válido até</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Observações (visível no orçamento)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condições de pagamento, observações gerais..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Notas internas (não aparece no orçamento)</Label>
              <Textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Anotações internas..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {quote ? "Salvar Alterações" : "Criar Orçamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuoteItemSelector
        open={showItemSelector}
        onOpenChange={setShowItemSelector}
        onSelect={handleAddItem}
      />
    </>
  );
}
