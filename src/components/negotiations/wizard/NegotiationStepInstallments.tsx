import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, AlertCircle, RotateCcw, Edit2 } from "lucide-react";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  customDates?: Record<number, Date>;
  onCustomDatesChange?: (dates: Record<number, Date>) => void;
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
  customDates = {},
  onCustomDatesChange,
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

  // Generate installments preview with custom dates support
  const generateInstallments = () => {
    const installments = [];
    for (let i = 1; i <= installmentsCount; i++) {
      const autoDate = addMonths(firstDueDate, i - 1);
      const customDate = customDates[i];
      const isCustom = !!customDate;
      const dueDate = customDate || autoDate;

      installments.push({
        number: i,
        dueDate,
        autoDate,
        isCustom,
        value: installmentValue,
      });
    }
    return installments;
  };

  const installments = generateInstallments();
  const hasCustomDates = Object.keys(customDates).length > 0;

  const handleDateChange = (installmentNumber: number, date: Date | undefined) => {
    if (!date || !onCustomDatesChange) return;
    
    const newDates = { ...customDates };
    newDates[installmentNumber] = date;
    onCustomDatesChange(newDates);
  };

  const handleResetDate = (installmentNumber: number) => {
    if (!onCustomDatesChange) return;
    
    const newDates = { ...customDates };
    delete newDates[installmentNumber];
    onCustomDatesChange(newDates);
  };

  const handleResetAllDates = () => {
    if (!onCustomDatesChange) return;
    onCustomDatesChange({});
  };

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
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Vencimento Base da Primeira Parcela</CardTitle>
            {hasCustomDates && onCustomDatesChange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetAllDates}
                className="text-muted-foreground h-8"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Resetar todas
              </Button>
            )}
          </div>
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
        </CardContent>
      </Card>

      {/* Installments List with Editable Dates */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Parcelas</CardTitle>
            {onCustomDatesChange && (
              <p className="text-xs text-muted-foreground">
                Clique na data para personalizar
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-2">
              {installments.map((installment) => (
                <div
                  key={installment.number}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    installment.isCustom
                      ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                      : "bg-muted/30"
                  )}
                >
                  {/* Installment Number */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">
                      {installment.number}
                    </span>
                  </div>

                  {/* Date Picker or Display */}
                  <div className="flex-1">
                    {onCustomDatesChange ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-auto py-1 px-2 font-normal justify-start",
                              installment.isCustom && "text-amber-700 dark:text-amber-400"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {format(installment.dueDate, "dd/MM/yyyy")}
                            {installment.isCustom && (
                              <Badge
                                variant="outline"
                                className="ml-2 text-[10px] py-0 px-1 bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-400 dark:border-amber-700"
                              >
                                editado
                              </Badge>
                            )}
                            <Edit2 className="ml-auto h-3 w-3 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={installment.dueDate}
                            onSelect={(date) => handleDateChange(installment.number, date)}
                            disabled={(date) => date < new Date()}
                            initialFocus
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className="text-sm">{format(installment.dueDate, "dd/MM/yyyy")}</span>
                    )}
                  </div>

                  {/* Value */}
                  <div className="flex-shrink-0 text-sm font-medium">
                    {formatCurrency(installment.value)}
                  </div>

                  {/* Reset Button */}
                  {installment.isCustom && onCustomDatesChange && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={() => handleResetDate(installment.number)}
                      title="Restaurar data automática"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
