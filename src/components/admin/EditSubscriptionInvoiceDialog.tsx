 import { useState, useEffect } from "react";
 import { useMutation, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Loader2, Calendar, DollarSign } from "lucide-react";
 import { toast } from "sonner";
 
 interface Invoice {
   id: string;
   clinic_id: string;
   due_date: string;
   value_cents: number;
   status: string;
   competence_month: number;
   competence_year: number;
   clinics?: { name: string };
   subscription_plans?: { name: string };
 }
 
 interface EditSubscriptionInvoiceDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   invoice: Invoice | null;
 }
 
 export function EditSubscriptionInvoiceDialog({
   open,
   onOpenChange,
   invoice,
 }: EditSubscriptionInvoiceDialogProps) {
   const queryClient = useQueryClient();
   const [dueDate, setDueDate] = useState("");
   const [valueReais, setValueReais] = useState("");
 
   useEffect(() => {
     if (invoice && open) {
       setDueDate(invoice.due_date);
       setValueReais((invoice.value_cents / 100).toFixed(2).replace(".", ","));
     }
   }, [invoice, open]);
 
   const updateMutation = useMutation({
     mutationFn: async ({ invoiceId, newDueDate, newValueCents }: {
       invoiceId: string;
       newDueDate?: string;
       newValueCents?: number;
     }) => {
       const { data: { session } } = await supabase.auth.getSession();
       if (!session) throw new Error("Não autenticado");
 
       const response = await fetch(
         `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-billing-api`,
         {
           method: "POST",
           headers: {
             "Authorization": `Bearer ${session.access_token}`,
             "Content-Type": "application/json",
           },
           body: JSON.stringify({
             action: "update_invoice",
             invoiceId,
             newDueDate,
             newValueCents,
           }),
         }
       );
 
       if (!response.ok) {
         const error = await response.json();
         throw new Error(error.error || "Erro ao atualizar boleto");
       }
 
       return response.json();
     },
     onSuccess: () => {
       toast.success("Boleto atualizado com sucesso!");
       queryClient.invalidateQueries({ queryKey: ["subscription-invoices"] });
       onOpenChange(false);
     },
     onError: (error) => {
       toast.error(error.message);
     },
   });
 
   const handleSubmit = () => {
     if (!invoice) return;
 
     // Converter valor de reais para centavos
     const cleanValue = valueReais.replace(/\./g, "").replace(",", ".");
     const valueCents = Math.round(parseFloat(cleanValue) * 100);
 
     if (isNaN(valueCents) || valueCents <= 0) {
       toast.error("Valor inválido");
       return;
     }
 
     // Verificar se houve mudanças
     const dateChanged = dueDate !== invoice.due_date;
     const valueChanged = valueCents !== invoice.value_cents;
 
     if (!dateChanged && !valueChanged) {
       toast.info("Nenhuma alteração detectada");
       return;
     }
 
     updateMutation.mutate({
       invoiceId: invoice.id,
       newDueDate: dateChanged ? dueDate : undefined,
       newValueCents: valueChanged ? valueCents : undefined,
     });
   };
 
   const formatCurrency = (value: string) => {
     // Remove tudo exceto números e vírgula
     let cleaned = value.replace(/[^\d,]/g, "");
     
     // Garante apenas uma vírgula
     const parts = cleaned.split(",");
     if (parts.length > 2) {
       cleaned = parts[0] + "," + parts.slice(1).join("");
     }
     
     // Limita casas decimais
     if (parts[1]?.length > 2) {
       cleaned = parts[0] + "," + parts[1].slice(0, 2);
     }
     
     return cleaned;
   };
 
   if (!invoice) return null;
 
   const clinicName = (invoice.clinics as any)?.name || "Clínica";
   const planName = (invoice.subscription_plans as any)?.name || "Plano";
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-md">
         <DialogHeader>
           <DialogTitle>Editar Boleto</DialogTitle>
           <DialogDescription>
             Altere a data de vencimento e/ou valor do boleto de assinatura
           </DialogDescription>
         </DialogHeader>
 
         <div className="space-y-4 py-4">
           {/* Info do boleto */}
           <div className="p-3 bg-muted rounded-lg space-y-1">
             <p className="font-medium text-sm">{clinicName}</p>
             <p className="text-xs text-muted-foreground">
               {planName} - {String(invoice.competence_month).padStart(2, "0")}/{invoice.competence_year}
             </p>
           </div>
 
           {/* Data de vencimento */}
           <div className="space-y-2">
             <Label className="flex items-center gap-2">
               <Calendar className="h-4 w-4" />
               Data de Vencimento
             </Label>
             <Input
               type="date"
               value={dueDate}
               onChange={(e) => setDueDate(e.target.value)}
               min={new Date().toISOString().split("T")[0]}
             />
           </div>
 
           {/* Valor */}
           <div className="space-y-2">
             <Label className="flex items-center gap-2">
               <DollarSign className="h-4 w-4" />
               Valor (R$)
             </Label>
             <div className="relative">
               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                 R$
               </span>
               <Input
                 type="text"
                 value={valueReais}
                 onChange={(e) => setValueReais(formatCurrency(e.target.value))}
                 className="pl-10"
                 placeholder="0,00"
               />
             </div>
           </div>
         </div>
 
         <DialogFooter>
           <Button variant="outline" onClick={() => onOpenChange(false)}>
             Cancelar
           </Button>
           <Button
             onClick={handleSubmit}
             disabled={updateMutation.isPending}
           >
             {updateMutation.isPending ? (
               <Loader2 className="h-4 w-4 mr-2 animate-spin" />
             ) : null}
             Salvar Alterações
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }