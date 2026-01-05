import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, AlertCircle } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface NegotiationSettings {
  max_installments: number;
  min_installment_value: number;
  require_down_payment: boolean;
  min_down_payment_percentage: number;
}

interface NegotiationStepInstallmentsProps {
  totalValue: number;
  settings: NegotiationSettings;
  installmentsCount: number;
  onInstallmentsCountChange: (count: number) => void;
  downPayment: number;
  onDownPaymentChange: (value: number) => void;
  firstDueDate: Date;
  onFirstDueDateChange: (date: Date) => void;
  installmentValue: number;
}

export default function NegotiationStepInstallments({
  totalValue,
  settings,
  installmentsCount,
  onInstallmentsCountChange,
  downPayment,
  onDownPaymentChange,
  firstDueDate,
  onFirstDueDateChange,
  installmentValue,
}: NegotiationStepInstallmentsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const amountToFinance = totalValue - downPayment;
  const minDownPayment = settings.require_down_payment
    ? totalValue * (settings.min_down_payment_percentage / 100)
    : 0;

  const isInstallmentValid = installmentValue >= settings.min_installment_value;
  const isDownPaymentValid = !settings.require_down_payment || downPayment >= minDownPayment;

  // Generate installments preview using addMonths for consistency
  const installmentsPreview = [];
  for (let i = 1; i <= Math.min(installmentsCount, 6); i++) {
    const installmentDate = addMonths(firstDueDate, i - 1);
    installmentsPreview.push({
      number: i,
      date: installmentDate,
      value: installmentValue,
    });
  }

  return (
    <div className="space-y-6">
      {/* Down Payment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Entrada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="downPayment">
              Valor da Entrada {settings.require_down_payment && "(obrigatória)"}
            </Label>
            <Input
              id="downPayment"
              type="number"
              step="0.01"
              min="0"
              max={totalValue}
              value={downPayment}
              onChange={(e) => onDownPaymentChange(parseFloat(e.target.value) || 0)}
              placeholder="0,00"
            />
            {settings.require_down_payment && (
              <p className="text-xs text-muted-foreground">
                Mínimo de {settings.min_down_payment_percentage}% = {formatCurrency(minDownPayment)}
              </p>
            )}
            {!isDownPaymentValid && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                A entrada deve ser de no mínimo {formatCurrency(minDownPayment)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Installments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Parcelamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Número de Parcelas</Label>
              <span className="text-2xl font-bold text-primary">{installmentsCount}x</span>
            </div>
            <Slider
              value={[installmentsCount]}
              onValueChange={([value]) => onInstallmentsCountChange(value)}
              min={1}
              max={settings.max_installments}
              step={1}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1x</span>
              <span>{settings.max_installments}x</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Valor a Financiar</span>
              <span className="font-medium">{formatCurrency(amountToFinance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Valor de Cada Parcela</span>
              <span className={cn("text-lg font-bold", !isInstallmentValid && "text-destructive")}>
                {formatCurrency(installmentValue)}
              </span>
            </div>
            {!isInstallmentValid && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Parcela mínima: {formatCurrency(settings.min_installment_value)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* First Due Date */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vencimento da Primeira Parcela</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !firstDueDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {firstDueDate ? format(firstDueDate, "PPP", { locale: ptBR }) : "Selecione uma data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={firstDueDate}
                onSelect={(date) => date && onFirstDueDateChange(date)}
                disabled={(date) => date < new Date()}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          {/* Preview of installments */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Prévia das Parcelas</Label>
            <div className="grid grid-cols-2 gap-2">
              {installmentsPreview.map((inst) => (
                <div
                  key={inst.number}
                  className="text-xs p-2 rounded bg-muted flex justify-between"
                >
                  <span>Parcela {inst.number}</span>
                  <span>{format(inst.date, "dd/MM/yyyy")}</span>
                </div>
              ))}
              {installmentsCount > 6 && (
                <div className="text-xs p-2 rounded bg-muted text-center col-span-2 text-muted-foreground">
                  ... e mais {installmentsCount - 6} parcela(s)
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
