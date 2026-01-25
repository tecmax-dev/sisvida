import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, Check, QrCode, FileText, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { parseISO, format } from "date-fns";

interface MercadoPagoPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  amount: number;
  description: string;
  source: 'transaction' | 'package' | 'quote' | 'booking' | 'subscription';
  sourceId?: string;
  payerName?: string;
  payerEmail?: string;
  payerCpf?: string;
  onPaymentCreated?: (paymentId: string) => void;
}

export function MercadoPagoPaymentDialog({
  open,
  onOpenChange,
  clinicId,
  amount,
  description,
  source,
  sourceId,
  payerName = "",
  payerEmail = "",
  payerCpf = "",
  onPaymentCreated,
}: MercadoPagoPaymentDialogProps) {
  const [paymentType, setPaymentType] = useState<'pix' | 'boleto'>('pix');
  const [name, setName] = useState(payerName);
  const [email, setEmail] = useState(payerEmail);
  const [cpf, setCpf] = useState(payerCpf);
  const [boletoDueDays, setBoletoDueDays] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setName(payerName);
      setEmail(payerEmail);
      setCpf(payerCpf);
      setPaymentResult(null);
    }
  }, [open, payerName, payerEmail, payerCpf]);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const handleCreatePayment = async () => {
    if (!name.trim() || !email.trim() || !cpf.replace(/\D/g, '')) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      toast.error("CPF inválido");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('mercado-pago', {
        body: {
          action: paymentType === 'pix' ? 'create_pix' : 'create_boleto',
          clinic_id: clinicId,
          amount,
          description,
          payer_email: email,
          payer_name: name,
          payer_cpf: cleanCpf,
          source,
          source_id: sourceId,
          boleto_due_days: boletoDueDays,
        },
      });

      if (error) throw error;

      setPaymentResult(data);
      onPaymentCreated?.(data.id);
      toast.success(`Pagamento ${paymentType === 'pix' ? 'PIX' : 'Boleto'} gerado com sucesso!`);
    } catch (error: any) {
      console.error('Error creating payment:', error);
      toast.error(error.message || "Erro ao gerar pagamento");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {paymentType === 'pix' ? <QrCode className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            Pagamento via Mercado Pago
          </DialogTitle>
          <DialogDescription>
            Valor: {formatCurrency(amount)}
          </DialogDescription>
        </DialogHeader>

        {!paymentResult ? (
          <>
            <Tabs value={paymentType} onValueChange={(v) => setPaymentType(v as 'pix' | 'boleto')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pix" className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  PIX
                </TabsTrigger>
                <TabsTrigger value="boleto" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Boleto
                </TabsTrigger>
              </TabsList>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do pagador"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF *</Label>
                  <Input
                    id="cpf"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>

                <TabsContent value="boleto" className="mt-0">
                  <div className="space-y-2">
                    <Label htmlFor="dueDays">Dias para vencimento</Label>
                    <Input
                      id="dueDays"
                      type="number"
                      min={1}
                      max={30}
                      value={boletoDueDays}
                      onChange={(e) => setBoletoDueDays(parseInt(e.target.value) || 3)}
                    />
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreatePayment} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  `Gerar ${paymentType === 'pix' ? 'PIX' : 'Boleto'}`
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4">
            {paymentResult.payment_type === 'pix' && paymentResult.pix_qr_code && (
              <>
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <QRCodeSVG value={paymentResult.pix_qr_code} size={200} />
                </div>
                
                <div className="space-y-2">
                  <Label>Código PIX Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input
                      value={paymentResult.pix_qr_code}
                      readOnly
                      className="text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(paymentResult.pix_qr_code)}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                  O PIX expira em 30 minutos
                </p>
              </>
            )}

            {paymentResult.payment_type === 'boleto' && (
              <>
                {paymentResult.boleto_barcode && (
                  <div className="space-y-2">
                    <Label>Código de Barras</Label>
                    <div className="flex gap-2">
                      <Input
                        value={paymentResult.boleto_barcode}
                        readOnly
                        className="text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(paymentResult.boleto_barcode)}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {paymentResult.boleto_url && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(paymentResult.boleto_url, '_blank')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir Boleto
                  </Button>
                )}

                <p className="text-sm text-muted-foreground text-center">
                  Vencimento: {format(parseISO(paymentResult.boleto_due_date), "dd/MM/yyyy")}
                </p>
              </>
            )}

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
