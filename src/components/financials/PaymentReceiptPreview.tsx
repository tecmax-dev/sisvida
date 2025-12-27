import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { numberToWords, capitalizeFirst } from "@/lib/numberToWords";
import { formatCurrency } from "@/lib/paymentReceiptUtils";

interface PaymentReceiptPreviewProps {
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
    cnpj?: string | null;
  };
  patient?: {
    name: string;
    cpf?: string | null;
  };
  transaction: {
    description: string;
    amount: number;
    payment_method?: string | null;
    paid_date?: string | null;
    procedure_name?: string | null;
    professional_name?: string | null;
  };
  receiptNumber: string;
}

const paymentMethodLabels: Record<string, string> = {
  cash: "Dinheiro",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  pix: "PIX",
  bank_transfer: "Transferência Bancária",
  check: "Cheque",
  insurance: "Convênio",
};

export function PaymentReceiptPreview({
  clinic,
  patient,
  transaction,
  receiptNumber,
}: PaymentReceiptPreviewProps) {
  const amount = Number(transaction.amount);
  const amountFormatted = formatCurrency(amount);
  const amountInWords = capitalizeFirst(numberToWords(amount));
  const receiptDate = transaction.paid_date
    ? format(new Date(transaction.paid_date), "dd 'de' MMMM 'de' yyyy", {
        locale: ptBR,
      })
    : format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const paymentMethod = transaction.payment_method
    ? paymentMethodLabels[transaction.payment_method] || transaction.payment_method
    : null;

  return (
    <div className="bg-white text-black p-6 rounded-lg border shadow-sm max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-teal-700">{clinic.name}</h1>
        {clinic.address && (
          <p className="text-sm text-gray-600">{clinic.address}</p>
        )}
        <p className="text-sm text-gray-600">
          {[
            clinic.phone ? `Tel: ${clinic.phone}` : "",
            clinic.cnpj ? `CNPJ: ${clinic.cnpj}` : "",
          ]
            .filter(Boolean)
            .join(" | ")}
        </p>
      </div>

      {/* Divider */}
      <div className="border-t-2 border-teal-600 my-4" />

      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold">RECIBO DE PAGAMENTO</h2>
        <p className="text-sm text-gray-600">Nº {receiptNumber}</p>
        <p className="text-sm text-gray-600">{receiptDate}</p>
      </div>

      {/* Recipient */}
      {patient && (
        <div className="mb-4">
          <p className="font-bold mb-1">RECEBI DE:</p>
          <p>Nome: {patient.name}</p>
          {patient.cpf && <p>CPF: {patient.cpf}</p>}
        </div>
      )}

      {/* Amount */}
      <div className="mb-4">
        <p className="font-bold mb-1">VALOR:</p>
        <p className="text-lg font-bold text-teal-700">{amountFormatted}</p>
        <p className="text-sm text-gray-600 italic">({amountInWords})</p>
      </div>

      {/* Description */}
      <div className="mb-4">
        <p className="font-bold mb-1">REFERENTE A:</p>
        <p>{transaction.description}</p>
        {transaction.procedure_name && (
          <p>Procedimento: {transaction.procedure_name}</p>
        )}
        {transaction.professional_name && (
          <p>Profissional: {transaction.professional_name}</p>
        )}
      </div>

      {/* Payment Method */}
      {paymentMethod && (
        <div className="mb-4">
          <p className="font-bold mb-1">FORMA DE PAGAMENTO:</p>
          <p>{paymentMethod}</p>
        </div>
      )}

      {/* Declaration */}
      <p className="text-sm text-gray-600 mt-6 text-justify">
        Para maior clareza, firmo o presente recibo, dando plena, total e
        irrevogável quitação do valor acima especificado.
      </p>

      {/* Signature */}
      <div className="mt-12 text-center">
        <div className="border-t border-black w-48 mx-auto mb-2" />
        <p className="text-sm">{clinic.name}</p>
        <p className="text-xs text-gray-600">Assinatura e Carimbo</p>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-400">
        <p>Documento gerado eletronicamente pelo sistema Eclini</p>
        <p>
          Emitido em:{" "}
          {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}
