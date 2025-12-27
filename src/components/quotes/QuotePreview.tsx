import { QuoteData, formatCurrency, getQuoteStatusLabel, getQuoteStatusColor } from "@/lib/quoteUtils";
import { numberToWords, capitalizeFirst } from "@/lib/numberToWords";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface QuotePreviewProps {
  data: QuoteData;
}

export function QuotePreview({ data }: QuotePreviewProps) {
  const discountAmount = data.discount_type === 'percentage'
    ? (data.subtotal * data.discount_value) / 100
    : data.discount_value;

  return (
    <div className="bg-white dark:bg-card p-6 rounded-lg border shadow-sm max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-4">
          {data.clinic.logo_url && (
            <img
              src={data.clinic.logo_url}
              alt="Logo"
              className="h-14 w-auto object-contain"
            />
          )}
          <div>
            <h2 className="text-lg font-bold">{data.clinic.name}</h2>
            {data.clinic.address && (
              <p className="text-xs text-muted-foreground">{data.clinic.address}</p>
            )}
            {data.clinic.phone && (
              <p className="text-xs text-muted-foreground">Tel: {data.clinic.phone}</p>
            )}
            {data.clinic.cnpj && (
              <p className="text-xs text-muted-foreground">CNPJ: {data.clinic.cnpj}</p>
            )}
          </div>
        </div>
        <Badge className={getQuoteStatusColor(data.status)}>
          {getQuoteStatusLabel(data.status)}
        </Badge>
      </div>

      {/* Title */}
      <div className="text-center py-4 border-b">
        <h1 className="text-2xl font-bold tracking-wide">ORÇAMENTO</h1>
      </div>

      {/* Meta Info */}
      <div className="flex justify-between py-4 text-sm">
        <div>
          <p><strong>Nº:</strong> {data.quote_number}</p>
          {data.valid_until && (
            <p><strong>Válido até:</strong> {format(new Date(data.valid_until), "dd/MM/yyyy", { locale: ptBR })}</p>
          )}
        </div>
        <div className="text-right">
          <p><strong>Data:</strong> {format(new Date(data.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
        </div>
      </div>

      {/* Patient Info */}
      <div className="py-4 border-t">
        <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">Cliente</h3>
        <div className="space-y-1 text-sm">
          <p><strong>Nome:</strong> {data.patient.name}</p>
          {data.patient.cpf && <p><strong>CPF:</strong> {data.patient.cpf}</p>}
          {data.patient.phone && <p><strong>Telefone:</strong> {data.patient.phone}</p>}
        </div>
      </div>

      {/* Items Table */}
      <div className="py-4 border-t">
        <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">Itens</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 font-medium">Descrição</th>
                <th className="text-center p-2 font-medium w-16">Qtd</th>
                <th className="text-right p-2 font-medium w-28">Valor Unit.</th>
                <th className="text-right p-2 font-medium w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-b border-muted/30">
                  <td className="p-2">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-2 text-center">{item.quantity}</td>
                  <td className="p-2 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="p-2 text-right font-medium">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="py-4 border-t space-y-2">
        <div className="flex justify-end gap-8 text-sm">
          <span className="text-muted-foreground">Subtotal:</span>
          <span className="w-28 text-right">{formatCurrency(data.subtotal)}</span>
        </div>
        {data.discount_value > 0 && (
          <div className="flex justify-end gap-8 text-sm text-green-600 dark:text-green-400">
            <span>
              Desconto{data.discount_type === 'percentage' ? ` (${data.discount_value}%)` : ''}:
            </span>
            <span className="w-28 text-right">-{formatCurrency(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-end gap-8 text-lg font-bold pt-2 border-t">
          <span>TOTAL:</span>
          <span className="w-28 text-right text-primary">{formatCurrency(data.total)}</span>
        </div>
        <div className="flex justify-end">
          <p className="text-xs text-muted-foreground italic">
            ({capitalizeFirst(numberToWords(data.total))})
          </p>
        </div>
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="py-4 border-t">
          <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">Observações</h3>
          <p className="text-sm bg-muted/30 p-3 rounded">{data.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="pt-4 border-t text-center">
        <p className="text-xs text-muted-foreground italic">
          Este documento foi gerado eletronicamente pelo sistema Eclini
        </p>
      </div>
    </div>
  );
}
